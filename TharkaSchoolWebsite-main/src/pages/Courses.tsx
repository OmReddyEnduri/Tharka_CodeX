import { Layout } from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";
import { Code, Database, MessageSquare, Calculator } from "lucide-react";
import { FeaturedCourses } from "@/components/home/FeaturedCourses";

const academicCourses = [
  {
    icon: Calculator,
    title: "Mathematics (JEE Focus)",
    description: "Concept-based mathematics teaching with focus on IIT-JEE preparation.",
    topics: ["Algebra", "Calculus", "Coordinate geometry", "Problem solving"],
  },
  {
    icon: Code,
    title: "Physics (JEE Focus)",
    description: "In-depth physics concepts with practical applications and competitive exam preparation.",
    topics: ["Mechanics", "Electromagnetism", "Optics", "Modern physics"],
  },
  {
    icon: Database,
    title: "Chemistry (JEE Focus)",
    description: "Comprehensive chemistry curriculum covering organic, inorganic, and physical chemistry.",
    topics: ["Organic chemistry", "Inorganic chemistry", "Physical chemistry", "Lab work"],
  },
  {
    icon: MessageSquare,
    title: "Communication Skills",
    description: "Daily English practice, public speaking, and presentation skills development.",
    topics: ["Spoken English", "Public speaking", "Leadership", "Aptitude"],
  },
];

export default function Courses() {

  return (

    <Layout>

      <Helmet>

        <title>Curriculum - Tharka High School</title>

        <meta name="description" content="Explore our coding programs including Python, Data Structures, Web Development, and AI/ML. Plus JEE-focused academic curriculum." />

      </Helmet>



      {/* Hero */}

      <section className="relative overflow-hidden gradient-hero py-24 md:py-32">

        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        <div className="container relative z-10 px-4 md:px-6 text-center">

          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight animate-slide-up">

            Our <span className="text-highlight">Curriculum</span>

          </h1>

          <p className="text-blue-50/80 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>

            A fusion of rigorous academics and cutting-edge technology, designed to build the architects of tomorrow.

          </p>

        </div>

      </section>



      {/* Coding Curriculum (Dynamic from before) */}

      <FeaturedCourses />



      {/* Academic Courses */}

      <section className="py-24 bg-slate-50 relative overflow-hidden">

        <div className="container px-4 md:px-6 relative z-10">

          <div className="text-center mb-16">

            <span className="text-primary font-bold tracking-widest uppercase text-sm mb-4 block">Academic Foundation</span>

            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">

              🔬 JEE Excellence

            </h2>

            <div className="w-24 h-1 gradient-accent mx-auto rounded-full mb-8" />

            <p className="text-slate-600 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">

              Our core academic stream is optimized for <span className="text-primary font-bold">MPC (Math, Physics, Chemistry)</span> with direct focus on IIT-JEE preparation.

            </p>

          </div>



          <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">

            {academicCourses.map((course, index) => (

              <div

                key={index}

                className="group bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2"

              >

                <div className="flex items-start gap-6">

                  <div className="shrink-0 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-colors">

                    <course.icon className="h-8 w-8" />

                  </div>

                  <div>

                    <h3 className="text-2xl font-bold text-slate-900 mb-3">{course.title}</h3>

                    <p className="text-slate-600 mb-6 leading-relaxed">{course.description}</p>

                    <div className="flex flex-wrap gap-2">

                      {course.topics.map((topic, i) => (

                        <span key={i} className="inline-flex items-center rounded-full bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-700 border border-slate-100">

                          {topic}

                        </span>

                      ))}

                    </div>

                  </div>

                </div>

              </div>

            ))}

          </div>

        </div>

      </section>



      {/* Unique Advantage */}

      <section className="py-24 bg-white">

        <div className="container px-4 md:px-6">

          <div className="max-w-5xl mx-auto relative">

            <div className="absolute -inset-1 gradient-accent opacity-20 blur-xl rounded-[3rem]" />

            <div className="relative bg-slate-900 rounded-[3rem] p-12 md:p-16 overflow-hidden">

              <div className="absolute top-0 right-0 w-64 h-64 gradient-primary opacity-20 -translate-y-1/2 translate-x-1/2 rounded-full blur-3xl" />

              

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">

                <div className="md:w-2/3 space-y-6">

                  <h3 className="text-3xl md:text-4xl font-black text-white leading-tight">

                    The <span className="text-gold">Tharka</span> Advantage

                  </h3>

                  <p className="text-blue-50/80 text-lg md:text-xl leading-relaxed">

                    We don't just teach coding; we build a <span className="text-white font-bold underline decoration-highlight decoration-4 underline-offset-8">creator mindset</span>. Our students learn to bridge the gap between abstract concepts and real-world solutions.

                  </p>

                  <div className="flex flex-wrap gap-4 pt-4">

                    <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm">

                      Industry Mentorship

                    </div>

                    <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm">

                      Project-Based Learning

                    </div>

                    <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm">

                      Direct Placement Path

                    </div>

                  </div>

                </div>

                <div className="md:w-1/3 flex justify-center">

                  <div className="w-48 h-48 rounded-full border-8 border-white/10 flex items-center justify-center animate-pulse-slow">

                    <div className="w-32 h-32 rounded-full gradient-accent flex items-center justify-center text-white text-5xl font-black">

                      100%

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </section>

    </Layout>

  );

}
