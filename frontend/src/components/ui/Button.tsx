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
    "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-(--primary-blue) disabled:opacity-50 disabled:cursor-not-allowed transition";

  const styles: Record<ButtonVariant, string> = {
    primary: "bg-(--primary-blue) text-white hover:brightness-95",
    secondary:
      "bg-(--surface) text-foreground border border-(--border) hover:bg-white dark:hover:bg-(--surface)",
    ghost: "bg-transparent text-foreground hover:bg-black/5",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      className={`${base} ${styles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    />
  );
}


