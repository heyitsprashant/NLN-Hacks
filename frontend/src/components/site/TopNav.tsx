"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Book,
  MessageSquare,
  Mic,
  PhoneCall,
  Settings,
  Menu,
  X,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
const links = [
 
  { href: "/journal",   label: "Journal",   icon: Book,            accent: "var(--accent-journal)"   },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, accent: "var(--accent-dashboard)" },
  { href: "/copilot",   label: "AI Copilot",icon: MessageSquare,   accent: "var(--accent-copilot)"   },
  { href: "/voice",     label: "Voice Mode",icon: Mic,             accent: "var(--accent-voice)"     },
  { href: "/call",      label: "Call",      icon: PhoneCall,       accent: "var(--accent-call)"      },
  { href: "/settings",  label: "Settings",  icon: Settings,        accent: "var(--accent-settings)"  },
];

export default function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-(--border) bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Brand */}
        <div  onClick={() => router.push("/")} className="flex flex-col leading-none select-none">
          <span
            className="text-xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(110deg, var(--primary-blue) 0%, #ff2d9f 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Antara
          </span>
          <span className="text-[10px] text-(--text-secondary) leading-none mt-0.5">
            Your Inner Voice
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {links.map((link) => {
            const isActive = pathname?.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={
                  isActive
                    ? { backgroundColor: link.accent, color: "white" }
                    : { color: link.accent }
                }
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                  isActive ? "shadow-sm" : "hover:bg-(--surface-muted)"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop reset session */}
        <button
          type="button"
          className="hidden lg:flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-xs font-semibold text-(--text-secondary) transition-colors hover:bg-(--surface-muted)"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem("token");
            }
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Session
        </button>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="lg:hidden rounded-lg border border-(--border) bg-white p-2 text-(--text-secondary) shadow-sm"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav className="lg:hidden border-t border-(--border) bg-white/95 backdrop-blur-md px-4 py-3 flex flex-col gap-1">
          {links.map((link) => {
            const isActive = pathname?.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                style={
                  isActive
                    ? { backgroundColor: link.accent, color: "white" }
                    : { color: link.accent }
                }
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  isActive ? "" : "hover:bg-(--surface-muted)"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
