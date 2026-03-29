"use client";
import { PropsWithChildren, useRef } from "react";

export default function GlobalCursorBg({ children }: PropsWithChildren) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="min-h-full bg-[--background] text-foreground overflow-x-hidden global-cursor-bg"
      onMouseMove={e => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
      }}
    >
      {children}
    </div>
  );
}