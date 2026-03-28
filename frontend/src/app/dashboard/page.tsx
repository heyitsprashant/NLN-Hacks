"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw, TrendingUp, X, ExternalLink } from "lucide-react";
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

const severityStyles: Record<DashboardAlert["severity"], string> = {
  low: "border-[#c8d7e8] bg-[#f0f4f9] text-[#4a6785]",
  medium: "border-[#e8d8c0] bg-[#faf3ea] text-[#7a6340]",
  high: "border-[#e0c4c0] bg-[#faf0ee] text-[#8a5a52]",
};

function fallbackMoodData(): MoodDataPoint[] {
  const now = Date.now();
  return [0.65, 0.45, 0.75, 0.35, 0.55, 0.8, 0.6].map((score, index) => {
    const date = new Date(now - (6 - index) * 24 * 60 * 60 * 1000);
    const emotion = ["stress", "sadness", "joy", "anxiety", "calm", "joy", "calm"][index];
    return {
      timestamp: date.toISOString(),
      moodScore: score,
      emotion,
    };
  });
}

function fallbackAlerts(): DashboardAlert[] {
  return [
    {
      id: "burnout-risk",
      type: "Burnout Risk",
      severity: "medium",
      message: "Detected consistent work-related stress over 3 consecutive days",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "anxiety-pattern",
      type: "Anxiety Pattern",
      severity: "low",
      message: "Increased anxiety before scheduled meetings",
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function fallbackPatterns(): PatternInsight[] {
  return [
    {
      id: "anxiety-meetings",
      description: "Anxiety before meetings",
      confidenceScore: 0.85,
      entriesCount: 12,
    },
    {
      id: "socializing-mood",
      description: "Mood improves after socializing",
      confidenceScore: 0.72,
      entriesCount: 8,
    },
    {
      id: "monday-stress",
      description: "Stress peaks on Monday mornings",
      confidenceScore: 0.68,
      entriesCount: 15,
    },
  ];
}

function getEmotionColor(emotion: string): string {
  return emotionColor[emotion.toLowerCase()] ?? "var(--primary)";
}

export default function DashboardPage() {
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  const moodQuery = useQuery<MoodDataPoint[]>({
    queryKey: ["dashboard-mood-data"],
    queryFn: async () => {
      const response = await api.get("/api/dashboard/mood-data?days=7");
      const data = response.data;
      if (Array.isArray(data)) return data as MoodDataPoint[];
      if (Array.isArray(data?.points)) return data.points as MoodDataPoint[];
      return fallbackMoodData();
    },
  });

  const summaryQuery = useQuery<{ summary?: string; generatedAt?: string }>({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const response = await api.get("/api/dashboard/summary");
      const data = response.data;
      if (typeof data?.summary === "string") return data;
      if (typeof data === "string") return { summary: data };
      return {
        summary:
          "Your stress increased due to work-related entries this week, while social interactions showed a positive effect on mood.",
        generatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };
    },
  });

  const alertsQuery = useQuery<DashboardAlert[]>({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const response = await api.get("/api/dashboard/alerts");
      const data = response.data;
      if (Array.isArray(data)) return data as DashboardAlert[];
      if (Array.isArray(data?.alerts)) return data.alerts as DashboardAlert[];
      return fallbackAlerts();
    },
  });

  const patternsQuery = useQuery<PatternInsight[]>({
    queryKey: ["dashboard-patterns"],
    queryFn: async () => {
      const response = await api.get("/api/dashboard/patterns");
      const data = response.data;
      if (Array.isArray(data)) return data as PatternInsight[];
      if (Array.isArray(data?.patterns)) return data.patterns as PatternInsight[];
      return fallbackPatterns();
    },
  });

  const chartData = useMemo(() => {
    const source = moodQuery.data?.length ? moodQuery.data : fallbackMoodData();
    return source.map((point) => ({
      ...point,
      dayLabel: new Date(point.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    }));
  }, [moodQuery.data]);

  const visibleAlerts = useMemo(
    () => (alertsQuery.data?.length ? alertsQuery.data : fallbackAlerts()).filter((alert) => !dismissedAlerts.includes(alert.id)),
    [alertsQuery.data, dismissedAlerts]
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Your Wellness Overview</h1>
        <p className="mt-2 text-base text-(--text-secondary)">Here&apos;s how you&apos;ve been feeling this week</p>
      </header>

      <section className="surface-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">Mood Trends</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">Your emotional patterns over the last 7 days</p>
        <div className="mt-6 h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="dayLabel"
                tick={{ fill: "var(--text-secondary)", fontSize: 13 }}
                axisLine={false}
                tickLine={false}
                dy={8}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fill: "var(--text-secondary)", fontSize: 13 }}
                axisLine={false}
                tickLine={false}
                dx={-8}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 16,
                  border: "1px solid var(--border)",
                  boxShadow: "0 4px 20px rgba(45, 42, 51, 0.08)",
                  padding: "10px 14px",
                }}
                formatter={(value, _name, item) => [
                  `${Number(value).toFixed(2)} (${item.payload.emotion})`,
                  "Mood score",
                ]}
              />
              <Area
                type="monotone"
                dataKey="moodScore"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fill="url(#moodGradient)"
                dot={(props) => (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={5}
                    fill={getEmotionColor(props.payload.emotion)}
                    stroke="#ffffff"
                    strokeWidth={2.5}
                  />
                )}
                activeDot={{ r: 7, strokeWidth: 3, stroke: "#ffffff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-card p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Weekly Reflections</h2>
              <p className="mt-1 text-sm text-(--text-secondary)">AI-generated mental health summary</p>
            </div>
            <button
              type="button"
              aria-label="Regenerate weekly summary"
              className="rounded-xl border border-(--border) p-2.5 text-(--text-secondary) transition-all duration-200 hover:bg-(--surface-muted) hover:shadow-sm"
              onClick={() => summaryQuery.refetch()}
            >
              <RefreshCw className={`h-4 w-4 ${summaryQuery.isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="mt-5 min-h-[130px] text-[15px] leading-7 text-foreground/85">
            {summaryQuery.isLoading ? (
              <div className="space-y-3">
                <div className="h-4 w-full animate-pulse rounded-lg bg-(--surface-muted)" />
                <div className="h-4 w-[86%] animate-pulse rounded-lg bg-(--surface-muted)" />
                <div className="h-4 w-[78%] animate-pulse rounded-lg bg-(--surface-muted)" />
              </div>
            ) : (
              summaryQuery.data?.summary ||
              "Your stress increased due to work-related entries this week, while social interactions showed a positive effect on mood."
            )}
          </div>

          <p className="mt-5 text-sm text-(--text-secondary)">
            Generated {formatRelativeTime(summaryQuery.data?.generatedAt ?? new Date().toISOString())}
          </p>
        </section>

        <section className="surface-card p-6 sm:p-7">
          <h2 className="text-lg font-semibold text-foreground">Gentle Reminders</h2>
          <p className="mt-1 text-sm text-(--text-secondary)">Patterns worth being mindful of</p>

          {alertsQuery.isError ? (
            <p className="mt-4 rounded-2xl border border-[#e0c4c0] bg-[#faf0ee] p-3 text-sm text-[#8a5a52]">
              {handleApiError(alertsQuery.error)}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {visibleAlerts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-(--border) bg-(--surface-muted) p-6 text-center text-sm text-(--text-secondary)">
                No active reminders right now. Keep journaling to stay in tune with yourself.
              </div>
            ) : (
              visibleAlerts.map((alert) => (
                <article key={alert.id} className={`relative rounded-2xl border p-4 transition-all duration-200 ${severityStyles[alert.severity]}`}>
                  <button
                    type="button"
                    aria-label={`Dismiss ${alert.type}`}
                    className="absolute right-3 top-3 rounded-lg p-1 transition-colors hover:bg-black/5"
                    onClick={() => {
                      setDismissedAlerts((prev) => [...prev, alert.id]);
                      toast.success("Alert dismissed");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">{alert.type}</h3>
                    <span className="rounded-full border border-black/8 bg-white/60 px-2.5 py-0.5 text-xs font-medium capitalize">
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-2 max-w-[320px] text-sm leading-6">{alert.message}</p>
                  <p className="mt-2 text-xs opacity-70">{formatRelativeTime(alert.timestamp)}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="surface-card p-6 sm:p-7">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="h-5 w-5 text-[var(--primary)]" />
          <h2 className="text-lg font-semibold text-foreground">Pattern Insights</h2>
        </div>
        <p className="mt-1 text-sm text-(--text-secondary)">Behavioral patterns detected from your entries</p>

        {patternsQuery.isError ? (
          <p className="mt-4 rounded-2xl border border-[#e0c4c0] bg-[#faf0ee] p-3 text-sm text-[#8a5a52]">
            {handleApiError(patternsQuery.error)}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(patternsQuery.data?.length ? patternsQuery.data : fallbackPatterns()).map((pattern) => (
            <article key={pattern.id} className="rounded-2xl border border-(--border) bg-(--surface) p-5 transition-all duration-200 hover:shadow-md">
              <h3 className="text-base font-semibold leading-6 text-foreground">{pattern.description}</h3>
              <div className="mt-4 flex items-center justify-between text-sm text-(--text-secondary)">
                <span>
                  Confidence:
                  <span className="ml-2 rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--primary-dark)]">
                    {Math.round(pattern.confidenceScore * 100)}%
                  </span>
                </span>
                <span className="text-xs">{pattern.entriesCount} entries</span>
              </div>
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary-dark)]"
              >
                Learn more
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
