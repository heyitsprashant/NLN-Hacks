"use client";

import { useState } from "react";
import Sidebar from "@/components/site/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar mobileOpen={mobileOpen} onToggleMobile={() => setMobileOpen((v) => !v)} />
      <main className="flex-1 lg:ml-64">
        <div className="mx-auto w-full max-w-[1120px] px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
