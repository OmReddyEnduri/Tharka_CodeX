import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Phone } from "lucide-react";

export function CTASection() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background with Gradient and Pattern */}
      <div className="absolute inset-0 gradient-primary" />
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '30px 30px'
        }}
      />
      
      <div className="container relative z-10 px-4 md:px-6">
        <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-xl border border-white/20 rounded-[3rem] p-12 md:p-16 text-center shadow-2xl">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
            Ready to <span className="text-gold">Shape</span> Your Future?
          </h2>
          <p className="text-blue-50/90 text-xl md:text-2xl mb-12 max-w-2xl mx-auto leading-relaxed">
            Admissions are now <span className="text-white font-bold underline decoration-gold decoration-4 underline-offset-8">OPEN</span> for 2026. 
            Join India's first future-ready coding school today.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Button variant="hero" size="xl" className="h-16 px-10 text-lg group shadow-glow" asChild>
              <Link to="/admissions">
                <GraduationCap className="h-6 w-6 transition-transform group-hover:scale-110" />
                Apply for Admission
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl" className="h-16 px-10 text-lg border-white/30 hover:bg-white/10" asChild>
              <Link to="/contact">
                <Phone className="h-6 w-6" />
                Contact Us
              </Link>
            </Button>
          </div>
          
          <p className="mt-8 text-blue-100/60 text-sm font-medium tracking-widest uppercase">
            Limited Seats Available • Commencing June 2026
          </p>
        </div>
      </div>

      {/* Decorative Blur Spheres */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-highlight/30 rounded-full blur-[120px]" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-gold/20 rounded-full blur-[120px]" />
    </section>
  );
}
