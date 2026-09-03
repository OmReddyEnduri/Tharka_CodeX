import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Code, Database, Globe, Brain, ArrowRight } from "lucide-react";

const courses = [
  {
    icon: Code,
    title: "Python Programming",
    description: "Learn the fundamentals of programming with Python, from basics to data structures.",
    ageGroup: "Class 5-8",
    duration: "2 Years",
  },
  {
    icon: Database,
    title: "Data Structures & Algorithms",
    description: "Master DSA through games and visualization techniques for competitive programming.",
    ageGroup: "Class 8-12",
    duration: "3 Years",
  },
  {
    icon: Globe,
    title: "Web Development",
    description: "Build modern websites and web applications using HTML, CSS, JavaScript, and React.",
    ageGroup: "Class 8-12",
    duration: "2 Years",
  },
  {
    icon: Brain,
    title: "AI & Machine Learning",
    description: "Introduction to artificial intelligence and machine learning concepts with hands-on projects.",
    ageGroup: "Class 10-12",
    duration: "2 Years",
  },
];

export function FeaturedCourses() {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[500px] h-[500px] bg-slate-50 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-50 rounded-full blur-3xl opacity-50" />

      <div className="container px-4 md:px-6 relative z-10">
        <div className="text-center mb-16">
          <span className="text-highlight font-bold tracking-widest uppercase text-sm mb-4 block">Future-Ready Skills</span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">
            Our Curriculum
          </h2>
          <div className="w-24 h-1 gradient-primary mx-auto rounded-full mb-8" />
          <p className="text-slate-600 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium">
            Industry-aligned curriculum designed by <span className="text-primary font-bold">IIT experts</span> to prepare students for the global tech landscape.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {courses.map((course, index) => (
            <div
              key={index}
              className="group relative bg-white rounded-3xl border border-slate-100 p-8 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-3"
            >
              <div className="relative mb-8">
                <div className="absolute -inset-2 bg-highlight/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl gradient-accent shadow-lg group-hover:scale-110 transition-transform duration-500">
                  <course.icon className="h-8 w-8 text-white" />
                </div>
              </div>

              <h3 className="text-2xl font-bold text-slate-900 mb-4 group-hover:text-primary transition-colors">
                {course.title}
              </h3>
              
              <p className="text-slate-600 mb-8 leading-relaxed text-sm lg:text-base">
                {course.description}
              </p>
              
              <div className="flex flex-wrap gap-3 mt-auto">
                <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-700 border border-slate-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {course.ageGroup}
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-highlight/5 px-4 py-1.5 text-xs font-bold text-highlight border border-highlight/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-highlight" />
                  {course.duration}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <Button variant="default" size="xl" className="group px-10 h-16 rounded-2xl text-lg shadow-xl hover:shadow-2xl transition-all" asChild>
            <Link to="/courses">
              Explore Full Curriculum
              <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
