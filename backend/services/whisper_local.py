import os
import tempfile

def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    try:
        import whisper
    except ImportError as exc:
        raise ValueError("Whisper is not installed. Please install openai-whisper.") from exc

    # Write bytes to a temporary file because Whisper expects a file path
    # Extract extension from the original filename to preserve format
    ext = os.path.splitext(filename)[1]
    if not ext:
        ext = ".wav"  # fallback extension

    fd, temp_path = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(audio_bytes)
        
        # Load the base model
        model = whisper.load_model("base")
        
        # Transcribe
        result = model.transcribe(temp_path)
        
        text = result.get("text", "").strip()
        if not text:
            raise ValueError("No speech detected by Whisper.")
            
        return text
    except Exception as exc:
        raise ValueError(f"Whisper STT failed: {exc}") from exc
    finally:
        # Cleanup temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
