import asyncio
from services import gemini

async def main():
    transcript, usage, latency = gemini.transcribe_audio(b"fake audio", "audio/wav")
    print("type of transcript:", type(transcript))
    print("value:", transcript)

asyncio.run(main())
