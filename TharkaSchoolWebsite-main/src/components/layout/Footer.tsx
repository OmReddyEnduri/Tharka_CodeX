import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Globe } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-200">
      <div className="container px-4 py-16 md:py-24">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Logo & Description */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 transition-transform group-hover:scale-110">
                <span className="font-mono text-xl font-bold text-highlight">
                  {"{"}<span className="text-gold">/</span>{"}"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-white">THARKA</span>
                <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500">HIGH SCHOOL</span>
              </div>
            </Link>
            <p className="text-slate-400 leading-relaxed text-sm md:text-base">
              India's First Future-Ready Coding School. We are empowering the next generation with logical thinking and digital literacy.
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-xs font-bold text-primary border border-primary/20">
                The Coding School
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-6">
            <h4 className="text-lg font-bold text-white uppercase tracking-wider">Explore</h4>
            <nav className="flex flex-col gap-4">
              <Link to="/about" className="text-slate-400 hover:text-highlight transition-colors flex items-center gap-2 group">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-highlight transition-colors" />
                About Us
              </Link>
              <Link to="/courses" className="text-slate-400 hover:text-highlight transition-colors flex items-center gap-2 group">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-highlight transition-colors" />
                Curriculum
              </Link>
              <Link to="/admissions" className="text-slate-400 hover:text-highlight transition-colors flex items-center gap-2 group">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-highlight transition-colors" />
                Admissions
              </Link>
              <Link to="/contact" className="text-slate-400 hover:text-highlight transition-colors flex items-center gap-2 group">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-highlight transition-colors" />
                Contact Us
              </Link>
            </nav>
          </div>

          {/* Programs */}
          <div className="space-y-6">
            <h4 className="text-lg font-bold text-white uppercase tracking-wider">Programs</h4>
            <nav className="flex flex-col gap-4">
              <span className="text-slate-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Python & Data Science
              </span>
              <span className="text-slate-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Web Development
              </span>
              <span className="text-slate-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Data Structures
              </span>
              <span className="text-slate-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                AI & Robotics
              </span>
            </nav>
          </div>

          {/* Contact Info */}
          <div className="space-y-6">
            <h4 className="text-lg font-bold text-white uppercase tracking-wider">Get in Touch</h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-slate-400">
                <MapPin className="h-5 w-5 text-highlight shrink-0 mt-0.5" />
                <span className="text-sm leading-relaxed">
                  Vinukonda, Palnadu District<br />
                  Andhra Pradesh – 522 647
                </span>
              </div>
              <a href="tel:+919686054029" className="flex items-center gap-3 text-slate-400 hover:text-highlight transition-colors group">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 group-hover:bg-highlight/10 transition-colors">
                  <Phone className="h-4 w-4" />
                </div>
                <span className="text-sm font-bold">96860 54029</span>
              </a>
              <a href="mailto:tharkaschool@gmail.com" className="flex items-center gap-3 text-slate-400 hover:text-highlight transition-colors group">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 group-hover:bg-highlight/10 transition-colors">
                  <Mail className="h-4 w-4" />
                </div>
                <span className="text-sm font-bold">tharkaschool@gmail.com</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-slate-800">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-sm text-slate-500 font-medium">
              © 2025 Tharka High School. All rights reserved.
            </p>
            <div className="flex gap-4">
                <Link to="/privacy-policy" className="text-slate-400 hover:text-highlight transition-colors text-sm">
                    Privacy Policy
                </Link>
                <Link to="/terms-and-conditions" className="text-slate-400 hover:text-highlight transition-colors text-sm">
                    Terms & Conditions
                </Link>
                <Link to="/refund-policy" className="text-slate-400 hover:text-highlight transition-colors text-sm">
                    Refund Policy
                </Link>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-highlight/5 px-4 py-1.5 border border-highlight/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-gold"></span>
              </span>
              <p className="text-xs font-bold text-gold uppercase tracking-widest">
                Commencing June 2026
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
