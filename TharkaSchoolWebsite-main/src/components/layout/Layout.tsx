import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import CookieConsent from "../CookieConsent";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CookieConsent />
    </div>
  );
}
