'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Mic, FileText, CheckCircle2, UploadCloud, FileAudio, FileUp, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState<'live' | 'upload'>('live');
  const [isHovered, setIsHovered] = useState(false);
  
  // Auto-switch tabs every 10 seconds
  useEffect(() => {
    if (isHovered) return;
    
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev === 'live' ? 'upload' : 'live'));
    }, 10000);
    
    return () => clearInterval(interval);
  }, [isHovered]);

  return (
    <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden bg-white">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-surface via-white to-white opacity-60 z-0"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-6"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-green-200 bg-green-50 text-green-700 text-sm font-semibold shadow-sm">
              <CheckCircle2 size={16} className="text-accent" />
              Live Voice & Audio Upload Support
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
              Turn Conversations Into <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Structured Data</span>
            </h1>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed max-w-3xl mx-auto">
              Capture inspections, surveys, customer information, healthcare records, and field reports using voice. V2F automatically fills forms in real time.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link 
              href="http://localhost:5173"
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-xl hover:-translate-y-1"
            >
              Start Free
            </Link>
            <a 
              href="#demo"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-sm hover:shadow-md group"
            >
              <Play size={20} className="text-primary group-hover:scale-110 transition-transform" />
              Watch Demo
            </a>
          </motion.div>
        </div>

        {/* Hero Visual Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="relative max-w-5xl mx-auto"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-accent/5 rounded-3xl transform rotate-1 scale-105 -z-10 blur-xl"></div>
          
          {/* Tabs */}
          <div className="flex justify-center mb-6">
            <div className="bg-white rounded-full p-1 shadow-sm border border-slate-200 inline-flex relative">
              <div 
                className="absolute top-1 bottom-1 rounded-full bg-slate-900 transition-all duration-300 ease-out z-0"
                style={{ 
                  left: activeTab === 'live' ? '4px' : 'calc(50% + 2px)', 
                  width: 'calc(50% - 6px)' 
                }}
              />
              
              <button
                onClick={() => setActiveTab('live')}
                className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-colors ${
                  activeTab === 'live' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mic size={16} className={activeTab === 'live' ? 'text-accent' : ''} />
                Live Voice
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-colors ${
                  activeTab === 'upload' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UploadCloud size={16} className={activeTab === 'upload' ? 'text-blue-400' : ''} />
                Upload Audio
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col md:flex-row relative">
            
            {/* Left Column: Input Method */}
            <div className="w-full md:w-1/2 p-8 border-b md:border-b-0 md:border-r border-slate-100 bg-surface relative min-h-[350px]">
              <AnimatePresence mode="wait">
                {activeTab === 'live' ? (
                  <motion.div
                    key="live"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 p-8"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-primary">
                        <Mic size={20} className="animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">Live Voice Capture</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Recording...
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-4 font-medium text-slate-700 leading-relaxed text-lg italic bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.5 }}
                      >
                        "Customer name is <span className="text-primary font-bold">John Smith</span>. Phone number is <span className="text-primary font-bold">9876543210</span>. Location is <span className="text-primary font-bold">Kochi</span>."
                      </motion.p>
                      <div className="absolute -right-3 -bottom-3 bg-white w-6 h-6 border border-slate-200 rounded-full flex items-center justify-center transform rotate-45 z-10"></div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 p-8"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <UploadCloud size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">File Processing</h3>
                        <p className="text-xs text-slate-500">Audio uploaded</p>
                      </div>
                    </div>

                    <div className="bg-white border-2 border-dashed border-indigo-200 rounded-xl p-6 relative overflow-hidden group cursor-pointer hover:border-indigo-400 transition-colors">
                      {/* Drag & Drop Visual State */}
                      <motion.div 
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 0.2, delay: 1 }}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20"
                      >
                        <FileUp className="text-indigo-300 w-10 h-10 mb-2" />
                        <span className="text-sm font-semibold text-slate-500">Drop customer-call.mp3 here</span>
                      </motion.div>

                      {/* File Card & Progress State */}
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 1.2 }}
                        className="relative z-10"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <FileAudio size={24} />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-sm text-slate-800">customer-call.mp3</div>
                            <div className="text-xs text-slate-500">2.4 MB</div>
                          </div>
                        </div>

                        {/* Progress Bar & Processing */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-semibold">
                            <motion.span 
                              initial={{ opacity: 1 }}
                              animate={{ opacity: 0 }}
                              transition={{ delay: 3 }}
                              className="text-slate-500"
                            >
                              Uploading...
                            </motion.span>
                            <motion.span 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 3 }}
                              className="absolute left-0 text-indigo-600 flex items-center gap-1"
                            >
                              <Sparkles size={12} className="animate-pulse" /> AI Processing...
                            </motion.span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: '100%' }}
                              transition={{ duration: 1.5, delay: 1.5, ease: "linear" }}
                              className="absolute top-0 left-0 bottom-0 bg-indigo-500"
                            />
                            {/* Processing pulse effect after upload */}
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ delay: 3, duration: 1.5, repeat: Infinity }}
                              className="absolute inset-0 bg-white/40"
                            />
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {/* Resulting Transcript Snippet */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 4.5, duration: 0.5 }}
                      className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 italic shadow-inner"
                    >
                      "Customer name is <span className="text-indigo-600 font-bold">John Smith</span>. Phone number is <span className="text-indigo-600 font-bold">9876543210</span>. Location is <span className="text-indigo-600 font-bold">Kochi</span>."
                    </motion.div>

                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: Auto Form Fill */}
            <div className="w-full md:w-1/2 p-8 bg-white relative min-h-[350px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-secondary">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Real-Time Extraction</h3>
                  <p className="text-xs text-slate-500">AI mapping to fields</p>
                </div>
              </div>

              {/* Tying Key to activeTab resets animation on switch */}
              <div className="space-y-5" key={activeTab}>
                <motion.div 
                  initial={{ width: '10%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: activeTab === 'live' ? 1 : 5 }}
                  className="bg-slate-50 p-4 rounded-xl border border-green-200 shadow-sm relative overflow-hidden"
                >
                  <div className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Customer Name</div>
                  <div className="font-medium text-slate-900 flex justify-between items-center">
                    John Smith
                    <CheckCircle2 size={16} className="text-accent" />
                  </div>
                </motion.div>
                
                <motion.div 
                  initial={{ width: '10%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: activeTab === 'live' ? 1.5 : 5.5 }}
                  className="bg-slate-50 p-4 rounded-xl border border-green-200 shadow-sm relative overflow-hidden"
                >
                  <div className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Phone Number</div>
                  <div className="font-medium text-slate-900 flex justify-between items-center">
                    9876543210
                    <CheckCircle2 size={16} className="text-accent" />
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ width: '10%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: activeTab === 'live' ? 2 : 6 }}
                  className="bg-slate-50 p-4 rounded-xl border border-green-200 shadow-sm relative overflow-hidden"
                >
                  <div className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Location</div>
                  <div className="font-medium text-slate-900 flex justify-between items-center">
                    Kochi
                    <CheckCircle2 size={16} className="text-accent" />
                  </div>
                </motion.div>
              </div>
            </div>
            
            {/* Center Arrow Overlay */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-lg border border-slate-100 items-center justify-center z-20">
              <motion.svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                className="text-accent"
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </motion.svg>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
