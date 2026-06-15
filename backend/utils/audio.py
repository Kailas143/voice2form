from config import ALLOWED_AUDIO_TYPES, MAX_AUDIO_MB


def validate_audio_upload(content_type: str | None, size_bytes: int) -> None:
    base_type = content_type.split(";")[0] if content_type else ""
    if base_type not in ALLOWED_AUDIO_TYPES:
        raise ValueError("Please upload WAV, MP3, OGG, or M4A.")
    if size_bytes > MAX_AUDIO_MB * 1024 * 1024:
        raise ValueError(f"File too large. Max {MAX_AUDIO_MB}MB supported.")


def validate_language(language: str, supported_languages: tuple[str, ...]) -> str:
    if language not in supported_languages:
        return supported_languages[0]
    return language

def convert_to_wav(audio_bytes: bytes, current_ext: str) -> tuple[bytes, str]:
    import tempfile
    import subprocess
    import os

    if not current_ext:
        current_ext = ".webm"
    
    fd_in, temp_in = tempfile.mkstemp(suffix=current_ext)
    fd_out, temp_out = tempfile.mkstemp(suffix=".wav")
    
    try:
        with os.fdopen(fd_in, 'wb') as f:
            f.write(audio_bytes)
        
        subprocess.run([
            "ffmpeg", "-y", "-i", temp_in, "-ar", "16000", "-ac", "1", temp_out
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        with open(temp_out, 'rb') as f:
            wav_bytes = f.read()
            
        return wav_bytes, "audio/wav"
    finally:
        if os.path.exists(temp_in):
            os.remove(temp_in)
        if os.path.exists(temp_out):
            os.remove(temp_out)
