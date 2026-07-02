'use client';

import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';

export default function ROISection() {
  return (
    <section className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-sm font-bold tracking-widest text-secondary uppercase mb-3">The Cost of Manual Data Entry</h2>
          <h3 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Stop wasting time typing.
          </h3>
          <p className="text-lg text-slate-600">
            Manual data entry is slow, error-prone, and expensive. V2F automates the entire process so your team can focus on real work.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Manual / Old Way */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-slate-50 rounded-3xl p-8 md:p-12 border border-slate-200"
          >
            <h4 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                <X size={20} />
              </span>
              The Old Way
            </h4>
            
            <ul className="space-y-6">
              {[
                "Typing forms on mobile devices",
                "High rate of human errors",
                "Slow collection and sync times",
                "Repetitive, draining busywork"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-4 text-slate-600 font-medium text-lg">
                  <X className="text-slate-400 mt-1 flex-shrink-0" size={20} />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* V2F / New Way */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-primary rounded-3xl p-8 md:p-12 border border-primary text-white shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600 to-transparent opacity-50 z-0"></div>
            
            <div className="relative z-10">
              <h4 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                  <Check size={20} />
                </span>
                With V2F
              </h4>
              
              <ul className="space-y-6">
                {[
                  "Speak naturally to capture data",
                  "Perfect AI extraction & mapping",
                  "Real-time capture and availability",
                  "Automated, effortless workflow"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 font-medium text-lg text-blue-50">
                    <Check className="text-accent mt-1 flex-shrink-0" size={20} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
