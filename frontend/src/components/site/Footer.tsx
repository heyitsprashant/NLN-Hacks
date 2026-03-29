import Link from "next/link";
import { Heart, Shield, BookOpen, LayoutDashboard } from "lucide-react";

const year = new Date().getFullYear();

export default function Footer() {
  return (
    <footer
      className="mt-16 backdrop-blur-sm"
      style={{
        borderTop: "1px solid rgba(42,80,69,0.18)",
        background: "rgba(255,255,255,0.96)",
      }}
    >
      <div className="mx-auto max-w-300 px-4 sm:px-6 lg:px-8 py-10">

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">


          {/* Brand col */}
          <div className="flex flex-col gap-2">
            <span
              className="text-xl font-bold tracking-tight"
              style={{
                background: "linear-gradient(110deg, var(--primary-blue) 0%, #7c6fcd 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Antara
            </span>
            <p className="text-sm leading-relaxed max-w-55" style={{ color: "var(--text-secondary)" }}>
              Your personal mental health journal, insights, and AI companion — always here for you.
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              <Shield className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent-journal)" }} />
              All data is private and encrypted
            </div>
          </div>

          {/* Pages col */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
              Navigate
            </p>
            <nav className="flex flex-col gap-2">
              {[
                { href: "/journal",   label: "Journal"    },
                { href: "/dashboard", label: "Dashboard"  },
                { href: "/copilot",   label: "AI Copilot" },
                { href: "/call",      label: "Call"       },
                { href: "/settings",  label: "Settings"   },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-semibold transition-opacity hover:opacity-75"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Info col */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
              About
            </p>
            <div className="flex flex-col gap-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              <div className="flex items-start gap-2">
                <LayoutDashboard className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent-dashboard)" }} />
                <span>Real-time mood tracking &amp; pattern detection</span>
              </div>
              <div className="flex items-start gap-2">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent-journal)" }} />
                <span>Private journaling with AI emotion analysis</span>
              </div>
              <div className="flex items-start gap-2">
                <Heart className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent-copilot)" }} />
                <span>24/7 AI mental health support by phone &amp; chat</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-10 flex flex-col items-center gap-2 pt-6 text-xs font-semibold sm:flex-row sm:justify-between"
              style={{
            borderTop: "1px solid rgba(42,80,69,0.18)",
            color: "var(--text-secondary)",
          }}
        >
          <span>© {year} Antara. Built with care.</span>
          <span className="flex items-center gap-1">
            Made with{" "}
            <Heart
              className="h-3 w-3 mx-0.5"
              style={{ color: "var(--accent-copilot)", fill: "var(--accent-copilot)" }}
            />{" "}
            for better mental health
          </span>
        </div>
      </div>
    </footer>
  );
}
