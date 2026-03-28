import React from "react";

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md border border-(--border) bg-white/70 px-3 py-2 text-sm text-foreground placeholder:text-(--text-secondary) shadow-sm outline-none focus:ring-2 focus:ring-(--primary-blue) ${className}`}
      {...props}
    />
  );
}


