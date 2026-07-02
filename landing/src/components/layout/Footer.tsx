import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 py-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4 group">
              <div className="w-8 h-8 flex items-center justify-center transition-transform group-hover:scale-105">
                <img
                  src="/small-logo.png"
                  alt="V2F Logo"
                  className="w-7 h-7 object-contain logo-sound-wave"
                />
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">
                V2F
              </span>
            </Link>
            <p className="text-sm text-slate-400">
              Voice-to-Form AI Platform. Turn conversations into structured data instantly.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/#use-cases" className="hover:text-white transition-colors">Use Cases</Link></li>
              <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Sales</Link></li>
              <li><Link href="mailto:support@v2f.ai" className="hover:text-white transition-colors">Support</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 text-sm text-center text-slate-500">
          &copy; {new Date().getFullYear()} V2F. All rights reserved. <br /> A product by <a href="https://aurvyz.com" target="_blank" rel="noopener noreferrer">Aurvyz AI</a>.
        </div>
      </div>
    </footer>
  );
}
