'use client';

export default function TrustSection() {
  return (
    <section className="py-12 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-6">
          Built on Trusted AI Infrastructure
        </p>
        
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl text-slate-800">Google Gemini</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl text-slate-800">Deepgram</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl text-slate-800">Sarvam AI</span>
          </div>
        </div>
      </div>
    </section>
  );
}
