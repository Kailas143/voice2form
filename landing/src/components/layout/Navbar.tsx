'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-transparent ${
        isScrolled
          ? 'bg-white/80 backdrop-blur-md shadow-sm border-slate-200 py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 flex items-center justify-center transition-transform group-hover:scale-105">
                <img 
                  src="/small-logo.png" 
                  alt="V2F Logo" 
                  className="w-8 h-8 object-contain logo-sound-wave"
                />
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-slate-900">
                V2F
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex space-x-8">
            <Link href="/features" className="text-slate-600 hover:text-primary font-medium transition-colors">
              Features
            </Link>
            <Link href="/#use-cases" className="text-slate-600 hover:text-primary font-medium transition-colors">
              Use Cases
            </Link>
            <Link href="/pricing" className="text-slate-600 hover:text-primary font-medium transition-colors">
              Pricing
            </Link>
            <Link href="/blog" className="text-slate-600 hover:text-primary font-medium transition-colors">
              Blog
            </Link>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href="http://localhost:5173" className="text-slate-600 hover:text-primary font-medium transition-colors">
              Sign In
            </Link>
            <Link
              href="http://localhost:5173"
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md"
            >
              Start Free
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-600 hover:text-slate-900 focus:outline-none"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 shadow-lg absolute top-full left-0 w-full">
          <div className="px-4 pt-2 pb-6 space-y-1">
            <Link href="/features" className="block px-3 py-3 rounded-md text-base font-medium text-slate-700 hover:text-primary hover:bg-slate-50">
              Features
            </Link>
            <Link href="/#use-cases" className="block px-3 py-3 rounded-md text-base font-medium text-slate-700 hover:text-primary hover:bg-slate-50">
              Use Cases
            </Link>
            <Link href="/pricing" className="block px-3 py-3 rounded-md text-base font-medium text-slate-700 hover:text-primary hover:bg-slate-50">
              Pricing
            </Link>
            <Link href="/blog" className="block px-3 py-3 rounded-md text-base font-medium text-slate-700 hover:text-primary hover:bg-slate-50">
              Blog
            </Link>
            <div className="pt-4 flex flex-col gap-3 px-3">
              <Link href="http://localhost:5173" className="w-full text-center border border-slate-200 bg-white text-slate-700 px-4 py-2.5 rounded-lg font-medium">
                Sign In
              </Link>
              <Link href="http://localhost:5173" className="w-full text-center bg-primary text-white px-4 py-2.5 rounded-lg font-semibold">
                Start Free
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
