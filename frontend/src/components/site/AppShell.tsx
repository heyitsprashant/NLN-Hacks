"use client";

import { useState } from "react";
import Sidebar from "@/components/site/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-(--background)">
      <Sidebar mobileOpen={mobileOpen} onToggleMobile={() => setMobileOpen((v) => !v)} />
      <main className="flex-1 lg:ml-64">
        <div className="mx-auto w-full max-w-[1080px] px-4 pb-10 pt-6 sm:px-6 lg:px-10 lg:pt-10">
          {children}
        </div>
      </main>
    </div>
  );
}
