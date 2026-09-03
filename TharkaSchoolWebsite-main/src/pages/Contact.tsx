import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Phone, Mail, Globe, Send, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Contact() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: "Message Sent!",
          description: "Thank you for contacting us. We'll get back to you shortly.",
        });
        setFormData({ name: "", email: "", phone: "", message: "" });
      } else {
        const errorData = await response.json();
        toast({
          title: "Uh oh! Something went wrong.",
          description: errorData.msg || "There was a problem with your request. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Uh oh! Something went wrong.",
        description: "There was a problem with your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <Layout>
      <Helmet>
        <title>Contact Us - Tharka High School</title>
        <meta name="description" content="Contact Tharka High School for admissions, inquiries, or campus visits. Located in Vinukonda, Andhra Pradesh." />
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero py-24 md:py-32">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="container relative z-10 px-4 md:px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight animate-slide-up">
            Get in <span className="text-gold">Touch</span>
          </h1>
          <p className="text-blue-50/80 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Have questions about admissions or our programs? Our team is here to help you navigate your journey.
          </p>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="container px-4 md:px-6">
          <div className="grid gap-16 lg:grid-cols-2 max-w-6xl mx-auto items-start">
            {/* Contact Form */}
            <div className="bg-slate-50 p-10 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 gradient-accent opacity-5 rounded-bl-[100px]" />
              
              <div className="relative z-10 space-y-8">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 mb-2">Send a Message</h2>
                  <p className="text-slate-500 font-medium">We'll get back to you within 24 hours.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="John Doe"
                        className="h-14 rounded-2xl bg-white border-slate-200 focus:ring-primary/20"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="john@example.com"
                        className="h-14 rounded-2xl bg-white border-slate-200 focus:ring-primary/20"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+91 00000 00000"
                      className="h-14 rounded-2xl bg-white border-slate-200 focus:ring-primary/20"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Message</Label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="How can we help you?"
                      rows={5}
                      className="rounded-[2rem] bg-white border-slate-200 focus:ring-primary/20 p-6"
                      required
                    />
                  </div>

                  <Button type="submit" variant="hero" size="xl" className="w-full h-16 rounded-2xl shadow-glow" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-12 pt-6">
              <div className="space-y-6">
                <span className="text-highlight font-bold tracking-widest uppercase text-sm">Reach Us</span>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Contact Information</h2>
                <div className="w-20 h-1.5 gradient-primary rounded-full" />
              </div>
              
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  { icon: MapPin, title: "Location", content: "Vinukonda, Palnadu District, Andhra Pradesh – 522 647", color: "bg-blue-500" },
                  { icon: Phone, title: "Phone", content: "96860 54029", link: "tel:+919686054029", color: "bg-green-500" },
                  { icon: Mail, title: "Email", content: "tharkaschool@gmail.com", link: "mailto:tharkaschool@gmail.com", color: "bg-orange-500" },
                  { icon: Clock, title: "Office Hours", content: "Mon - Sat: 9:00 AM - 5:00 PM", color: "bg-purple-500" }
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-6 p-6 rounded-3xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl text-white shrink-0", item.color)}>
                      <item.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">{item.title}</h3>
                      {item.link ? (
                        <a href={item.link} className="text-lg font-bold text-slate-900 hover:text-primary transition-colors">
                          {item.content}
                        </a>
                      ) : (
                        <p className="text-lg font-bold text-slate-900">{item.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Map Placeholder */}
              <div className="relative group overflow-hidden rounded-[3rem] border border-slate-100 shadow-sm h-72">
                <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8">
                  <div className="h-16 w-16 rounded-full bg-white shadow-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <MapPin className="h-8 w-8 text-primary" />
                  </div>
                  <h4 className="text-xl font-black text-slate-900 mb-1">Visit Our Campus</h4>
                  <p className="text-slate-500 font-medium">Vinukonda, Andhra Pradesh</p>
                </div>
                <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #000 1px, transparent 0)', backgroundSize: '20px 20px' }} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
