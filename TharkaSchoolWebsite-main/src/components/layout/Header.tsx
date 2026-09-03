import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, LogIn, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/courses", label: "Curriculum" },
  { href: "/admissions", label: "Admissions" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();

  const { data: userData } = useQuery({
    queryKey: ["currentUserRole"],
    queryFn: async () => {
      try {
        if (!user) return null;
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        });

        if (!res.ok) return null;
        return res.json();
      } catch (error) {
        return null;
      }
    },
    enabled: isSignedIn,
    retry: false,
  });

  const isAdmin = userData?.role === "admin";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 transition-all duration-300">
      <div className="container flex h-20 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-highlight to-gold rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition-transform group-hover:scale-105">
              <span className="font-mono text-xl font-bold text-highlight">
                {"{"}<span className="text-gold">/</span>{"}"}
              </span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-slate-900 leading-none">THARKA</span>
            <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase mt-1">HIGH SCHOOL</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "px-4 py-2 text-sm font-bold transition-all rounded-xl relative group",
                location.pathname === link.href
                  ? "text-primary bg-primary/5"
                  : "text-slate-600 hover:text-primary hover:bg-slate-50"
              )}
            >
              {link.label}
              {location.pathname === link.href && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
              )}
            </Link>
          ))}
          <SignedIn>
            <Link
              to="/my-courses"
              className={cn(
                "px-4 py-2 text-sm font-bold transition-all rounded-xl",
                location.pathname === "/my-courses"
                  ? "text-primary bg-primary/5"
                  : "text-slate-600 hover:text-primary hover:bg-slate-50"
              )}
            >
              My Courses
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className={cn(
                  "px-4 py-2 text-sm font-bold transition-all rounded-xl flex items-center gap-2",
                  location.pathname === "/admin"
                    ? "text-primary bg-primary/5"
                    : "text-slate-600 hover:text-primary hover:bg-slate-50"
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                Admin
              </Link>
            )}
          </SignedIn>
          
          <div className="h-6 w-px bg-slate-200 mx-4" />
          
          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm" className="font-bold text-slate-600">
                  Sign In
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton 
                afterSignOutUrl="/" 
                appearance={{
                  elements: {
                    userButtonAvatarBox: "h-10 w-10 border-2 border-slate-100"
                  }
                }}
              />
            </SignedIn>
          </div>
        </nav>

        {/* Mobile Controls */}
        <div className="flex items-center gap-3 md:hidden">
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost" size="icon" className="rounded-xl border border-slate-100">
                <LogIn className="h-5 w-5 text-slate-600" />
              </Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl border border-slate-100 bg-slate-50"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-5 w-5 text-slate-900" /> : <Menu className="h-5 w-5 text-slate-900" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white animate-fade-in p-4 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center px-6 py-4 text-base font-bold transition-all rounded-2xl",
                location.pathname === link.href
                  ? "text-primary bg-primary/5"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {link.label}
            </Link>
          ))}
          <SignedIn>
            <Link
              to="/my-courses"
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center px-6 py-4 text-base font-bold transition-all rounded-2xl",
                location.pathname === "/my-courses"
                  ? "text-primary bg-primary/5"
                  : "text-slate-600"
              )}
            >
              My Courses
            </Link>
          </SignedIn>
          <SignedOut>
            <div className="grid grid-cols-2 gap-4 pt-4 px-2">
              <SignInButton mode="modal">
                <Button variant="outline" className="w-full rounded-2xl font-bold border-slate-200">
                  Sign In
                </Button>
              </SignInButton>
            </div>
          </SignedOut>
        </div>
      )}
    </header>
  );
}
