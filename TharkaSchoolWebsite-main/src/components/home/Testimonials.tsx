import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "The unique blend of coding and traditional academics at Tharka is exactly what modern education needs. My child is excited to learn every day!",
    author: "Priya Sharma",
    role: "Parent",
  },
  {
    quote: "As someone who has mentored students at IITs, I believe Tharka's approach to teaching DSA through visualization is groundbreaking.",
    author: "Dr. Venkat Rao",
    role: "Education Expert",
  },
  {
    quote: "Finally, a school that prepares children for the real world. The focus on both academics and practical skills is impressive.",
    author: "Rajesh Kumar",
    role: "Software Engineer & Parent",
  },
];

export function Testimonials() {
  return (
    <section className="py-24 bg-white">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">
            Voices of Our <span className="text-primary">Community</span>
          </h2>
          <div className="w-24 h-1 gradient-accent mx-auto rounded-full mb-8" />
          <p className="text-slate-600 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Discover why parents and experts believe in the Tharka mission.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative bg-slate-50 p-8 rounded-3xl border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-xl group"
            >
              <div className="absolute top-0 left-8 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full gradient-primary shadow-lg">
                <Quote className="h-5 w-5 text-white" />
              </div>
              
              <div className="pt-4">
                <p className="text-slate-700 mb-8 leading-relaxed text-lg italic font-medium">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-4 border-t border-slate-200 pt-6">
                  <div className="h-12 w-12 rounded-full gradient-accent flex items-center justify-center text-white font-bold text-lg">
                    {testimonial.author[0]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 leading-none mb-1">{testimonial.author}</p>
                    <p className="text-sm text-highlight font-bold uppercase tracking-wider">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
