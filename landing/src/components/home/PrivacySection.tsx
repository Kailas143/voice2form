'use client';

import { motion } from 'framer-motion';
import { Lock, Trash2, Cloud, FileCode2 } from 'lucide-react';

export default function PrivacySection() {
  const trustIcons = [
    {
      icon: <Lock className="w-8 h-8 text-emerald-500" />,
      title: "Secure Processing"
    },
    {
      icon: <Trash2 className="w-8 h-8 text-emerald-500" />,
      title: "Automatic Audio Deletion"
    },
    {
      icon: <Cloud className="w-8 h-8 text-emerald-500" />,
      title: "Encrypted Transfer"
    },
    {
      icon: <FileCode2 className="w-8 h-8 text-emerald-500" />,
      title: "Structured Data Export"
    }
  ];

  return (
    <section className="py-24 bg-slate-900 border-t border-slate-800 text-white overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-semibold mb-6">
              <Lock size={16} />
              Dedicated Privacy Section
            </div>
            
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight">
              Your Voice.<br />
              <span className="text-emerald-400">Your Data.</span><br />
              Your Control.
            </h2>
            
            <div className="space-y-6 text-lg text-slate-300 font-medium">
              <p>
                V2F processes audio only for transcription and form extraction.
              </p>
              <p className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                We do not permanently store audio recordings. Once processing is complete, uploaded audio files are automatically deleted from our systems.
              </p>
              <p>
                Your data remains private, secure, and under your control.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            {trustIcons.map((item, index) => (
              <div 
                key={index}
                className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl flex flex-col items-start hover:bg-slate-800 hover:border-slate-600 transition-colors"
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center mb-4">
                  {item.icon}
                </div>
                <h3 className="font-bold text-lg text-white">{item.title}</h3>
              </div>
            ))}
          </motion.div>

        </div>
      </div>
    </section>
  );
}
