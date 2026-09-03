import { Layout } from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";
import { CheckCircle, Award, Users, BookOpen, TreePine, Target, PlayCircle, FileText, Download } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StudentTestimonials } from "@/components/home/StudentTestimonial";
import { StudentVideos } from "@/components/home/StudentVideos";

const values = [
  "Logical Thinking & Coding from Class 5",
  "Strong Foundation for IIT-JEE (MPC Stream)",
  "Spoken English & Communication Skills",
  "Sports, Arts & Music Integration",
  "Safe & Green Campus Environment",
  "Character Building & Leadership",
];

const campusFeatures = [
  { icon: "🎭", text: "120-seat auditorium" },
  { icon: "📚", text: "Spacious, well-lit classrooms" },
  { icon: "🏠", text: "Separate boys & girls hostels" },
  { icon: "🍽️", text: "Large dining hall" },
  { icon: "💻", text: "Modern computer labs" },
  { icon: "🔬", text: "Science laboratories" },
];

const videoItems = [
  { 
    title: "Why choose Us?", 
    embedUrl: "https://www.youtube.com/embed/b3Ju6ssCNr4",
    link: "https://www.youtube.com/shorts/b3Ju6ssCNr4"
  },
  { 
    title: "Why Coding is Importatnt for Students?", 
    embedUrl: "https://www.youtube.com/embed/X-cdWlx7hQI",
    link: "https://www.youtube.com/shorts/X-cdWlx7hQI"
  }
];

const resourceItems = [
  { title: "School Vision Presentation", type: "PPTX", size: "2.5 MB", icon: <BookOpen className="h-6 w-6 text-primary" />, link: "/THS2.pptx" }
];

export default function About() {
  return (
    <Layout>
      <Helmet>
        <title>About Us - Tharka High School</title>
        <meta name="description" content="Learn about Tharka High School's vision, mission, and why we are India's first future-ready coding school led by IIT Bombay graduates." />
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero py-24 md:py-32">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="container relative z-10 px-4 md:px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight animate-slide-up">
            Our <span className="text-gold">Story</span>
          </h1>
          <p className="text-blue-50/80 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
            We're on a mission to redefine education for the digital age, building thinkers and innovators who will shape the future.
          </p>
        </div>
      </section>

      {/* Vision & Mission */}
      {/* <section className="py-24 bg-white">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/2">
              <span className="text-highlight font-bold tracking-widest uppercase text-sm mb-4 block">Purpose Driven</span>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-8 tracking-tight leading-tight">
                Our Vision & <span className="text-primary">Mission</span>
              </h2>
              <div className="w-20 h-1.5 gradient-accent rounded-full mb-8" />
              <p className="text-slate-600 text-lg md:text-xl mb-8 leading-relaxed">
                At Tharka High School, we believe education is about <strong className="text-slate-900">understanding, creating, and applying</strong>—not just memorizing. Our mission is to nurture logical thinkers and innovators through a perfect blend of strong academics, technology, and creativity.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {values.map((value, index) => (
                  <div key={index} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <CheckCircle className="h-5 w-5 text-highlight shrink-0" />
                    <span className="text-slate-700 font-bold text-sm">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:w-1/2">
              <div className="relative">
                <div className="absolute -inset-4 gradient-accent opacity-10 blur-2xl rounded-3xl" />
                <img 
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=800" 
                  alt="Team collaboration"
                  className="relative rounded-3xl shadow-2xl object-cover h-[500px] w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section> */}

      {/* Founder Section */}
      {/* <section className="py-24 bg-slate-50">
        <div className="container px-4 md:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">
                Leadership <span className="text-primary">Team</span>
              </h2>
              <div className="w-24 h-1 gradient-primary mx-auto rounded-full" />
            </div>

            <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-xl border border-slate-100 flex flex-col md:flex-row gap-12 items-center">
              <div className="md:w-1/3">
                <div className="aspect-square rounded-[2rem] overflow-hidden gradient-primary flex items-center justify-center text-white text-9xl font-black">
                  RR
                </div>
              </div>
              <div className="md:w-2/3 space-y-6">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 mb-1">Ramanji Reddy E</h3>
                  <p className="text-highlight font-bold text-xl uppercase tracking-wider">Founder & Director</p>
                </div>
                
                <div className="space-y-4 text-slate-600">
                  <p className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    <strong className="text-slate-900 font-bold">M.Tech, IIT Bombay</strong>
                  </p>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    <li className="flex gap-2">
                      <CheckCircle className="h-4 w-4 text-highlight shrink-0 mt-1" />
                      <span className="text-sm">20+ years IT industry experience</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle className="h-4 w-4 text-highlight shrink-0 mt-1" />
                      <span className="text-sm">5+ Years Coding/DSA Mentor</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle className="h-4 w-4 text-highlight shrink-0 mt-1" />
                      <span className="text-sm">Expert in C++, Java, AI/ML</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle className="h-4 w-4 text-highlight shrink-0 mt-1" />
                      <span className="text-sm">Mentored for Google & Amazon</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 gradient-accent opacity-20 -translate-y-1/2 translate-x-1/2 rounded-full blur-2xl group-hover:opacity-40 transition-opacity" />
                  <h4 className="text-gold font-bold uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" /> Unique Teaching Excellence
                  </h4>
                  <p className="text-blue-50/90 text-sm md:text-base leading-relaxed italic">
                    "Renowned for teaching DSA for placements through innovative <span className="text-white font-bold underline decoration-highlight decoration-2 underline-offset-4">visualization techniques</span>, making complex concepts intuitive."
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6">
                <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                  <Users className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Expert Faculty</h3>
                  <p className="text-slate-600 text-sm">JEE Teachers with 5+ years experience in MPC stream.</p>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6">
                <div className="h-16 w-16 rounded-2xl bg-highlight/5 flex items-center justify-center text-highlight">
                  <BookOpen className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Holistic Approach</h3>
                  <p className="text-slate-600 text-sm">Focus on communication, sports, and character building.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section> */}

      {/* Campus */}
      {/* <section className="py-24 bg-white">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col lg:flex-row-reverse gap-16 items-center">
            <div className="lg:w-1/2 space-y-8">
              <div className="space-y-4">
                <span className="text-highlight font-bold tracking-widest uppercase text-sm">Our Home</span>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                  Campus & <span className="text-primary">Environment</span>
                </h2>
                <div className="w-20 h-1.5 gradient-primary rounded-full" />
              </div>
              <p className="text-slate-600 text-lg leading-relaxed">
                Our <span className="font-bold text-slate-900">5-acre lush green campus</span> provides the perfect environment for holistic development, away from the noise and distractions of the city.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {campusFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-highlight/30 transition-colors">
                    <span className="text-2xl">{feature.icon}</span>
                    <span className="text-slate-700 font-bold text-sm">{feature.text}</span>
                  </div>
                ))}
              </div>

              <div className="bg-primary/5 rounded-3xl p-6 border border-primary/10">
                <h3 className="text-primary font-bold mb-2 flex items-center gap-2">
                  <TreePine className="h-5 w-5" /> Natural Serenity
                </h3>
                <p className="text-slate-600 text-sm">Surrounded by fields and trees, providing a clean and peaceful learning atmosphere.</p>
              </div>
            </div>
            <div className="lg:w-1/2">
              <div className="grid grid-cols-2 gap-4">
                <img 
                  src="https://images.unsplash.com/photo-1541339907198-e08756ebafe3?auto=format&fit=crop&q=80&w=400" 
                  alt="Campus building"
                  className="rounded-[2rem] h-64 w-full object-cover shadow-lg"
                />
                <img 
                  src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=400" 
                  alt="Students coding"
                  className="rounded-[2rem] h-64 w-full object-cover shadow-lg mt-8"
                />
                <img 
                  src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=400" 
                  alt="Classroom"
                  className="rounded-[2rem] h-64 w-full object-cover shadow-lg -mt-8"
                />
                <img 
                  src="https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&q=80&w=400" 
                  alt="Library"
                  className="rounded-[2rem] h-64 w-full object-cover shadow-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </section> */}

      {/* Chairman Achievements */}
      <section className="py-16 bg-background">
        <div className="container px-4 md:px-6 text-center">
          <h2 className="text-3xl font-bold text-primary mb-8">Our Director Achievements</h2>
          <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
            <div className="md:col-span-2 rounded-xl overflow-hidden shadow-lg border border-border">
              <img 
                src="/Ram anna 0.jpeg" 
                alt="Chairman Achievement 0" 
                className="w-full h-auto object-cover hover:scale-105 transition-transform duration-300" 
              />
            </div>
            <div className="rounded-xl overflow-hidden shadow-lg border border-border">
              <img 
                src="/Ram anna 1.jpeg" 
                alt="Chairman Achievement 1" 
                className="w-full h-auto object-cover hover:scale-105 transition-transform duration-300" 
              />
            </div>
            <div className="rounded-xl overflow-hidden shadow-lg border border-border">
              <img 
                src="/Ram anna 2.jpeg" 
                alt="Chairman Achievement 2" 
                className="w-full h-auto object-cover hover:scale-105 transition-transform duration-300" 
              />
            </div>
          </div>
          <div className="mt-8 max-w-4xl mx-auto rounded-xl overflow-hidden shadow-lg border border-border">
            <video 
              className="w-full h-auto" 
              controls 
              preload="metadata"
            >
              <source src="/Ramanji video 1.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          <div className="mt-8 max-w-4xl mx-auto rounded-xl overflow-hidden shadow-lg border border-border">
            <video 
              className="w-full h-auto" 
              controls 
              preload="metadata"
            >
              <source src="/OmReddy.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>

      {/* Student Testimonials */}
      <StudentTestimonials />

      {/* Student Videos */}
      <StudentVideos />

      {/* Videos & Resources Section */}
      <section className="py-16 bg-background">
        <div className="container px-4 md:px-6 text-center">
          <div className="grid gap-12 md:grid-cols-2 max-w-6xl mx-auto text-left">
            
            {/* Videos */}
            <div>
              <h2 className="text-3xl font-bold text-primary mb-8 flex items-center gap-2">
                <PlayCircle className="h-8 w-8 text-highlight" /> Video Highlights
              </h2>
              <div className="space-y-6">
                {videoItems.map((video, index) => (
                  <Card key={index} className="overflow-hidden">
                    <div className="aspect-video bg-black/10 flex items-center justify-center">
                      <iframe 
                        className="w-full h-full"
                        src={video.embedUrl} 
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                      ></iframe>
                    </div>
                    <div className="p-4 flex justify-between items-center">
                      <h3 className="font-semibold text-lg">{video.title}</h3>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={video.link} target="_blank" rel="noopener noreferrer" className="text-highlight hover:text-highlight/80">
                          Watch on YouTube
                        </a>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Resources (PPTs/Docs) */}
            <div>
              <h2 className="text-3xl font-bold text-primary mb-8 flex items-center gap-2">
                <FileText className="h-8 w-8 text-highlight" /> Resources & Presentations
              </h2>
              <div className="grid gap-4">
                {resourceItems.map((resource, index) => (
                  <Card key={index} className="flex items-center p-4 hover:shadow-md transition-shadow">
                    <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center mr-4">
                      {resource.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{resource.title}</h3>
                      <p className="text-sm text-muted-foreground">{resource.type} • {resource.size}</p>
                    </div>
                    <Button variant="outline" size="icon" asChild>
                      <a href={resource.link} download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </Card>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>
    </Layout>
  );
}