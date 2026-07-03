'use client';

import { motion } from 'framer-motion';

export default function UseCasesSection() {
  const cases = [
    {
      title: "Healthcare Intake Forms",
      description: "Doctors dictate patient notes, and V2F automatically fills EMR fields like symptoms, vitals, and diagnosis.",
      color: "bg-emerald-500",
      textColor: "text-emerald-700",
      bgColor: "bg-emerald-50"
    },
    {
      title: "Field Inspections",
      description: "Inspectors speak their observations hands-free while walking the site. Data maps instantly to inspection criteria.",
      color: "bg-primary",
      textColor: "text-primary",
      bgColor: "bg-primary/5"
    },
    {
      title: "Logistics & Delivery",
      description: "Drivers report delivery status, exceptions, and timestamps simply by talking into their devices.",
      color: "bg-indigo-500",
      textColor: "text-indigo-700",
      bgColor: "bg-indigo-50"
    },
    {
      title: "Sales Visits",
      description: "Reps log meeting outcomes and action items by talking to their phone immediately after a customer visit.",
      color: "bg-orange-500",
      textColor: "text-orange-700",
      bgColor: "bg-orange-50"
    },
    {
      title: "BPO & Telecalling",
      description: "Agents capture lead details and call summaries effortlessly via voice, bypassing tedious manual CRM updates.",
      color: "bg-purple-500",
      textColor: "text-purple-700",
      bgColor: "bg-purple-50"
    },
    {
      title: "Government Data Collection",
      description: "Field workers conduct surveys in regional languages, automatically extracting and standardizing demographic data.",
      color: "bg-slate-700",
      textColor: "text-slate-800",
      bgColor: "bg-slate-100"
    }
  ];

  return (
    <section id="use-cases" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Built for any industry
          </h2>
          <p className="text-lg text-slate-600">
            If you have a form, V2F can fill it via voice.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((useCase, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={`rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-lg transition-all ${useCase.bgColor}`}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-3 h-3 rounded-full ${useCase.color}`}></div>
                <h3 className={`text-xl font-bold ${useCase.textColor}`}>{useCase.title}</h3>
              </div>
              <p className="text-slate-700 font-medium leading-relaxed">
                {useCase.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
