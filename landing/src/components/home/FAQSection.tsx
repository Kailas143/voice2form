'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export default function FAQSection() {
  const faqs = [
    {
      question: "How does voice-to-form work?",
      answer: "V2F uses advanced AI to transcribe your speech in real-time and extract key entities (like names, dates, amounts). It then automatically maps these entities to the corresponding fields in your predefined forms."
    },
    {
      question: "Which languages are supported?",
      answer: "We currently support English, Hindi, and Malayalam, with more regional and international languages being added regularly. The AI understands context and mixed-language speech seamlessly."
    },
    {
      question: "Is my data secure?",
      answer: "Yes, we use enterprise-grade encryption. Your audio and transcripts are processed securely and are never used to train public AI models. We comply with standard data protection regulations."
    },
    {
      question: "Do you store audio recordings?",
      answer: "No. Audio files are processed for transcription and data extraction, then automatically deleted. V2F is designed with privacy-first principles and does not maintain a permanent archive of uploaded recordings."
    },
    {
      question: "Can I connect Google Sheets?",
      answer: "Absolutely. Our platform has native Google Sheets integration. Once a form is filled via voice, the structured data can be instantly synced to your connected Google Sheet."
    },
    {
      question: "Do I need technical knowledge to use V2F?",
      answer: "Not at all. If you know how to use a voice recorder on your phone, you can use V2F. Setting up forms is as simple as typing field names, and the AI handles all the complex mapping."
    }
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-24 bg-surface border-t border-slate-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 text-left flex justify-between items-center focus:outline-none"
              >
                <span className="font-bold text-lg text-slate-900">{faq.question}</span>
                <ChevronDown 
                  className={`text-slate-400 transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''}`} 
                  size={20} 
                />
              </button>
              
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="px-6 pb-6 text-slate-600 leading-relaxed font-medium">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
