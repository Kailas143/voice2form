'use client';

import { motion } from 'framer-motion';
import { Mic, FileText, CheckCircle, Database, ArrowRight } from 'lucide-react';

export default function DemoSection() {
  const steps = [
    {
      icon: <Mic className="w-8 h-8 text-primary" />,
      title: "1. Speak Naturally",
      description: "User speaks: 'Schedule a visit for Michael tomorrow at 2 PM.'",
    },
    {
      icon: <FileText className="w-8 h-8 text-secondary" />,
      title: "2. AI Processing",
      description: "Live transcript is generated & context is analyzed in milliseconds.",
    },
    {
      icon: <CheckCircle className="w-8 h-8 text-accent" />,
      title: "3. Auto-Fill Fields",
      description: "Client Name: Michael, Date: Tomorrow, Time: 2:00 PM.",
    },
    {
      icon: <Database className="w-8 h-8 text-white/900" />,
      title: "4. Sync & Export",
      description: "Data automatically pushes to Google Sheets or your CRM.",
    }
  ];

  return (
    <section id="demo" className="py-24 bg-surface relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-sm font-bold tracking-widest text-primary uppercase mb-3">See V2F In Action</h2>
          <h3 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            How does it actually work?
          </h3>
          <p className="text-lg text-slate-600">
            A seamless pipeline from human speech to structured database records in under 2 seconds.
          </p>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 transform -translate-y-1/2 z-0 rounded-full"></div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10 mb-20">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 relative group hover:shadow-lg transition-shadow"
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 border border-slate-100 group-hover:scale-110 transition-transform">
                  {step.icon}
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h4>
                <p className="text-slate-600 leading-relaxed font-medium">
                  {step.description}
                </p>
                
                {index < steps.length - 1 && (
                  <div className="md:hidden flex justify-center mt-6">
                    <ArrowRight className="text-slate-300" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          
          {/* Audio Upload vs Live Voice Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10 border-t border-slate-200 pt-16">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Mic size={24} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Live Voice</h3>
              </div>
              <ul className="space-y-4 text-slate-700 font-medium flex-1">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                  <span>Real-time processing</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                  <span>Instant field extraction while you speak</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                  <span>Perfect for on-the-go data entry</span>
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-slate-900 rounded-2xl p-8 border border-slate-800 shadow-xl flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg">NEW FEATURE</div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-slate-800 text-primary flex items-center justify-center">
                  <FileText size={24} />
                </div>
                <h3 className="text-2xl font-bold text-white">Audio Upload</h3>
              </div>
              <ul className="space-y-4 text-slate-300 font-medium flex-1">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>Process existing recordings & voice notes</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>Ideal for bulk audio workflows</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>Extract data from meeting & customer support calls</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>Supports MP3, WAV, M4A, and OGG</span>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
