// src/components/layout/Layout.tsx
import { PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

export default function Layout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <div className="min-h-screen flex flex-col">
      {!isAdmin && <Header />}
      <main className={isAdmin ? "flex-1 bg-neutral-50" : "flex-1"}>{children}</main>
      {!isAdmin && <Footer />}
    </div>
  );
}
