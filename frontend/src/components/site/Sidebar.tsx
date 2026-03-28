"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Book, MessageSquare, Mic, PhoneCall, Settings, RotateCcw, X, Menu } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/journal", label: "Journal", icon: Book },
  { href: "/copilot", label: "AI Copilot", icon: MessageSquare },
  { href: "/voice", label: "Voice Mode", icon: Mic },
  { href: "/call", label: "Call", icon: PhoneCall },
  { href: "/settings", label: "Settings", icon: Settings },
];

type SidebarProps = {
  mobileOpen?: boolean;
  onToggleMobile?: () => void;
};

export default function Sidebar({ mobileOpen = false, onToggleMobile }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        aria-label="Toggle navigation menu"
        className="fixed left-4 top-4 z-40 rounded-lg border border-(--border) bg-white p-2 text-(--text-secondary) shadow-sm lg:hidden"
        onClick={onToggleMobile}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation backdrop"
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={onToggleMobile}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-(--border) bg-(--surface) transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="flex flex-col border-b border-(--border) px-6 py-5">
        <h1 className="text-[2rem] font-bold leading-none tracking-tight text-foreground">MindCare</h1>
        <p className="mt-2 text-sm text-(--text-secondary)">Mental Health Companion</p>
      </div>

      <nav className="flex flex-1 flex-col gap-2 px-3 py-5 overflow-y-auto">
        {links.map((link) => {
          const isActive = pathname?.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[1.06rem] font-semibold transition-colors ${
                isActive
                  ? "bg-(--primary-blue) text-white"
                  : "text-(--text-secondary) hover:bg-(--surface-muted)"
              }`}
            >
              <Icon className={`h-[1.1rem] w-[1.1rem] ${isActive ? "text-white" : "text-(--text-secondary)"}`} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-(--border) p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-(--border) px-4 py-2.5 text-sm font-semibold text-(--text-secondary) transition-colors hover:bg-(--surface-muted)"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem("token");
            }
            onToggleMobile?.();
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Reset Local Session
        </button>
      </div>
      </aside>
    </>
  );
}

