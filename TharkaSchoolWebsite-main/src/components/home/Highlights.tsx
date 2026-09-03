import { Star, ShieldCheck, Zap, Users, Trophy, Target } from "lucide-react";

const highlights = [
  {
    icon: Target,
    title: "India's First",
    description: "Future-Ready Coding School commencing June 2026."
  },
  {
    icon: Zap,
    title: "Job-Ready Skills",
    description: "Equipping students with industry-standard expertise from school level."
  },
  {
    icon: ShieldCheck,
    title: "Holistic Growth",
    description: "Balanced development of Mind, Body, and Spirit for future leaders."
  },
  {
    icon: Trophy,
    title: "IIT Mentorship",
    description: "Led and designed by IIT Bombay M.Tech graduates."
  },
  {
    icon: Users,
    title: "Expert Guidance",
    description: "20 years of combined industry and academic excellence."
  },
  {
    icon: Star,
    title: "Direct Mentorship",
    description: "Personalized path for successful high-growth tech careers."
  },
];

export function Highlights() {
  return (
    <section className="relative py-24 overflow-hidden bg-slate-50">
      {/* Decorative background element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 gradient-accent opacity-50" />
      
      <div className="container px-4 md:px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-primary mb-4 tracking-tight">
            WHY THARKA?
          </h2>
          <div className="w-20 h-1.5 gradient-accent mx-auto rounded-full mb-6" />
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            We are redefining education for the next generation of innovators and problem solvers.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {highlights.map((highlight, index) => (
            <div
              key={index}
              className="group relative bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2 overflow-hidden"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Card Hover Effect Background */}
              <div className="absolute top-0 right-0 -translate-y-full translate-x-full group-hover:translate-y-0 group-hover:translate-x-0 w-32 h-32 gradient-accent opacity-5 transition-transform duration-700 rounded-bl-[100px]" />
              
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-50 group-hover:gradient-accent transition-colors duration-500 shadow-sm">
                <highlight.icon className="h-7 w-7 text-primary group-hover:text-white transition-colors duration-500" />
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-primary transition-colors">
                {highlight.title}
              </h3>
              <p className="text-slate-600 leading-relaxed group-hover:text-slate-700 transition-colors">
                {highlight.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
