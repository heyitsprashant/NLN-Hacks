"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Book,
  MessageSquare,
  PhoneCall,
  Settings,
  Menu,
  X,
  RotateCcw,
  Bell,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import api from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";

const links = [
  { href: "/journal",   label: "Journal",    icon: Book,            accent: "var(--accent-journal)"   },
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard, accent: "var(--accent-dashboard)" },
  { href: "/copilot",   label: "AI Copilot", icon: MessageSquare,   accent: "var(--accent-copilot)"   },
  { href: "/call",      label: "Call",       icon: PhoneCall,       accent: "var(--accent-call)"      },
  { href: "/settings",  label: "Settings",   icon: Settings,        accent: "var(--accent-settings)"  },
];

type DashboardAlert = {
  id: string;
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  timestamp: string;
};

const dismissedAlertsStorageKey = "antara-dismissed-alert-ids";

function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(dismissedAlertsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setDismissedIds(parsed.filter((v) => typeof v === "string"));
    } catch {
      setDismissedIds([]);
    }
  }, []);

  const alertsQuery = useQuery<DashboardAlert[]>({
    queryKey: ["topnav-alerts-feed"],
    queryFn: async () => {
      const response = await api.get("/api/dashboard/alerts");
      const data = response.data;
      if (Array.isArray(data)) return data as DashboardAlert[];
      if (Array.isArray(data?.alerts)) return data.alerts as DashboardAlert[];
      return [];
    },
    refetchInterval: 60_000,
    retry: 1,
  });

  const visibleAlerts = useMemo(
    () => (alertsQuery.data || []).filter((alert) => !dismissedIds.includes(alert.id)),
    [alertsQuery.data, dismissedIds],
  );

  const saveDismissed = (ids: string[]) => {
    setDismissedIds(ids);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(dismissedAlertsStorageKey, JSON.stringify(ids));
  };

  const dismissOne = (id: string) => {
    if (dismissedIds.includes(id)) return;
    saveDismissed([...dismissedIds, id]);
  };

  const markAllRead = () => {
    const allIds = (alertsQuery.data || []).map((alert) => alert.id);
    saveDismissed(Array.from(new Set([...dismissedIds, ...allIds])));
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-xl p-2 transition-colors hover:bg-[rgba(42,80,69,0.07)]"
        style={{ border: "1px solid rgba(42,80,69,0.22)", color: "var(--text-secondary)" }}
        aria-label="Open notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {visibleAlerts.length > 0 ? (
          <span
            className="absolute -right-1 -top-1 min-w-5 rounded-full px-1 text-center text-[10px] font-bold text-white"
            style={{ background: "#dc2626" }}
          >
            {visibleAlerts.length > 99 ? "99+" : visibleAlerts.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 mt-2 w-88 rounded-xl border bg-white shadow-xl"
          style={{ borderColor: "rgba(42,80,69,0.18)" }}
        >
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "rgba(42,80,69,0.12)" }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Notifications</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{visibleAlerts.length} unread</p>
            </div>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs font-semibold transition-colors hover:bg-[rgba(42,80,69,0.07)]"
              style={{ color: "var(--primary-blue)" }}
              onClick={markAllRead}
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {alertsQuery.isLoading ? (
              <p className="px-2 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>Loading alerts...</p>
            ) : visibleAlerts.length === 0 ? (
              <p className="px-2 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>No unread alerts.</p>
            ) : (
              visibleAlerts.map((alert) => (
                <article key={alert.id} className="mb-2 rounded-lg border p-2.5" style={{ borderColor: "rgba(42,80,69,0.14)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {alert.severity === "high" ? (
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                        {alert.type.replaceAll("_", " ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded p-0.5 text-[11px] transition-colors hover:bg-[rgba(42,80,69,0.07)]"
                      style={{ color: "var(--text-secondary)" }}
                      onClick={() => dismissOne(alert.id)}
                      aria-label="Dismiss alert"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>{alert.message}</p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>{formatRelativeTime(alert.timestamp)}</p>
                </article>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
      <div className="mx-auto flex h-16 max-w-300 items-center justify-between px-4 sm:px-6 lg:px-8">

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

        <div className="flex items-center gap-2">
          <NotificationCenter />

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
