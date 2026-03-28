"use client";

import dynamic from "next/dynamic";
import TopNav from "@/components/site/TopNav";
import Footer from "@/components/site/Footer";


export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col w-full">

      {/* Full-screen cursor particle overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      >
      </div>

      <TopNav />

      <main className="flex-1 pt-16">
        <div className="mx-auto w-full max-w-[1200px] px-4 pb-8 pt-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
