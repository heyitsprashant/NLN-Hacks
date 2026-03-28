import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className = "",
  disabled = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200";

  const styles: Record<ButtonVariant, string> = {
    primary: "bg-(--primary) text-white hover:bg-(--primary-dark) hover:shadow-md",
    secondary:
      "bg-(--surface) text-foreground border border-(--border) hover:bg-(--surface-muted) hover:shadow-sm",
    ghost: "bg-transparent text-foreground hover:bg-(--surface-muted)",
    danger: "bg-[#d4877f] text-white hover:bg-[#c07068]",
  };

  return (
    <button
      className={`${base} ${styles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    />
  );
}


