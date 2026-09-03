import { Layout } from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CheckCircle, FileText, Calendar, Phone, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Submit Inquiry",
    description: "Fill out the inquiry form or contact us directly to express your interest in admission.",
  },
  {
    number: "02",
    title: "Campus Visit",
    description: "Schedule a campus visit to experience our facilities, meet the faculty, and learn about our programs.",
  },
  {
    number: "03",
    title: "Application Form",
    description: "Complete the detailed application form with student and parent/guardian information.",
  },
  {
    number: "04",
    title: "Assessment",
    description: "Students undergo a basic assessment to understand their current academic level.",
  },
  {
    number: "05",
    title: "Interview",
    description: "Parent and student interaction with the school administration to discuss goals and expectations.",
  },
  {
    number: "06",
    title: "Enrollment",
    description: "Upon selection, complete the enrollment process with fee payment and documentation.",
  },
];

const eligibility = [
  "Students entering Class 5 through Class 11",
  "Interest in technology and learning",
  "Basic proficiency in English and Mathematics",
  "Willingness to engage in holistic development",
  "Commitment to the school's values and discipline",
];

const importantDates = [
  { event: "Application Opens", date: "January 2026" },
  { event: "Campus Visits", date: "February - April 2026" },
  { event: "Admission Tests", date: "March - May 2026" },
  { event: "Results Announced", date: "Rolling basis" },
  { event: "School Commences", date: "June 2026" },
];

export default function Admissions() {
  return (
    <Layout>
      <Helmet>
        <title>Admissions - Tharka High School</title>
        <meta name="description" content="Apply for admission to Tharka High School. Learn about our admission process, eligibility criteria, and important dates for 2026." />
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero py-24 md:py-32">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="container relative z-10 px-4 md:px-6 text-center">
          <div className="inline-flex items-center gap-3 rounded-full bg-white/10 backdrop-blur-md px-6 py-2.5 mb-8 border border-white/20 shadow-2xl animate-scale-in">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-gold"></span>
            </span>
            <span className="text-white font-bold tracking-wide text-sm uppercase">Admissions Open 2026</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight animate-slide-up">
            Your Future <span className="text-gold">Starts</span> Here
          </h1>
          <p className="text-blue-50/80 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed mb-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Join India's first future-ready coding school and give your child the skills they need for a changing world.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Button variant="hero" size="xl" className="group shadow-glow h-16 px-10" asChild>
              <Link to="/contact">
                Start Your Application
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <div className="flex items-center gap-3 text-white font-bold">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-blue-100/60 uppercase tracking-widest leading-none mb-1">Call Us Today</p>
                <p className="text-lg leading-none">96860 54029</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Admission Process */}
      <section className="py-24 bg-white">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-16">
            <span className="text-highlight font-bold tracking-widest uppercase text-sm mb-4 block">The Journey</span>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">
              Admission <span className="text-primary">Process</span>
            </h2>
            <div className="w-24 h-1 gradient-accent mx-auto rounded-full" />
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {steps.map((step, index) => (
              <div
                key={index}
                className="group relative bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100 transition-all duration-300 hover:bg-white hover:shadow-xl hover:border-highlight/20"
              >
                <div className="absolute top-8 right-10 text-6xl font-black text-slate-200 group-hover:text-highlight/10 transition-colors">
                  {step.number}
                </div>
                <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-white font-black text-xl shadow-lg">
                  {step.number}
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">{step.title}</h3>
                <p className="text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Eligibility & Dates Combined */}
      <section className="py-24 bg-slate-50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col lg:flex-row gap-16">
            {/* Eligibility */}
            <div className="lg:w-1/2 space-y-12">
              <div className="space-y-4">
                <span className="text-primary font-bold tracking-widest uppercase text-sm">Requirements</span>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  Eligibility Criteria
                </h2>
                <div className="w-20 h-1.5 gradient-primary rounded-full" />
              </div>
              <div className="grid gap-4">
                {eligibility.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="h-8 w-8 rounded-full bg-highlight/10 flex items-center justify-center text-highlight shrink-0">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <span className="text-slate-700 font-bold">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Important Dates */}
            <div className="lg:w-1/2 space-y-12">
              <div className="space-y-4">
                <span className="text-highlight font-bold tracking-widest uppercase text-sm">Planning</span>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  Important Dates
                </h2>
                <div className="w-20 h-1.5 gradient-accent rounded-full" />
              </div>
              <div className="space-y-4">
                {importantDates.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-6 bg-white rounded-2xl border border-slate-100 shadow-sm group hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Calendar className="h-6 w-6" />
                      </div>
                      <span className="font-bold text-slate-900 text-lg">{item.event}</span>
                    </div>
                    <span className="px-6 py-2 rounded-xl bg-slate-50 text-highlight font-black text-sm uppercase tracking-wider group-hover:bg-highlight/10 transition-colors">
                      {item.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced CTA */}
      <section className="py-24 bg-white">
        <div className="container px-4 md:px-6">
          <div className="relative rounded-[4rem] overflow-hidden gradient-primary p-12 md:p-20 text-center shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-highlight/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10 max-w-3xl mx-auto space-y-8">
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                Ready to <span className="text-gold">Build</span> Your Child's Future?
              </h2>
              <p className="text-blue-50/80 text-xl leading-relaxed">
                Admissions for 2026 are highly competitive. Start your journey with Tharka High School today.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
                <Button variant="hero" size="xl" className="h-16 px-12 text-lg shadow-glow" asChild>
                  <Link to="/contact">
                    <FileText className="h-6 w-6" />
                    Enquire Now
                  </Link>
                </Button>
                <a 
                  href="tel:+919686054029" 
                  className="flex items-center gap-4 px-10 h-16 rounded-2xl border-2 border-white/30 text-white font-black hover:bg-white/10 transition-colors"
                >
                  <Phone className="h-6 w-6" />
                  96860 54029
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
