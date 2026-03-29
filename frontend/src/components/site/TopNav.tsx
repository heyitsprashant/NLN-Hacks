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
import Image from "next/image";

const links = [
  { href: "/journal",   label: "Journal",    icon: Book,            accent: "var(--accent-journal)"   },
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard, accent: "var(--accent-dashboard)" },
  { href: "/copilot",   label: "AI Copilot", icon: MessageSquare,   accent: "var(--accent-copilot)"   },
  { href: "/voice",     label: "Voice",      icon: Mic,             accent: "var(--accent-voice)"     },
  { href: "/call",      label: "Call",       icon: PhoneCall,       accent: "var(--accent-call)"      },
  { href: "/settings",  label: "Settings",   icon: Settings,        accent: "var(--accent-settings)"  },
];

export default function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md"
      style={{
        background: "rgba(255,255,255,0.96)",
        borderColor: "rgba(42,80,69,0.18)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Brand */}
        <div
          onClick={() => router.push("/")}
          className="flex cursor-pointer items-center gap-2.5 select-none"
        >
          <Image src="/logo.svg" alt="Antara" width={34} height={34} />
          <div className="flex flex-col leading-none">
            <span
              className="text-xl font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-lora), Georgia, serif",
                background: "linear-gradient(110deg, var(--primary-blue) 0%, #7c6fcd 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Antara
            </span>
            <span
              className="mt-0.5 text-[10px] leading-none tracking-wide uppercase"
              style={{ color: "var(--text-secondary)" }}
            >
              Your Inner Voice
            </span>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-0.5">
          {links.map((link) => {
            const isActive = pathname?.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={
                  isActive
                    ? {
                        backgroundColor: "var(--primary-soft)",
                        color: "var(--primary-blue)",
                        boxShadow: "0 2px 8px rgba(42,80,69,0.22)",
                      }
                    : { color: "var(--text-secondary)" }
                }
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                  isActive
                    ? ""
                    : "hover:bg-[rgba(42,80,69,0.07)] hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop reset session */}
        <button
          type="button"
          className="hidden lg:flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors hover:bg-[rgba(42,80,69,0.07)]"
          style={{ border: "1px solid rgba(42,80,69,0.22)", color: "var(--text-secondary)" }}
          onClick={() => {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem("token");
            }
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="lg:hidden rounded-lg p-2 transition-colors hover:bg-[rgba(42,80,69,0.07)]"
          style={{
            border: "1px solid rgba(42,80,69,0.22)",
            color: "var(--text-secondary)",
          }}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav
          className="lg:hidden backdrop-blur-md px-4 py-3 flex flex-col gap-1"
          style={{
            borderTop: "1px solid rgba(42,80,69,0.18)",
            background: "rgba(255,255,255,0.98)",
          }}
        >
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
                    ? { backgroundColor: "var(--primary-soft)", color: "var(--primary-blue)" }
                    : { color: "var(--text-secondary)" }
                }
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  isActive ? "" : "hover:bg-[rgba(42,80,69,0.07)]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
