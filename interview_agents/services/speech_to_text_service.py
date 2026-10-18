from __future__ import annotations

import logging
import subprocess
from dataclasses import dataclass, field
from typing import Any

from interview_agents.config.settings import get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class WordSpan:
    """One transcribed word and where it sits in the audio."""

    word: str
    start_sec: float
    end_sec: float


@dataclass(frozen=True)
class TimedTranscription:
    """A transcript plus the per-word timings delivery scoring needs.

    ``words`` is empty when the provider returns no timing array; callers must
    treat that as "delivery signal unavailable", never as an error.
    """

    text: str
    duration_sec: float = 0.0
    words: list[WordSpan] = field(default_factory=list)


class SpeechToTextService:
    """Singleton service to transcribe audio with OpenAI Whisper."""

    _instance: SpeechToTextService | None = None
    _model_name: str | None = None
    _device: str | None = None
    _client: Any = None

    def __new__(cls, *args: Any, **kwargs: Any) -> SpeechToTextService:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def initialize(self, model_name: str = "whisper-1", device: str | None = None) -> None:
        """Configure the remote OpenAI transcription model."""
        if self._model_name == model_name and self._device == device:
            return

        self._model_name = model_name
        self._device = device
        logger.info(
            "Configured remote OpenAI transcription model '%s' (device setting ignored).",
            model_name,
        )

    @property
    def is_loaded(self) -> bool:
        return self._model_name is not None

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

    def validate_audio(self, file_path: str) -> float:
        """Validate audio structure, duration, and integrity using ffprobe.

        Raises ValueError if audio is invalid, empty, or exceeds duration limit.
        """
        settings = get_settings()
        try:
            cmd = [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                file_path,
            ]
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True,
            )
            output = result.stdout.strip()
            if not output:
                raise ValueError("Metadata duration missing from ffprobe output.")

            try:
                duration = float(output)
            except ValueError as val_exc:
                raise ValueError("Audio duration metadata is non-numeric.") from val_exc

            if duration <= 0:
                raise ValueError("Audio file contains no length or is silent.")

            if duration > settings.whisper_max_duration_seconds:
                raise ValueError(
                    f"Audio duration of {duration:.1f}s exceeds the maximum limit of {settings.whisper_max_duration_seconds}s."
                )

            return duration
        except (subprocess.CalledProcessError, ValueError) as exc:
            logger.warning("Audio validation failure for %s: %s", file_path, str(exc), exc_info=True)
            raise ValueError(f"Uploaded audio file is corrupted, empty, or invalid: {exc}") from exc

    def transcribe(self, file_path: str) -> str:
        """Transcribe a validated local audio file."""
        if self._model_name is None:
            raise RuntimeError("SpeechToTextService is not initialized. Call initialize() at startup first.")

        settings = get_settings()
        logger.info("Transcribing audio file %s with OpenAI model %s", file_path, self._model_name)

        try:
            client = self._get_openai_client()
            with open(file_path, "rb") as audio_file:
                response = client.audio.transcriptions.create(
                    file=audio_file,
                    model=self._model_name,
                    # Interviews are conducted and scored in English only. Without
                    # this, Whisper auto-detects the spoken language and can
                    # transcribe accented/code-switched English into Hindi/Urdu
                    # script instead, producing an unreadable "answer" in reports.
                    language="en",
                )

            if isinstance(response, str):
                transcript = response.strip()
            elif isinstance(response, dict):
                transcript = response.get("text", "").strip()
            else:
                transcript = getattr(response, "text", "").strip()

            return transcript
        except Exception as exc:
            logger.error("Failed to transcribe audio file %s: %s", file_path, str(exc), exc_info=True)
            raise RuntimeError(f"Transcription execution failed: {exc}") from exc

    def transcribe_with_words(self, file_path: str) -> TimedTranscription:
        """Transcribe with per-word timings, for delivery scoring.

        Deliberately pinned to ``settings.stt_timings_model`` rather than the
        service's configured model: OpenAI accepts ``timestamp_granularities``
        only on ``whisper-1`` + ``verbose_json``. The ``gpt-4o-*-transcribe``
        models silently support neither, so asking them for timings yields a
        transcript with no timings at all.
        """
        settings = get_settings()
        model = settings.stt_timings_model
        logger.info("Transcribing audio file %s with word timings (model %s)", file_path, model)

        try:
            client = self._get_openai_client()
            with open(file_path, "rb") as audio_file:
                response = client.audio.transcriptions.create(
                    file=audio_file,
                    model=model,
                    language="en",
                    response_format="verbose_json",
                    timestamp_granularities=["word"],
                )
        except Exception as exc:
            logger.error("Failed to transcribe %s with timings: %s", file_path, str(exc), exc_info=True)
            raise RuntimeError(f"Timed transcription failed: {exc}") from exc

        return _to_timed_transcription(response)


def _get(source: Any, key: str, default: Any = None) -> Any:
    """Read a field from either a dict payload or an SDK model object."""
    if isinstance(source, dict):
        return source.get(key, default)
    return getattr(source, key, default)


def _to_timed_transcription(response: Any) -> TimedTranscription:
    text = (_get(response, "text", "") or "").strip()
    try:
        duration = float(_get(response, "duration", 0.0) or 0.0)
    except (TypeError, ValueError):
        duration = 0.0

    words: list[WordSpan] = []
    for entry in _get(response, "words", None) or []:
        raw_word = _get(entry, "word", "")
        if not raw_word:
            continue
        try:
            start = float(_get(entry, "start", 0.0) or 0.0)
            end = float(_get(entry, "end", 0.0) or 0.0)
        except (TypeError, ValueError):
            continue
        words.append(WordSpan(word=str(raw_word), start_sec=start, end_sec=end))

    return TimedTranscription(text=text, duration_sec=duration, words=words)


def get_stt_service() -> SpeechToTextService:
    """Dependency helper to retrieve the initialized SpeechToTextService singleton."""
    return SpeechToTextService()
