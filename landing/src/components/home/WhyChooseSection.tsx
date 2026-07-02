'use client';

import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

export default function WhyChooseSection() {
  const reasons = [
    "Eliminate manual data entry",
    "Capture data hands-free",
    "Works flawlessly on mobile devices",
    "Multi-language support (English, Hindi, Malayalam)",
    "Instant Google Sheets integration",
    "Enterprise-grade security"
  ];

  return (
    <section className="py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 md:p-16 shadow-lg border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-6">
                Why Teams Choose V2F
              </h2>
              <p className="text-lg text-slate-600 mb-8">
                We've stripped away the complexity of traditional data collection tools and replaced it with a natural, frictionless voice interface.
              </p>
              
              <ul className="space-y-4">
                {reasons.map((reason, i) => (
                  <motion.li 
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="flex items-center gap-3 text-lg font-medium text-slate-800"
                  >
                    <CheckCircle2 className="text-accent flex-shrink-0" size={24} />
                    {reason}
                  </motion.li>
                ))}
              </ul>
            </div>
            
            <div className="relative h-full min-h-[300px] rounded-2xl bg-slate-900 overflow-hidden flex items-center justify-center p-8">
              {/* Abstract decoration to represent data flow */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/40 to-transparent"></div>
              
              <div className="relative z-10 w-full max-w-sm space-y-4">
                <div className="h-4 bg-slate-800 rounded-full w-3/4"></div>
                <div className="h-4 bg-slate-800 rounded-full w-full"></div>
                <div className="h-4 bg-slate-800 rounded-full w-5/6"></div>
                
                <div className="flex items-center gap-4 mt-8">
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/><path d="M2 12h20"/><path d="m5 17-3-5 3-5"/><path d="m19 17 3-5-3-5"/></svg>
                  </div>
                  <div className="flex-1">
                    <div className="h-3 bg-accent/50 rounded-full w-1/2 mb-2"></div>
                    <div className="h-3 bg-accent/30 rounded-full w-1/3"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
