import { Layout } from "@/components/layout/Layout";
import { Hero } from "@/components/home/Hero";
import { Highlights } from "@/components/home/Highlights";
import { FeaturedCourses } from "@/components/home/FeaturedCourses";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { Testimonials } from "@/components/home/Testimonials";
import { CTASection } from "@/components/home/CTASection";
import { Helmet } from "react-helmet-async";

const Index = () => {
  return (
    <Layout>
      <Helmet>
        <title>Tharka High School - India's First Future-Ready Coding School</title>
        <meta name="description" content="Tharka High School is India's first future-ready coding school. Learn coding from Class 5, prepare for IIT-JEE, and build job-ready skills with expert mentorship from IIT Bombay graduates." />
        <meta property="og:title" content="Tharka High School - The Coding School" />
        <meta property="og:description" content="Empowering Young Minds with Coding Skills. India's first future-ready coding school commencing June 2026." />
      </Helmet>
      <Hero />
      <Highlights />
      <FeaturedCourses />
      <WhyChooseUs />
      <Testimonials />
      <CTASection />
    </Layout>
  );
};

export default Index;
