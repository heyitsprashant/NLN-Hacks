import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/journal", label: "Journal" },
  { href: "/copilot", label: "Copilot" },
  { href: "/voice", label: "Voice" },
  { href: "/call", label: "Call" },
  { href: "/settings", label: "Settings" },
];

export default function TopNav() {
  return (
    <header className="w-full border-b border-(--border) bg-(--surface)/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/dashboard"
          className="text-lg font-semibold text-[var(--primary)]"
          aria-label="Go to dashboard"
        >
          MindCare
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-xl px-3 py-1.5 text-sm text-(--text-secondary) transition-all duration-200 hover:bg-(--surface-muted) hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
