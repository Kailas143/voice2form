import io
import json
import logging
import os
import tempfile
import time
import wave
from typing import Any

logger = logging.getLogger(__name__)

import requests

from config import SARVAM_API_KEY

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_BATCH_MODEL = os.getenv("SARVAM_BATCH_MODEL", "saaras:v3")
SARVAM_BATCH_MODE = os.getenv("SARVAM_BATCH_MODE", "transcribe")
SARVAM_BATCH_WITH_DIARIZATION = os.getenv("SARVAM_BATCH_WITH_DIARIZATION", "false").lower() in {"1", "true", "yes", "y"}
SARVAM_BATCH_NUM_SPEAKERS = int(os.getenv("SARVAM_BATCH_NUM_SPEAKERS", "2"))

_DURATION_LIMIT_HINTS = (
    "audio duration exceeds the maximum limit of 30 seconds",
    "please use the batch api",
    "duration exceeds",
)


def _request_headers() -> dict[str, str]:
    return {"api-subscription-key": SARVAM_API_KEY}


def is_duration_limit_error(message: str) -> bool:
    lowered = message.lower()
    return any(hint in lowered for hint in _DURATION_LIMIT_HINTS)


def _estimate_wav_duration_seconds(audio_bytes: bytes) -> float | None:
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wav_file:
            frame_rate = wav_file.getframerate()
            frame_count = wav_file.getnframes()
            if frame_rate <= 0:
                return None
            return frame_count / frame_rate
    except (wave.Error, EOFError):
        return None


def should_use_batch(audio_bytes: bytes, content_type: str = "audio/wav") -> bool:
    base_type = (content_type or "").split(";")[0].strip().lower()
    if base_type != "audio/wav":
        return False

    duration_seconds = _estimate_wav_duration_seconds(audio_bytes)
    return bool(duration_seconds and duration_seconds > 30)


def _extract_transcript(payload: Any) -> str:
    if isinstance(payload, str):
        return payload.strip()

    if isinstance(payload, list):
        for item in payload:
            text = _extract_transcript(item)
            if text:
                return text
        return ""

    if isinstance(payload, dict):
        for key in ("transcript", "full_transcript", "final_transcript", "transcription"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

        diarized = payload.get("diarized_transcript")
        if isinstance(diarized, dict):
            entries = diarized.get("entries")
            if isinstance(entries, list):
                lines: list[str] = []
                for entry in entries:
                    if isinstance(entry, dict):
                        segment = str(entry.get("transcript", "")).strip()
                        if segment:
                            lines.append(segment)
                if lines:
                    return " ".join(lines)

        for key in ("result", "results", "data", "output", "response", "timestamps"):
            if key in payload:
                text = _extract_transcript(payload[key])
                if text:
                    return text

    return ""


def transcribe(audio_bytes: bytes, filename: str, language: str = "hi-IN", content_type: str = "audio/wav") -> tuple[str, dict | None, int | None]:
    if not SARVAM_API_KEY:
        raise ValueError("Could not transcribe audio. Please try again.")

    start_time = time.perf_counter()
    response = requests.post(
        SARVAM_STT_URL,
        headers=_request_headers(),
        files={"file": (filename, io.BytesIO(audio_bytes), content_type)},
        data={"model": "saaras:v3", "language_code": language},
        timeout=30,
    )
    latency_ms = int((time.perf_counter() - start_time) * 1000)
    duration_seconds = _estimate_wav_duration_seconds(audio_bytes)
    usage_dict = {"audio_duration_seconds": round(duration_seconds, 2)} if duration_seconds else {}
    logger.info(f"⚡ [LLM] Model: saaras:v3 (sarvam) | Flow: transcription | Latency: {latency_ms}ms | Tokens: {usage_dict}")
    
    if response.status_code != 200:
        raise ValueError(f"Could not transcribe audio. Please try again. Sarvam Error: {response.text}")

    transcript = str(response.json().get("transcript", "")).strip()
    if not transcript:
        raise ValueError("No speech detected. Is audio clear? Try again.")
    return transcript, usage_dict, latency_ms


def transcribe_batch(audio_bytes: bytes, filename: str, language: str = "hi-IN", content_type: str = "audio/wav") -> tuple[str, dict | None, int | None]:
    if not SARVAM_API_KEY:
        raise ValueError("Could not transcribe audio. Please try again.")

    try:
        from sarvamai import SarvamAI
    except Exception as exc:
        raise ValueError("Could not transcribe audio. Please try again. Sarvam Batch SDK is unavailable.") from exc

    start_time = time.perf_counter()
    suffix = os.path.splitext(filename or "audio.wav")[1] or ".wav"
    with tempfile.TemporaryDirectory(prefix="sarvam_batch_") as temp_dir:
        input_path = os.path.join(temp_dir, f"input{suffix}")
        with open(input_path, "wb") as input_file:
            input_file.write(audio_bytes)

        try:
            client = SarvamAI(api_subscription_key=SARVAM_API_KEY)
            job = client.speech_to_text_job.create_job(
                model=SARVAM_BATCH_MODEL,
                mode=SARVAM_BATCH_MODE,
                language_code=language,
                with_diarization=SARVAM_BATCH_WITH_DIARIZATION,
                num_speakers=SARVAM_BATCH_NUM_SPEAKERS,
            )

            job.upload_files(file_paths=[input_path])
            job.start()
            job.wait_until_complete()

            file_results = job.get_file_results()
            failed = file_results.get("failed", []) if isinstance(file_results, dict) else []
            if failed:
                first_failure = failed[0] if isinstance(failed[0], dict) else {"error_message": str(failed[0])}
                error_message = first_failure.get("error_message") or "Batch file processing failed."
                raise ValueError(f"Could not transcribe audio. Please try again. Sarvam Batch Error: {error_message}")

            output_dir = os.path.join(temp_dir, "outputs")
            os.makedirs(output_dir, exist_ok=True)
            job.download_outputs(output_dir=output_dir)
            
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            duration_seconds = _estimate_wav_duration_seconds(audio_bytes)
            usage_dict = {"audio_duration_seconds": round(duration_seconds, 2)} if duration_seconds else {}
            logger.info(f"⚡ [LLM] Model: {SARVAM_BATCH_MODEL} (sarvam batch) | Flow: transcription_batch | Latency: {latency_ms}ms | Tokens: {usage_dict}")

            for output_name in sorted(os.listdir(output_dir)):
                if not output_name.lower().endswith(".json"):
                    continue

                output_path = os.path.join(output_dir, output_name)
                with open(output_path, "r", encoding="utf-8") as output_file:
                    payload = json.load(output_file)
                transcript = _extract_transcript(payload)
                if transcript:
                    return transcript, usage_dict, latency_ms

        except ValueError:
            raise
        except Exception as exc:
            raise ValueError(f"Could not transcribe audio. Please try again. Sarvam Batch Error: {exc}") from exc

    raise ValueError("No speech detected. Is audio clear? Try again.")
