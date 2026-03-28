import React from "react";

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-(--border) bg-white/70 px-3.5 py-2.5 text-sm text-foreground placeholder:text-(--text-secondary) shadow-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-(--ring) focus:border-transparent ${className}`}
      {...props}
    />
  );
}


