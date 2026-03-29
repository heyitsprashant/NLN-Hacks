"use client";

import { useEffect, useState } from "react";

interface RotatingTextProps {
  texts: string[];
  interval?: number;
  className?: string;
}

export default function RotatingText({
  texts,
  interval = 2800,
  className = "",
}: RotatingTextProps) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"visible" | "hiding">("visible");

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase("hiding");
      setTimeout(() => {
        setIndex((i) => (i + 1) % texts.length);
        setPhase("visible");
      }, 320);
    }, interval);
    return () => clearInterval(timer);
  }, [texts.length, interval]);

  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        opacity: phase === "visible" ? 1 : 0,
        transform: phase === "visible" ? "translateY(0px)" : "translateY(-10px)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        minWidth: "1ch",
      }}
    >
      {texts[index]}
    </span>
  );
}
