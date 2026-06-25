// public/pcm-processor.js
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._frameCount = 0;
    this._flushEvery = 16; // 16 × 128 samples = 2048 samples = ~128ms chunks

    this.port.onmessage = (e) => {
      if (e.data?.type === 'flush' && this._buffer.length > 0) {
        // send whatever is left in the buffer
        const merged = new Int16Array(
          this._buffer.reduce((a, b) => a + b.length, 0)
        );
        let offset = 0;
        for (const chunk of this._buffer) { 
          merged.set(chunk, offset); 
          offset += chunk.length; 
        }
        this.port.postMessage(merged.buffer, [merged.buffer]);
        this._buffer = [];
        this._frameCount = 0;
      }
    };
  }

  process(inputs) {
    const input = inputs[0][0]; // mono channel, Float32 samples
    if (!input) return true;

    // Convert Float32 → Int16 (linear16 PCM)
    const int16 = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const clamped = Math.max(-1, Math.min(1, input[i]));
      int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
    }

    this._buffer.push(int16);
    this._frameCount++;

    if (this._frameCount >= this._flushEvery) {
      const merged = new Int16Array(this._buffer.reduce((a, b) => a + b.length, 0));
      let offset = 0;
      for (const chunk of this._buffer) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      this.port.postMessage(merged.buffer, [merged.buffer]);
      this._buffer = [];
      this._frameCount = 0;
    }

    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
