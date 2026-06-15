import io

import requests

from config import SARVAM_API_KEY

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"


def transcribe(audio_bytes: bytes, filename: str, language: str = "hi-IN", content_type: str = "audio/wav") -> str:
    if not SARVAM_API_KEY:
        raise ValueError("Could not transcribe audio. Please try again.")

    response = requests.post(
        SARVAM_STT_URL,
        headers={"api-subscription-key": SARVAM_API_KEY},
        files={"file": (filename, io.BytesIO(audio_bytes), content_type)},
        data={"model": "saaras:v3", "language_code": language},
        timeout=30,
    )
    if response.status_code != 200:
        raise ValueError(f"Could not transcribe audio. Please try again. Sarvam Error: {response.text}")

    transcript = str(response.json().get("transcript", "")).strip()
    if not transcript:
        raise ValueError("No speech detected. Is audio clear? Try again.")
    return transcript
