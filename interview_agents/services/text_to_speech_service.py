from __future__ import annotations

import hashlib
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from interview_agents.config.settings import get_settings

logger = logging.getLogger(__name__)

# Backs generate_audio_async - see its docstring for why this exists.
_audio_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="tts-background")

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def _split_sentences(text: str) -> list[str]:
    """Split into sentences for generate_audio_chunked. Falls back to the
    whole text as a single "sentence" if splitting doesn't produce anything
    usable (e.g. no terminal punctuation) - the caller treats a 1-item result
    as "don't bother chunking"."""
    parts = [p.strip() for p in _SENTENCE_SPLIT_RE.split(text.strip()) if p.strip()]
    return parts or [text.strip()]


class TextToSpeechService:
    """Singleton service to convert text to speech with OpenAI TTS and cached local audio."""

    _instance: TextToSpeechService | None = None
    _initialized: bool = False

    def __new__(cls, *args: Any, **kwargs: Any) -> TextToSpeechService:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        settings = get_settings()
        os.makedirs(settings.tts_audio_dir, exist_ok=True)
        self._client = None
        self._initialized = True

    def _get_openai_client(self):
        # Cached on the singleton instance rather than constructed fresh per
        # call - a new OpenAI() client means a new underlying connection pool,
        # so every call was paying a fresh TCP/TLS handshake to api.openai.com
        # instead of reusing a warm, already-established connection.
        if self._client is not None:
            return self._client

        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError("openai is not installed. Install the dependency before using the OpenAI SDK.") from exc

        settings = get_settings()
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured in the environment.")

        self._client = OpenAI(
            api_key=settings.openai_api_key,
            timeout=settings.openai_timeout_seconds,
            max_retries=settings.openai_max_retries,
        )
        return self._client

    def _save_openai_audio(self, response: Any, filepath: str) -> None:
        if hasattr(response, "read"):
            audio_bytes = response.read()
        elif isinstance(response, (bytes, bytearray)):
            audio_bytes = bytes(response)
        elif isinstance(response, str):
            audio_bytes = response.encode("utf-8")
        else:
            audio_bytes = bytes(response)

        with open(filepath, "wb") as audio_file:
            audio_file.write(audio_bytes)

    def generate_audio(self, text: str) -> str | None:
        """Convert text to speech and return the static URL of the generated MP3."""
        settings = get_settings()
        if not settings.tts_enabled:
            return None

        clean_text = text.strip()
        if not clean_text:
            return None

        text_hash = hashlib.md5(clean_text.encode("utf-8")).hexdigest()
        filename = f"{text_hash}.mp3"
        filepath = os.path.join(settings.tts_audio_dir, filename)
        relative_url = f"/static/audio/{filename}"

        if os.path.exists(filepath):
            logger.info("TTS cache hit for text hash %s: %s", text_hash, relative_url)
            return relative_url

        logger.info("Generating new TTS audio for text hash %s...", text_hash)
        try:
            client = self._get_openai_client()
            response = client.audio.speech.create(
                input=clean_text,
                model=settings.tts_model,
                voice=settings.tts_voice,
                response_format=settings.tts_response_format,
            )
            self._save_openai_audio(response, filepath)
            logger.info("Successfully generated OpenAI TTS audio file: %s", filepath)
            return relative_url
        except Exception as exc:
            logger.warning("OpenAI TTS generation failed for '%s': %s", clean_text[:30], str(exc), exc_info=True)

        try:
            from gtts import gTTS

            tts = gTTS(text=clean_text, lang=settings.tts_voice_language)
            os.makedirs(settings.tts_audio_dir, exist_ok=True)
            tts.save(filepath)
            logger.info("Successfully generated fallback TTS audio file: %s", filepath)
            return relative_url
        except Exception as exc:
            logger.warning("Failed to generate fallback TTS audio for '%s': %s", clean_text[:30], str(exc), exc_info=True)
            return None

    def generate_audio_async(self, text: str) -> str | None:
        """Same URL contract as generate_audio (deterministic hash-based path
        under /static/audio/), but never blocks on the OpenAI TTS network call.

        Used by /start-interview and /submit-answer: their only real consumer
        (the avatar studio, via avatar.controller.js) never reads audio_url at
        all - the candidate's actual voice comes from Azure's real-time avatar
        speech synthesis client-side - so awaiting a full TTS round-trip there
        was pure wasted latency (~1-3s) on every turn. This keeps the exact
        same response shape (still a valid, correctly-formatted URL) so nothing
        that reads the field breaks, while doing the real synthesis - if it
        happens at all - in the background instead of on the critical path.

        On a cache hit (file already on disk from a previous call with the
        same text) this is just as synchronous/instant as generate_audio was.
        """
        settings = get_settings()
        if not settings.tts_enabled:
            return None

        clean_text = text.strip()
        if not clean_text:
            return None

        text_hash = hashlib.md5(clean_text.encode("utf-8")).hexdigest()
        filename = f"{text_hash}.mp3"
        filepath = os.path.join(settings.tts_audio_dir, filename)
        relative_url = f"/static/audio/{filename}"

        if os.path.exists(filepath):
            return relative_url

        def _run() -> None:
            try:
                self.generate_audio(text)
            except Exception:
                logger.warning("Background TTS generation failed for hash %s", text_hash, exc_info=True)

        _audio_executor.submit(_run)
        return relative_url

    def generate_audio_chunked(self, text: str) -> str | None:
        """Same URL/caching contract as generate_audio, but for multi-sentence
        text, synthesizes each sentence concurrently instead of making one
        sequential OpenAI TTS call for the whole thing, then stitches the
        resulting MP3 byte streams together in original sentence order. Cuts
        wall-clock synthesis time for the common multi-sentence question case,
        since 3 sentences synthesized in parallel take roughly as long as the
        slowest one, not the sum of all three.

        Falls back to generate_audio's exact single-call behavior whenever
        chunking wouldn't help (single-sentence text) or anything about it
        fails (a per-sentence API error, an empty result, etc.) - so this can
        only ever match or beat generate_audio, never regress below it.
        """
        settings = get_settings()
        if not settings.tts_enabled:
            return None

        clean_text = text.strip()
        if not clean_text:
            return None

        text_hash = hashlib.md5(clean_text.encode("utf-8")).hexdigest()
        filename = f"{text_hash}.mp3"
        filepath = os.path.join(settings.tts_audio_dir, filename)
        relative_url = f"/static/audio/{filename}"

        if os.path.exists(filepath):
            logger.info("TTS cache hit for text hash %s: %s", text_hash, relative_url)
            return relative_url

        sentences = _split_sentences(clean_text)
        if len(sentences) < 2:
            return self.generate_audio(text)

        try:
            client = self._get_openai_client()

            def _synthesize(sentence: str) -> bytes:
                response = client.audio.speech.create(
                    input=sentence,
                    model=settings.tts_model,
                    voice=settings.tts_voice,
                    response_format=settings.tts_response_format,
                )
                return response.read() if hasattr(response, "read") else bytes(response)

            with ThreadPoolExecutor(max_workers=min(len(sentences), 4), thread_name_prefix="tts-chunk") as executor:
                # Submitted and read back in sentence order (not completion
                # order via as_completed) - result order must match sentence
                # order regardless of which finishes first, or playback would
                # be scrambled.
                futures = [executor.submit(_synthesize, s) for s in sentences]
                chunks = [f.result() for f in futures]

            if not all(chunks):
                raise RuntimeError("One or more sentence chunks returned empty audio")

            with open(filepath, "wb") as audio_file:
                for chunk in chunks:
                    audio_file.write(chunk)

            logger.info(
                "Successfully generated chunked TTS audio file (%d sentences, parallel): %s",
                len(sentences), filepath,
            )
            return relative_url
        except Exception as exc:
            logger.warning(
                "Chunked TTS generation failed for '%s...', falling back to single-call synthesis: %s",
                clean_text[:30], exc, exc_info=True,
            )
            return self.generate_audio(text)


def get_tts_service() -> TextToSpeechService:
    """Dependency helper to retrieve the TextToSpeechService singleton."""
    return TextToSpeechService()
