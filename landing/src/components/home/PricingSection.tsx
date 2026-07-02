'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Link from 'next/link';

export default function PricingSection() {
  const plans = [
    {
      name: "Free",
      price: "₹0",
      period: "/month",
      description: "Perfect for individuals and small tests.",
      features: [
        "50 submissions/month",
        "3 active forms",
        "Google Sheets export",
        "Community support"
      ],
      cta: "Start Free",
      popular: false
    },
    {
      name: "Professional",
      price: "₹999",
      period: "/month",
      description: "For teams replacing manual data entry.",
      features: [
        "1,000 submissions/month",
        "Unlimited forms",
        "AI data extraction",
        "Multi-language support",
        "Email support"
      ],
      cta: "Upgrade to Pro",
      popular: true
    },
    {
      name: "Business",
      price: "Custom",
      period: "",
      description: "For enterprise scale and security.",
      features: [
        "10,000+ submissions/month",
        "Team access & roles",
        "Advanced Analytics",
        "API access",
        "Priority 24/7 support"
      ],
      cta: "Contact Sales",
      popular: false
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Simple, predictable pricing
          </h2>
          <p className="text-lg text-slate-600">
            Start for free, upgrade when you need more scale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`rounded-3xl p-8 border ${
                plan.popular 
                  ? 'border-primary bg-primary text-white shadow-xl relative transform md:-translate-y-4' 
                  : 'border-slate-200 bg-white text-slate-900 shadow-sm'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-accent text-white text-xs font-bold uppercase tracking-wider py-1 px-4 rounded-full">
                  Most Popular
                </div>
              )}
              
              <h3 className={`text-xl font-bold mb-2 ${plan.popular ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
              <p className={`text-sm mb-6 ${plan.popular ? 'text-blue-100' : 'text-slate-500'}`}>{plan.description}</p>
              
              <div className="mb-8">
                <span className="text-5xl font-extrabold tracking-tight">{plan.price}</span>
                <span className={`text-lg font-medium ${plan.popular ? 'text-blue-100' : 'text-slate-500'}`}>{plan.period}</span>
              </div>
              
              <Link 
                href={plan.name === 'Business' ? '/contact' : 'http://localhost:5173'}
                className={`block w-full text-center py-3 px-4 rounded-xl font-bold transition-all mb-8 ${
                  plan.popular 
                    ? 'bg-white text-primary hover:bg-slate-50' 
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {plan.cta}
              </Link>
              
              <ul className="space-y-4">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check size={20} className={plan.popular ? 'text-accent' : 'text-primary'} />
                    <span className={`font-medium ${plan.popular ? 'text-white' : 'text-slate-700'}`}>{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
