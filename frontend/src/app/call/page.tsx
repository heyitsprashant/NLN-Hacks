"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Phone, Copy, ChevronDown } from "lucide-react";
import api from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { formatReadableDate, formatRelativeTime } from "@/lib/time";

type CallHistoryItem = {
  id: string;
  timestamp: string;
  durationSeconds: number;
  emotion: string;
  transcript?: string;
};

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min <= 0) return `${sec}s`;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

const emotionBadgeStyles: Record<string, string> = {
  anxiety: "bg-[#f5e8e6] text-[#8a5a52]",
  calm: "bg-[var(--primary-soft)] text-[var(--primary-dark)]",
  stress: "bg-[#faf3ea] text-[#7a6340]",
  joy: "bg-[#e8f5ee] text-[#3d7a5a]",
};

export default function CallPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const phoneQuery = useQuery<{ twilioNumber?: string; phoneNumber?: string }>({
    queryKey: ["call-number"],
    queryFn: async () => {
      const response = await api.get("/api/call/number");
      return response.data;
    },
  });

  const historyQuery = useQuery<CallHistoryItem[]>({
    queryKey: ["call-history"],
    queryFn: async () => {
      const response = await api.get("/api/call/history");
      const data = response.data;
      if (Array.isArray(data)) return data as CallHistoryItem[];
      if (Array.isArray(data?.history)) return data.history as CallHistoryItem[];
      if (Array.isArray(data?.calls)) return data.calls as CallHistoryItem[];
      return [
        {
          id: "call-1",
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          durationSeconds: 765,
          emotion: "anxiety",
          transcript: "I felt anxious about deadlines, but discussing coping steps helped me regulate my thoughts.",
        },
        {
          id: "call-2",
          timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          durationSeconds: 500,
          emotion: "calm",
          transcript: "I shared what made me feel centered this week and got suggestions to maintain that routine.",
        },
      ];
    },
  });

  const phoneNumber = useMemo(() => {
    return phoneQuery.data?.twilioNumber || phoneQuery.data?.phoneNumber || "+1 (555) 123-4567";
  }, [phoneQuery.data]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Call Support</h1>
        <p className="mt-2 text-base text-(--text-secondary)">Speak directly with your AI companion via phone</p>
      </header>

      <section className="surface-card border-[var(--primary-soft)] bg-gradient-to-b from-[var(--primary-soft)] to-white p-8 text-center sm:p-12">
        <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg shadow-[rgba(139,126,200,0.25)]">
          <Phone className="h-8 w-8" />
        </div>
        <h2 className="mt-7 text-3xl font-bold text-foreground">24/7 Support Line</h2>
        <p className="mt-2 text-base text-(--text-secondary)">Call anytime to speak with your AI companion</p>

        <div className="mx-auto mt-7 flex max-w-md items-center justify-center gap-3 rounded-2xl border border-(--border) bg-white px-6 py-5 shadow-sm">
          <p className="text-3xl font-bold tracking-tight text-[var(--primary)]">{phoneNumber}</p>
          <button
            type="button"
            className="rounded-xl border border-(--border) bg-white px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:bg-(--surface-muted) hover:shadow-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(phoneNumber);
                toast.success("Phone number copied");
              } catch {
                toast.error("Clipboard access is blocked");
              }
            }}
            aria-label="Copy support number"
          >
            <span className="inline-flex items-center gap-2"><Copy className="h-4 w-4" /> Copy</span>
          </button>
        </div>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#e8f5ee] px-4 py-2 text-sm font-semibold text-[#3d7a5a]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#6db89a]" /> Available Now
        </div>
      </section>

      <section className="surface-card p-6 sm:p-7">
        <h2 className="text-xl font-semibold text-foreground">How It Works</h2>
        <p className="mt-1 text-(--text-secondary)">What to expect when you call</p>
        <ol className="mt-6 space-y-5">
          <li className="flex gap-4">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-bold text-[var(--primary-dark)]">1</span>
            <div>
              <p className="text-base font-semibold text-foreground">Dial the Number</p>
              <p className="mt-0.5 text-sm text-(--text-secondary)">Call the support line using your phone</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-bold text-[var(--primary-dark)]">2</span>
            <div>
              <p className="text-base font-semibold text-foreground">Share Your Thoughts</p>
              <p className="mt-0.5 text-sm text-(--text-secondary)">Speak naturally about how you are feeling or what is on your mind</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-bold text-[var(--primary-dark)]">3</span>
            <div>
              <p className="text-base font-semibold text-foreground">Receive Support</p>
              <p className="mt-0.5 text-sm text-(--text-secondary)">Your AI companion listens and suggests coping strategies</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-bold text-[var(--primary-dark)]">4</span>
            <div>
              <p className="text-base font-semibold text-foreground">Review Transcript</p>
              <p className="mt-0.5 text-sm text-(--text-secondary)">Find transcript and insights in your call history below</p>
            </div>
          </li>
        </ol>

        <div className="mt-6 rounded-2xl border border-[var(--primary-soft)] bg-gradient-to-r from-[var(--primary-soft)]/50 to-transparent px-5 py-4 text-sm text-foreground/80">
          <p><span className="font-semibold">Average call duration:</span> 10-15 minutes</p>
          <p className="mt-1"><span className="font-semibold">Privacy:</span> All calls are encrypted and confidential</p>
        </div>
      </section>

      <section className="surface-card p-6 sm:p-7">
        <h2 className="text-xl font-semibold text-foreground">Call History</h2>
        <p className="mt-1 text-(--text-secondary)">Your previous phone conversations</p>

        {historyQuery.isError ? (
          <p className="mt-4 rounded-2xl border border-[#e0c4c0] bg-[#faf0ee] p-3 text-sm text-[#8a5a52]">
            {handleApiError(historyQuery.error)}
          </p>
        ) : null}

        <div className="mt-5 space-y-3">
          {(historyQuery.data ?? []).map((call) => {
            const isExpanded = Boolean(expanded[call.id]);
            const badgeClass = emotionBadgeStyles[call.emotion.toLowerCase()] || "bg-[var(--surface-muted)] text-[var(--text-secondary)]";

            return (
              <article key={call.id} className="rounded-2xl border border-(--border) p-5 transition-all duration-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-foreground" title={formatReadableDate(call.timestamp)}>{formatRelativeTime(call.timestamp)}</p>
                    <p className="mt-0.5 text-sm text-(--text-secondary)">Duration: {formatDuration(call.durationSeconds)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClass}`}>
                    {call.emotion}
                  </span>
                </div>

                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary-dark)]"
                  onClick={() => setExpanded((prev) => ({ ...prev, [call.id]: !isExpanded }))}
                >
                  {isExpanded ? "Hide transcript" : "View transcript"}
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {isExpanded ? (
                  <p className="mt-3 rounded-xl border border-(--border) bg-(--surface-muted) p-4 text-sm leading-7 text-foreground/80">
                    {call.transcript || "Transcript unavailable for this call."}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
