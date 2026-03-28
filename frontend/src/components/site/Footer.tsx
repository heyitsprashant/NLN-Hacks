import Link from "next/link";
import { Heart, Shield, BookOpen, LayoutDashboard } from "lucide-react";

const year = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-(--border) bg-white/60 backdrop-blur-sm">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-10">

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">

          {/* Brand col */}
          <div className="flex flex-col gap-2">
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
            <p className="text-sm text-(--text-secondary) leading-relaxed max-w-[220px]">
              Your personal mental health journal, insights, and AI companion — always here for you.
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-(--text-secondary)">
              <Shield className="h-3.5 w-3.5 text-(--accent-journal)" />
              All data is private and encrypted
            </div>
          </div>

          {/* Pages col */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-(--text-secondary)">Navigate</p>
            <nav className="flex flex-col gap-2">
              {[
                
                { href: "/journal",   label: "Journal",    color: "var(--accent-journal)"   },
                { href: "/dashboard", label: "Dashboard",  color: "var(--accent-dashboard)" },
                { href: "/copilot",   label: "AI Copilot", color: "var(--accent-copilot)"   },
                { href: "/voice",     label: "Voice Mode", color: "var(--accent-voice)"     },
                { href: "/call",      label: "Call",       color: "var(--accent-call)"      },
                { href: "/settings",  label: "Settings",   color: "var(--accent-settings)"  },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: link.color }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Info col */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-(--text-secondary)">About</p>
            <div className="flex flex-col gap-2 text-sm text-(--text-secondary)">
              <div className="flex items-start gap-2">
                <LayoutDashboard className="mt-0.5 h-4 w-4 shrink-0 text-(--accent-dashboard)" />
                <span>Real-time mood tracking & pattern detection</span>
              </div>
              <div className="flex items-start gap-2">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-(--accent-journal)" />
                <span>Private journaling with AI emotion analysis</span>
              </div>
              <div className="flex items-start gap-2">
                <Heart className="mt-0.5 h-4 w-4 shrink-0 text-[#ff2d9f] fill-[#ff2d9f]" />
                <span>24/7 AI mental health support by phone & chat</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center gap-2 border-t border-(--border) pt-6 text-xs text-(--text-secondary) sm:flex-row sm:justify-between">
          <span>© {year} MindCare. Built with care.</span>
          <span className="flex items-center gap-1">
            Made with <Heart className="h-3 w-3 text-[#ff2d9f] fill-[#ff2d9f] mx-0.5" /> for better mental health
          </span>
        </div>
      </div>
    </footer>
  );
}
