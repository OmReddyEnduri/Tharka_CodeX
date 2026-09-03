import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import About from "./pages/About";
import Courses from "./pages/Courses";
import Admissions from "./pages/Admissions";
import Contact from "./pages/Contact";
import Course from "./pages/Course";
import Problem from "./pages/Problem";
import NotFound from "./pages/NotFound";
import MyCourses from "./pages/MyCourses";
import AdminDashboard from "./pages/AdminDashboard";
import CourseBuilder from "./pages/admin/course-builder/CourseBuilder";
import CourseContests from "./pages/admin/CourseContests";
import CreateContest from "./pages/admin/CreateContest";
import Contests from "./pages/Contests";
import Contest from "./pages/Contest";
import ContestProblem from "./pages/ContestProblem"; // New import
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import RefundPolicy from "./pages/RefundPolicy";
import { SignedIn, useUser, useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import Analytics from "./components/Analytics";

const queryClient = new QueryClient();

// Lazy load ZoomMeeting to isolate its heavy CSS imports

const UserSync = () => {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    const syncUser = async () => {
      if (isSignedIn && user) {
        try {
          const token = await getToken();
          // Sync user with backend
          await fetch(`${import.meta.env.VITE_API_URL}/api/users/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              email: user.primaryEmailAddress?.emailAddress,
              name: user.fullName,
            }),
          });
        } catch (error) {
          console.error("User sync failed", error);
        }
      }
    };
    syncUser();
  }, [isSignedIn, user, getToken]);

  return null;
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <UserSync />
        <BrowserRouter>
          <Analytics />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/course/:courseId" element={<Course />} />
            <Route path="/course/:courseId/problem/:problemId" element={<Problem />} />
            <Route path="/course/:courseId/contests" element={<Contests />} />
            <Route path="/admissions" element={<Admissions />} />
            <Route path="/contact" element={<Contact />} />
            <Route
              path="/my-courses"
              element={
                <SignedIn>
                  <MyCourses />
                </SignedIn>
              }
            />
            <Route
              path="/admin"
              element={
                <SignedIn>
                  <AdminDashboard />
                </SignedIn>
              }
            />
            <Route
              path="/admin/courses/:courseId/builder"
              element={
                <SignedIn>
                  <CourseBuilder />
                </SignedIn>
              }
            />
            <Route
              path="/admin/courses/:courseId/contests"
              element={
                <SignedIn>
                  <CourseContests />
                </SignedIn>
              }
            />
            <Route
              path="/admin/courses/:courseId/contests/new"
              element={
                <SignedIn>
                  <CreateContest />
                </SignedIn>
              }
            />
            <Route
              path="/contest/:contestId"
              element={
                <SignedIn>
                  <Contest />
                </SignedIn>
              }
            />
            {/* New Route for Contest Problem */}
            <Route
              path="/contest/:contestId/problem/:problemId"
              element={
                <SignedIn>
                  <ContestProblem />
                </SignedIn>
              }
            />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
