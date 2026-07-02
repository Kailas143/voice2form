'use client';

import { motion } from 'framer-motion';
import { Mic, FileText, Globe2, TableProperties, ShieldCheck, Settings, UploadCloud } from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    {
      icon: <Mic className="w-6 h-6 text-primary" />,
      title: "Real-Time Voice Capture",
      description: "Speak naturally while V2F transcribes your voice in real-time with unparalleled accuracy."
    },
    {
      icon: <FileText className="w-6 h-6 text-primary" />,
      title: "AI Form Filling",
      description: "Our proprietary extraction engine maps entities and intent directly into your structured form fields."
    },
    {
      icon: <UploadCloud className="w-6 h-6 text-primary" />,
      title: "Audio Upload Processing",
      description: "Upload recordings, customer calls, interviews, inspections, and voice notes. V2F automatically extracts structured data and fills forms."
    },
    {
      icon: <Globe2 className="w-6 h-6 text-primary" />,
      title: "Multi-Language Support",
      description: "Speak in Malayalam, Hindi, English, and more. Seamlessly translate and map to standardized data."
    },
    {
      icon: <TableProperties className="w-6 h-6 text-primary" />,
      title: "Google Sheets Integration",
      description: "Sync your extracted data directly to Google Sheets instantly upon submission. No Zapier required."
    },
    {
      icon: <Settings className="w-6 h-6 text-primary" />,
      title: "Custom Forms",
      description: "Build any form schema you need. From complex medical intake forms to simple lead generation."
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-primary" />,
      title: "Privacy-First Processing",
      description: "Audio recordings are automatically removed after transcription and AI extraction. V2F retains only the structured form data you choose to save."
    }
  ];

  return (
    <section className="py-24 bg-surface border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Everything you need to automate data entry
          </h2>
          <p className="text-lg text-slate-600">
            Powerful AI tools disguised as a simple voice recorder.
          </p>
        </div>

        {/* 7 items total. First 6 in a 3-column grid, last 1 centered or spanning */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {features.slice(0, 6).map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white p-8 rounded-2xl border border-slate-200 hover:border-primary/30 shadow-sm hover:shadow-xl transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-50 group-hover:border-blue-100 transition-all">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
              <p className="text-slate-600 font-medium leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
        
        {/* The 7th featured item spanning the bottom */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="bg-slate-900 p-8 md:p-12 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center gap-8 group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">NEW</div>
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-slate-700 transition-all">
            {features[6].icon}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mb-3">{features[6].title}</h3>
            <p className="text-slate-300 font-medium leading-relaxed max-w-3xl text-lg">
              {features[6].description}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
