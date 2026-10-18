import logging
import os
import tempfile
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from interview_agents.schemas.interview import SpeechGenerationRequest, SpeechGenerationResponse
from interview_agents.services.speech_to_text_service import get_stt_service, SpeechToTextService
from interview_agents.services.text_to_speech_service import get_tts_service, TextToSpeechService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["speech"])


@router.post("/generate-speech", response_model=SpeechGenerationResponse)
def generate_speech(
    payload: SpeechGenerationRequest,
    tts_service: TextToSpeechService = Depends(get_tts_service),
) -> SpeechGenerationResponse:
    audio_url = tts_service.generate_audio(payload.text)
    if audio_url is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate speech for the requested text."
        )
    return SpeechGenerationResponse(audio_url=audio_url)


@router.post("/transcribe")
def api_transcribe(
    audio_file: UploadFile = File(...),
    word_timestamps: bool = Form(False),
    stt_service: SpeechToTextService = Depends(get_stt_service),
):
    """Transcribe one uploaded answer.

    ``word_timestamps`` is opt-in so the default response stays exactly
    ``{"text": ...}`` for the technical/HR round, which already calls this and
    reads nothing else. Only the SVAR round asks for timings, and if the
    timings model fails it degrades to the plain transcript rather than losing
    the candidate's answer.
    """
    ext = os.path.splitext(audio_file.filename)[1].lower() if audio_file.filename else ".wav"
    fd, temp_path = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(fd, "wb") as temp_file:
            while chunk := audio_file.file.read(1024 * 1024):
                temp_file.write(chunk)

        if not word_timestamps:
            return {"text": stt_service.transcribe(temp_path)}

        try:
            timed = stt_service.transcribe_with_words(temp_path)
        except Exception as exc:  # timings model unavailable — still return the answer
            logger.warning("Word-timed transcription failed, falling back to plain: %s", exc)
            return {"text": stt_service.transcribe(temp_path), "words": [], "duration": 0.0}

        return {
            "text": timed.text,
            "duration": timed.duration_sec,
            "words": [
                {"word": w.word, "start_sec": w.start_sec, "end_sec": w.end_sec}
                for w in timed.words
            ],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
