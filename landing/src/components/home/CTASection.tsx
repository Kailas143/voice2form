import Link from 'next/link';

export default function CTASection() {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary to-blue-900 opacity-5"></div>
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
          Ready to Eliminate Manual Data Entry?
        </h2>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          Start capturing structured data through voice in minutes. No credit card required.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link 
            href="http://localhost:5173"
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-xl hover:-translate-y-1"
          >
            Start Free
          </Link>
          <Link 
            href="/contact"
            className="w-full sm:w-auto bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-sm hover:shadow-md"
          >
            Book Demo
          </Link>
        </div>
      </div>
    </section>
  );
}
