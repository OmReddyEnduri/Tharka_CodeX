import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, GraduationCap, Code } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden gradient-hero py-20 md:py-32 lg:py-40">
      {/* Dynamic Background Grid */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/50 to-primary/80" />
      </div>

      {/* Floating Code Symbols */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-[10%] text-6xl font-mono text-white/10 animate-float select-none">{"{ }"}</div>
        <div className="absolute top-40 right-[15%] text-4xl font-mono text-white/10 animate-float select-none" style={{ animationDelay: '1s' }}>{"</>"}</div>
        <div className="absolute bottom-20 left-[20%] text-5xl font-mono text-white/10 animate-float select-none" style={{ animationDelay: '2s' }}>{"[ ]"}</div>
        <div className="absolute bottom-40 right-[25%] text-3xl font-mono text-white/10 animate-float select-none" style={{ animationDelay: '1.5s' }}>{"( )"}</div>
        
        {/* Decorative Glows */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-highlight/20 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      <div className="container relative z-10 px-4 md:px-6">
        <div className="mx-auto max-w-5xl text-center">
          {/* Logo Badge */}
          <div className="mb-10 inline-flex items-center justify-center animate-scale-in">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-highlight to-gold rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-white/20 bg-primary/40 backdrop-blur-xl shadow-2xl transition-transform hover:scale-105">
                <span className="font-mono text-5xl font-bold text-highlight">
                  {"{"}<span className="text-gold">/</span>{"}"}
                </span>
              </div>
            </div>
          </div>

          {/* School Name & Title */}
          <div className="space-y-4 mb-10">
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter text-white animate-slide-up">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-highlight via-gold to-highlight bg-[length:200%_auto] animate-shimmer">
                THARKA
              </span>
            </h1>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xl md:text-3xl font-bold tracking-[0.4em] text-white/90 uppercase animate-slide-up" style={{ animationDelay: "0.1s" }}>
                High School
              </p>
              <div className="h-1 w-24 bg-gradient-to-r from-transparent via-gold to-transparent rounded-full animate-slide-up" style={{ animationDelay: "0.15s" }} />
              <p className="text-lg md:text-2xl italic text-gold font-semibold animate-slide-up" style={{ animationDelay: "0.2s" }}>
                The Coding School
              </p>
            </div>
          </div>

          {/* Tagline */}
          <p className="mb-12 text-lg md:text-2xl text-blue-50/80 max-w-3xl mx-auto leading-relaxed animate-slide-up font-medium" style={{ animationDelay: "0.3s" }}>
            Empowering Young Minds with Coding Skills — <br className="hidden md:block" />
            <span className="text-white font-bold">India's First Future-Ready Coding School</span>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12 animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <Button variant="hero" size="xl" asChild>
              <Link to="/about">
                More about us
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="hero" size="xl" asChild>
              <Link to="/admissions">
                <GraduationCap className="h-5 w-5" />
                Enroll For School
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl" asChild>
              <Link to="/contact">Contact Us</Link>
            </Button>
          </div>

          {/* Commences Banner */}
          <div className="inline-flex items-center gap-3 rounded-full bg-white/5 backdrop-blur-md px-8 py-4 border border-white/10 shadow-2xl animate-slide-up" style={{ animationDelay: "0.5s" }}>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-gold"></span>
            </span>
            <span className="text-white font-bold tracking-wide">ADMISSIONS OPEN FOR JUNE 2026</span>
          </div>
        </div>
      </div>

      {/* Bottom Wave - More subtle and integrated */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
          <path
            d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            className="fill-background"
          />
        </svg>
      </div>
    </section>
  );
}
