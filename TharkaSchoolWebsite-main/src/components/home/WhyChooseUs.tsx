import { BookOpen, Users, Monitor, Award, Target, Heart } from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Coding from Class 5",
    description: "Early introduction to logical thinking and programming concepts through engaging activities.",
  },
  {
    icon: Users,
    title: "Expert Faculty",
    description: "Learn from IIT graduates and industry professionals with 20+ years of experience.",
  },
  {
    icon: Monitor,
    title: "Modern Labs",
    description: "State-of-the-art computer labs with the latest technology and development tools.",
  },
  {
    icon: Award,
    title: "JEE Preparation",
    description: "Strong foundation in Mathematics, Physics, and Chemistry for competitive exams.",
  },
  {
    icon: Target,
    title: "Placement Focus",
    description: "Direct mentorship for tech careers with students placed at Google, Amazon, Microsoft.",
  },
  {
    icon: Heart,
    title: "Holistic Development",
    description: "Sports, arts, music, and character building alongside academic excellence.",
  },
];

export function WhyChooseUs() {
  return (
    <section className="py-24 bg-slate-50 relative overflow-hidden">
      <div className="container px-4 md:px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2 space-y-8">
            <div className="space-y-4">
              <span className="text-primary font-bold tracking-widest uppercase text-sm">Beyond Academics</span>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                Why Choose <span className="text-highlight">Tharka</span>?
              </h2>
              <p className="text-slate-600 text-lg md:text-xl leading-relaxed">
                We bridge the gap between traditional schooling and the rapidly evolving tech landscape, 
                nurturing the next generation of digital leaders.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:w-1/2 relative">
            <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl border-8 border-white">
              <img 
                src="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=800" 
                alt="Students learning to code"
                className="w-full h-[600px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                <p className="text-white text-lg font-medium italic">
                  "Our mission is to create thinkers who don't just use technology, but build the future with it."
                </p>
                <p className="text-gold font-bold mt-2">— Founder, Tharka School</p>
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -top-10 -right-10 w-40 h-40 gradient-accent rounded-full blur-3xl opacity-20" />
            <div className="absolute -bottom-10 -left-10 w-64 h-64 gradient-primary rounded-full blur-3xl opacity-10" />
          </div>
        </div>
      </div>
    </section>
  );
}
