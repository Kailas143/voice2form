'use client';

import { motion } from 'framer-motion';

export default function BenefitsSection() {
  const metrics = [
    { value: "80%", label: "Less Manual Data Entry" },
    { value: "3x", label: "Faster Form Completion" },
    { value: "95%", label: "Field Extraction Accuracy" },
    { value: "24/7", label: "AI Processing Availability" }
  ];

  return (
    <section className="py-24 bg-primary text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-blue-500/20 to-transparent opacity-50"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 divide-x-0 md:divide-x divide-white/10">
          {metrics.map((metric, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center px-4"
            >
              <div className="text-4xl md:text-6xl font-extrabold tracking-tight mb-2 text-accent">
                {metric.value}
              </div>
              <div className="text-blue-100 font-medium text-lg">
                {metric.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
