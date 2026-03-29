"use client";

import { useEffect, useMemo, useState } from "react";
import CountUp from "@/components/ui/CountUp";
import SpotlightCard from "@/components/ui/SpotlightCard";
import RotatingText from "@/components/ui/RotatingText";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  RefreshCw,
  TrendingUp,
  X,
  Activity,
  Brain,
  Smile,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { formatRelativeTime } from "@/lib/time";

export interface MoodDataPoint {
  timestamp: string;
  moodScore: number;
  emotion: string;
}

type DashboardAlert = {
  id: string;
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  timestamp: string;
};

type PatternInsight = {
  id: string;
  description: string;
  confidenceScore: number;
  entriesCount: number;
};


const emotionColor: Record<string, string> = {
  anxiety: "var(--emotion-anxiety)",
  sadness: "var(--emotion-sadness)",
  joy: "var(--emotion-joy)",
  stress: "var(--emotion-stress)",
  calm: "var(--emotion-calm)",
};

const severityConfig: Record<DashboardAlert["severity"], { classes: string; icon: typeof AlertCircle }> = {
  low:    { classes: "border-l-4 border-blue-400 bg-blue-50/80 text-blue-900",   icon: Info },
  medium: { classes: "border-l-4 border-amber-400 bg-amber-50/80 text-amber-900", icon: AlertCircle },
  high:   { classes: "border-l-4 border-red-400 bg-red-50/80 text-red-900",       icon: AlertCircle },
};



function getEmotionColor(emotion: string): string {
  return emotionColor[emotion.toLowerCase()] ?? "var(--primary-blue)";
}

const confidenceGradient: (score: number) => string = (score) => {
  if (score >= 0.8) return "from-emerald-400 to-emerald-600";
  if (score >= 0.6) return "from-amber-400 to-amber-600";
  return "from-blue-400 to-blue-600";
};

export default function DashboardPage() {
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // Defer chart rendering to client — avoids recharts width(-1) SSR warning
  useEffect(() => setMounted(true), []);

  // ── API calls (unchanged) ────────────────────────────────────────────────
  const moodQuery = useQuery<MoodDataPoint[]>({
    queryKey: ["dashboard-mood-data"],
    queryFn: async () => {
      const response = await api.get("/api/dashboard/mood-data?days=7");
      const data = response.data;
      if (Array.isArray(data)) return data as MoodDataPoint[];
      if (Array.isArray(data?.points)) return data.points as MoodDataPoint[];
      throw new Error("No mood data available");
    },
    retry: false,
  });

  const summaryQuery = useQuery<{ summary?: string; generatedAt?: string }>({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const response = await api.get("/api/dashboard/summary");
      const data = response.data;
      if (typeof data?.summary === "string") return data;
      if (typeof data === "string") return { summary: data };
      throw new Error("No summary available");
    },
    retry: false,
  });

  const alertsQuery = useQuery<DashboardAlert[]>({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const response = await api.get("/api/dashboard/alerts");
      const data = response.data;
      if (Array.isArray(data)) return data as DashboardAlert[];
      if (Array.isArray(data?.alerts)) return data.alerts as DashboardAlert[];
      throw new Error("No alerts available");
    },
    retry: false,
  });

  const patternsQuery = useQuery<PatternInsight[]>({
    queryKey: ["dashboard-patterns"],
    queryFn: async () => {
      const response = await api.get("/api/dashboard/patterns");
      const data = response.data;
      if (Array.isArray(data)) return data as PatternInsight[];
      if (Array.isArray(data?.patterns)) return data.patterns as PatternInsight[];
      throw new Error("No patterns available");
    },
    retry: false,
  });
  // ────────────────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    if (!moodQuery.data?.length) return [];
    return moodQuery.data.map((point) => ({
      ...point,
      dayLabel: new Date(point.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      moodPct: Math.round(point.moodScore * 100),
    }));
  }, [moodQuery.data]);

  const stats = useMemo(() => {
    if (!chartData.length) return { avgMood: 0, topEmotion: "", daysTracked: 0 };
    const avgMood = chartData.reduce((sum, p) => sum + p.moodScore, 0) / chartData.length;
    const counts = chartData.reduce<Record<string, number>>((acc, p) => {
      acc[p.emotion] = (acc[p.emotion] ?? 0) + 1;
      return acc;
    }, {});
    const topEmotion = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    return { avgMood, topEmotion, daysTracked: chartData.length };
  }, [chartData]);

  const visibleAlerts = useMemo(
    () => (alertsQuery.data?.length ? alertsQuery.data.filter((a) => !dismissedAlerts.includes(a.id)) : []),
    [alertsQuery.data, dismissedAlerts]
  );

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">

      {/* ── Hero banner ──────────────────────────────────────────────────── */}
      <div className="hero-banner animate-fade-in-up">
        <p className="relative z-10 text-sm font-semibold opacity-75">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <p className="relative z-10 mt-1 text-[2rem] font-bold tracking-tight text-white">
          {greeting},{" "}
          <RotatingText
            texts={["take a breath 🌿", "you're doing great 🌱", "let's check in 🧠", "Antara is here 🤍"]}
            interval={3000}
          />
        </p>
        <p className="relative z-10 mt-1 text-base opacity-80">
          Here&apos;s your mental health overview for today
        </p>
        <div className="relative z-10 mt-4 flex flex-wrap gap-3">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">🧠 AI-powered insights</span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">📓 Journal tracked</span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">🔒 Private & secure</span>
        </div>
      </div>

      {/* ── KPI stat tiles (SpotlightCard + CountUp) ─────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">

        <SpotlightCard className="surface-card animate-fade-in-up flex items-center gap-4 p-5" style={{ animationDelay: "80ms" }}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(47,79,79,0.10)" }}>
            <Activity className="h-6 w-6" style={{ color: "var(--primary-blue)" }} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">Avg Mood</p>
            <p className="mt-0.5 text-2xl font-bold text-foreground">
              <CountUp to={Math.round(stats.avgMood * 100)} duration={1.4} />
              <span className="ml-1 text-sm font-normal text-(--text-secondary)">/ 100</span>
            </p>
          </div>
        </SpotlightCard>

        <SpotlightCard className="surface-card animate-fade-in-up flex items-center gap-4 p-5" style={{ animationDelay: "160ms" }}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(194,113,79,0.12)" }}>
            <Smile className="h-6 w-6" style={{ color: "var(--accent-copilot)" }} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">Top Emotion</p>
            <p className="mt-0.5 text-2xl font-bold capitalize text-foreground">
              {stats.topEmotion || "N/A"}
            </p>
          </div>
        </SpotlightCard>

        <SpotlightCard className="surface-card animate-fade-in-up flex items-center gap-4 p-5" style={{ animationDelay: "240ms" }}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(217,119,6,0.10)" }}>
            <Brain className="h-6 w-6" style={{ color: "var(--accent-dashboard)" }} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">Days Tracked</p>
            <p className="mt-0.5 text-2xl font-bold text-foreground">
              <CountUp to={stats.daysTracked} duration={1.2} />
              <span className="ml-1 text-sm font-normal text-(--text-secondary)">days</span>
            </p>
          </div>
        </SpotlightCard>
      </div>

      {/* ── Mood trend chart ─────────────────────────────────────────────── */}
      <section className="surface-card animate-fade-in-up p-5 sm:p-6" style={{ animationDelay: "320ms" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Mood Trends</h2>
            <p className="mt-0.5 text-sm text-(--text-secondary)">Your emotional patterns over the last 7 days</p>
          </div>
          {/* Emotion legend */}
          <div className="hidden sm:flex flex-wrap justify-end gap-x-4 gap-y-1">
            {Object.entries(emotionColor).map(([emotion, color]) => (
              <span key={emotion} className="flex items-center gap-1.5 text-xs text-(--text-secondary) capitalize">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                {emotion}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 h-[280px] w-full">
          {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="10%" stopColor="var(--primary-blue)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--primary-blue)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="dayLabel" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 1]} tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v * 100)}`} />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: "rgba(47,79,79,0.20)", fontSize: 13 }}
                formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "Mood"]}
              />
              <Area
                type="monotone"
                dataKey="moodScore"
                stroke="var(--primary-blue)"
                strokeWidth={2.5}
                fill="url(#moodGradient)"
                dot={(props) => (
                  <circle
                    key={`dot-${props.index}`}
                    cx={props.cx}
                    cy={props.cy}
                    r={5}
                    fill={getEmotionColor(props.payload.emotion)}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                )}
                activeDot={{ r: 7, strokeWidth: 2, stroke: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--border) border-t-(--primary-blue)" />
            </div>
          )}
        </div>
      </section>

      {/* ── AI Insights + Active Alerts ──────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* AI Insights */}
        <section className="surface-card animate-fade-in-up p-5 sm:p-6" style={{ animationDelay: "400ms" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <Brain className="h-5 w-5 text-(--accent-copilot)" />
                AI Insights
              </h2>
              <p className="mt-0.5 text-sm text-(--text-secondary)">Weekly mental health summary</p>
            </div>
            <button
              type="button"
              aria-label="Regenerate weekly summary"
              className="rounded-lg border border-(--border) p-2 text-(--text-secondary) transition hover:bg-(--surface-muted)"
              onClick={() => summaryQuery.refetch()}
            >
              <RefreshCw className={`h-4 w-4 ${summaryQuery.isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="mt-5 min-h-32.5 rounded-xl bg-(--surface-muted) p-4 text-[15px] leading-7 text-foreground">
            {summaryQuery.isLoading ? (
              <div className="space-y-2.5">
                <div className="h-4 w-full animate-pulse rounded-full bg-gray-200" />
                <div className="h-4 w-[86%] animate-pulse rounded-full bg-gray-200" />
                <div className="h-4 w-[72%] animate-pulse rounded-full bg-gray-200" />
              </div>
            ) : (
              summaryQuery.data?.summary ||
              "Your stress increased due to work-related entries this week, while social interactions showed a positive effect on mood."
            )}
          </div>

          <p className="mt-3 text-xs text-(--text-secondary)">
            Generated {formatRelativeTime(summaryQuery.data?.generatedAt ?? new Date().toISOString())}
          </p>
        </section>

        {/* Active Alerts */}
        <section className="surface-card animate-fade-in-up p-5 sm:p-6" style={{ animationDelay: "460ms" }}>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <AlertCircle className="h-5 w-5 text-(--accent-voice)" />
            Active Alerts
          </h2>
          <p className="mt-0.5 text-sm text-(--text-secondary)">Patterns that need your attention</p>

          {alertsQuery.isError ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {handleApiError(alertsQuery.error)}
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            {visibleAlerts.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-(--border) bg-(--surface-muted) p-5 text-sm text-(--text-secondary)">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                No active alerts right now. Keep journaling to maintain accuracy.
              </div>
            ) : (
              visibleAlerts.map((alert) => {
                const cfg = severityConfig[alert.severity];
                const SeverityIcon = cfg.icon;
                return (
                  <article key={alert.id} className={`relative rounded-xl border p-4 ${cfg.classes}`}>
                    <button
                      type="button"
                      aria-label={`Dismiss ${alert.type}`}
                      className="absolute right-3 top-3 rounded p-1 hover:bg-black/5"
                      onClick={() => { setDismissedAlerts((prev) => [...prev, alert.id]); toast.success("Alert dismissed"); }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2">
                      <SeverityIcon className="h-4 w-4 shrink-0" />
                      <h3 className="text-base font-semibold">{alert.type}</h3>
                      <span className="rounded-full border border-current/20 bg-white/60 px-2 py-0.5 text-xs font-semibold capitalize">
                        {alert.severity}
                      </span>
                    </div>
                    <p className="mt-2 pr-6 text-sm leading-6">{alert.message}</p>
                    <p className="mt-1.5 text-xs opacity-70">{formatRelativeTime(alert.timestamp)}</p>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* ── Pattern Insights ─────────────────────────────────────────────── */}
      <section className="surface-card animate-fade-in-up p-5 sm:p-6" style={{ animationDelay: "520ms" }}>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-(--accent-dashboard)" />
          <h2 className="text-xl font-semibold">Pattern Insights</h2>
        </div>
        <p className="mt-0.5 text-sm text-(--text-secondary)">Behavioral patterns detected from your entries</p>

        {patternsQuery.isError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {handleApiError(patternsQuery.error)}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(patternsQuery.data?.length ? patternsQuery.data : []).map((pattern) => {
            const pct = Math.round(pattern.confidenceScore * 100);
            return (
              <article key={pattern.id} className="flex flex-col gap-3 rounded-xl border border-(--border) bg-(--surface-muted)/40 p-4">
                <h3 className="text-[15px] font-semibold leading-snug">{pattern.description}</h3>

                {/* Confidence bar */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-(--text-secondary)">
                    <span>Confidence</span>
                    <span className="font-semibold text-foreground">{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full bg-linear-to-r ${confidenceGradient(pattern.confidenceScore)} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <p className="mt-auto text-xs text-(--text-secondary)">
                  Based on <span className="font-semibold text-foreground">{pattern.entriesCount}</span> journal entries
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
