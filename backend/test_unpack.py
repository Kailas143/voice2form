def transcribe():
    return "hello", {"tokens": 10}, 100

transcript, usage, latency = transcribe()
print(repr(transcript))
