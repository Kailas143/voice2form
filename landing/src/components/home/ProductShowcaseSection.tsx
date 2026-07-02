'use client';

import { motion } from 'framer-motion';

export default function ProductShowcaseSection() {
  return (
    <section className="py-24 bg-slate-50 border-t border-slate-200 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            A Dashboard Built for Speed
          </h2>
          <p className="text-lg text-slate-600">
            Manage your templates, review voice captures, and export to Sheets—all from a beautifully simple interface.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Glassmorphic Mockup Container */}
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            
            {/* Mockup Topbar */}
            <div className="h-12 bg-slate-50 border-b border-slate-200 flex items-center px-4 gap-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-white text-slate-400 text-xs px-4 py-1.5 rounded-md border border-slate-200 w-1/3 text-center flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                  app.v2f.ai
                </div>
              </div>
            </div>

            {/* Mockup Body */}
            <div className="flex h-[400px] md:h-[500px]">
              {/* Sidebar */}
              <div className="w-48 md:w-64 bg-slate-50 border-r border-slate-200 p-4 hidden sm:flex flex-col gap-2">
                <div className="font-bold text-slate-800 mb-4 px-2">V2F Dashboard</div>
                {['Workspaces', 'Templates', 'Integrations', 'Settings'].map((item, i) => (
                  <div key={i} className={`px-3 py-2 rounded-lg text-sm font-medium ${i === 0 ? 'bg-primary/10 text-primary' : 'text-slate-600'}`}>
                    {item}
                  </div>
                ))}
              </div>

              {/* Main Content Area */}
              <div className="flex-1 bg-white p-6 md:p-8 overflow-hidden relative">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Lead Capture Workspace</h3>
                    <p className="text-sm text-slate-500">24 submissions today</p>
                  </div>
                  <div className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-lg">
                    Export to Sheets
                  </div>
                </div>

                {/* Table Mockup */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 grid grid-cols-4 px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    <div>Date</div>
                    <div>Name</div>
                    <div>Phone</div>
                    <div>Status</div>
                  </div>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="border-b border-slate-100 grid grid-cols-4 px-4 py-4 text-sm text-slate-700 items-center">
                      <div className="text-slate-500">Just now</div>
                      <div className="font-medium text-slate-900">Michael Scott</div>
                      <div>987-654-3210</div>
                      <div><span className="bg-green-100 text-green-700 px-2 py-1 rounded-md text-xs font-semibold">Processed</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
