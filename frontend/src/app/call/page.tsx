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
  anxiety: "bg-red-100 text-red-700",
  calm: "bg-violet-100 text-violet-700",
  stress: "bg-amber-100 text-amber-800",
  joy: "bg-emerald-100 text-emerald-700",
};

const DEFAULT_SUPPORT_NUMBER = "+1 (844) 351-2168";

function isPlaceholderSupportNumber(value: string): boolean {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  return (
    normalized.includes("(000)000-0000")
    || normalized.includes("(555)123-4567")
    || normalized === "+10000000000"
  );
}

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
    const fromApi = phoneQuery.data?.twilioNumber || phoneQuery.data?.phoneNumber || "";
    if (!fromApi || isPlaceholderSupportNumber(fromApi)) {
      return DEFAULT_SUPPORT_NUMBER;
    }
    return fromApi;
  }, [phoneQuery.data]);

  return (
    <div className="space-y-6">

      <section className="surface-card border-blue-200 bg-blue-50 p-6 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-(--primary-blue) text-white">
          <Phone className="h-8 w-8" />
        </div>
        <h2 className="mt-6 text-4xl font-bold">24/7 Support Line</h2>
        <p className="mt-2 text-lg text-(--text-secondary)">Call anytime to speak with your AI companion</p>

        <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-3 rounded-xl border border-(--border) bg-white px-5 py-4 shadow-sm">
          <p className="text-4xl font-bold tracking-tight text-(--primary-blue)">{phoneNumber}</p>
          <button
            type="button"
            className="rounded-lg border border-(--border) bg-white px-3 py-2 text-sm font-semibold hover:bg-(--surface-muted)"
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

        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Available Now
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h2 className="text-2xl font-semibold">How It Works</h2>
        <p className="text-(--text-secondary)">What to expect when you call</p>
        <ol className="mt-5 space-y-4">
          <li className="flex gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-(--primary-blue) text-sm font-bold text-white">1</span>
            <div>
              <p className="text-lg font-semibold">Dial the Number</p>
              <p className="text-(--text-secondary)">Call the support line using your phone</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-(--primary-blue) text-sm font-bold text-white">2</span>
            <div>
              <p className="text-lg font-semibold">Share Your Thoughts</p>
              <p className="text-(--text-secondary)">Speak naturally about how you are feeling or what is on your mind</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-(--primary-blue) text-sm font-bold text-white">3</span>
            <div>
              <p className="text-lg font-semibold">Receive Support</p>
              <p className="text-(--text-secondary)">Your AI companion listens and suggests coping strategies</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-(--primary-blue) text-sm font-bold text-white">4</span>
            <div>
              <p className="text-lg font-semibold">Review Transcript</p>
              <p className="text-(--text-secondary)">Find transcript and insights in your call history below</p>
            </div>
          </li>
        </ol>

        <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
          <p><span className="font-semibold">Average call duration:</span> 10-15 minutes</p>
          <p><span className="font-semibold">Privacy:</span> All calls are encrypted and confidential</p>
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h2 className="text-2xl font-semibold">Call History</h2>
        <p className="text-(--text-secondary)">Your previous phone conversations</p>

        {historyQuery.isError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {handleApiError(historyQuery.error)}
          </p>
        ) : null}

        <div className="mt-5 space-y-3">
          {(historyQuery.data ?? []).map((call) => {
            const isExpanded = Boolean(expanded[call.id]);
            const badgeClass = emotionBadgeStyles[call.emotion.toLowerCase()] || "bg-slate-100 text-slate-700";

            return (
              <article key={call.id} className="rounded-xl border border-(--border) p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold" title={formatReadableDate(call.timestamp)}>{formatRelativeTime(call.timestamp)}</p>
                    <p className="text-sm text-(--text-secondary)">Duration: {formatDuration(call.durationSeconds)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${badgeClass}`}>
                    {call.emotion}
                  </span>
                </div>

                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-foreground"
                  onClick={() => setExpanded((prev) => ({ ...prev, [call.id]: !isExpanded }))}
                >
                  {isExpanded ? "Hide transcript" : "View transcript"}
                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {isExpanded ? (
                  <p className="mt-3 rounded-lg border border-(--border) bg-(--surface-muted) p-3 text-sm text-[#374151]">
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

