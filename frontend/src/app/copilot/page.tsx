"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Send } from "lucide-react";
import api from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { formatRelativeTime } from "@/lib/time";
import { useChatStore, type ChatMessage } from "@/store/chatStore";

type CopilotContext = {
  patterns?: string[];
  recentEntries?: Array<{ id: string; content: string; emotion: string }>;
  tips?: string[];
};

const LOCAL_STORAGE_KEY = "mindcare-copilot-history";

function normalizeMessages(data: unknown): ChatMessage[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const candidate = item as Partial<ChatMessage>;
      if (!candidate.content || !candidate.role) return null;
      return {
        id: candidate.id ?? crypto.randomUUID(),
        role: candidate.role,
        content: candidate.content,
        timestamp: candidate.timestamp ?? new Date().toISOString(),
      } as ChatMessage;
    })
    .filter(Boolean) as ChatMessage[];
}

export default function CopilotPage() {
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const messages = useChatStore((state) => state.messages);
  const setMessages = useChatStore((state) => state.setMessages);
  const addMessage = useChatStore((state) => state.addMessage);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const historyQuery = useQuery<ChatMessage[]>({
    queryKey: ["copilot-history"],
    queryFn: async () => {
      const response = await api.get("/api/copilot/history");
      const data = response.data;
      const normalized = normalizeMessages(Array.isArray(data) ? data : data?.messages);
      if (normalized.length) return normalized;
      return [];
    },
    retry: 1,
  });

  const contextQuery = useQuery<CopilotContext>({
    queryKey: ["copilot-context"],
    queryFn: async () => {
      const response = await api.get("/api/copilot/context");
      const data = response.data;
      return {
        patterns: Array.isArray(data?.patterns) ? data.patterns : ["Anxiety before meetings", "Better mood after social contact"],
        recentEntries: Array.isArray(data?.recentEntries)
          ? data.recentEntries
          : [
              {
                id: "entry-1",
                content: "Felt overwhelmed before stand-up but calmer after team support.",
                emotion: "anxiety",
              },
            ],
        tips: Array.isArray(data?.tips)
          ? data.tips
          : ["Try a 4-7-8 breathing cycle", "Break presentation prep into 20-minute sessions"],
      };
    },
  });

  useEffect(() => {
    if (historyQuery.data?.length) {
      setMessages(historyQuery.data);
      return;
    }

    if (!historyQuery.isLoading) {
      const local = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) {
        try {
          setMessages(normalizeMessages(JSON.parse(local)));
          return;
        } catch {
          window.localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }

      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Hello. I'm your mental health companion. How are you feeling today?",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);
    }
  }, [historyQuery.data, historyQuery.isLoading, setMessages]);

  useEffect(() => {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const lastMinuteMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.role === "user" && nowTs - new Date(message.timestamp).getTime() <= 60_000
      ).length,
    [messages, nowTs]
  );

  const isRateLimited = rateLimitedUntil ? nowTs < rateLimitedUntil : false;
  const rateLimitSeconds = rateLimitedUntil
    ? Math.max(1, Math.ceil((rateLimitedUntil - nowTs) / 1000))
    : 0;

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await api.post("/api/copilot/message", { message: text });
      return response.data as { message?: string; content?: string };
    },
    onMutate: () => setTyping(true),
    onSuccess: (data) => {
      const content = data?.message || data?.content || "I'm here with you. Tell me more.";
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        timestamp: new Date().toISOString(),
      });
    },
    onError: (error) => {
      toast.error(handleApiError(error));
    },
    onSettled: () => setTyping(false),
  });

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    if (lastMinuteMessages >= 6) {
      const until = Date.now() + 30_000;
      setRateLimitedUntil(until);
      toast.error("Too many messages too quickly. Please wait a few seconds.");
      return;
    }

    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    });

    setInput("");
    await sendMutation.mutateAsync(text);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Copilot</h1>
        <p className="mt-2 text-base text-[var(--text-secondary)]">Your mental health companion is here to support you</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="surface-card flex h-[calc(100vh-220px)] min-h-[560px] flex-col p-5 sm:p-6">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
            {historyQuery.isLoading && messages.length === 0 ? (
              <div className="space-y-3">
                <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
                <div className="ml-auto h-14 w-2/3 animate-pulse rounded-2xl bg-[var(--primary-soft)]" />
              </div>
            ) : null}

            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <article
                    className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm transition-all duration-200 ${
                      isUser
                        ? "rounded-tr-md bg-[var(--primary)] text-white"
                        : "rounded-tl-md border border-[var(--border)] bg-white text-[var(--text-primary)]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-[15px] leading-7">{message.content}</p>
                    <p className={`mt-2 text-xs ${isUser ? "text-white/60" : "text-[var(--text-secondary)]"}`}>
                      {formatRelativeTime(message.timestamp)}
                    </p>
                  </article>
                </div>
              );
            })}

            {typing ? (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-md border border-[var(--border)] bg-white px-5 py-3.5 text-sm text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" style={{ animationDelay: "0ms" }} />
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" style={{ animationDelay: "150ms" }} />
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-3">
            <div className="field flex items-center gap-2 px-3 py-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={1}
                placeholder="Type your message..."
                className="w-full resize-none bg-transparent px-1 py-1 text-sm outline-none"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                aria-label="Message input"
                disabled={sendMutation.isPending || isRateLimited}
              />
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[var(--primary-dark)] hover:shadow-md disabled:opacity-50"
                onClick={() => void sendMessage()}
                disabled={sendMutation.isPending || isRateLimited || input.trim().length === 0}
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>
            <p className="mt-2 px-1 text-xs text-[var(--text-secondary)]">
              Press Enter to send, Shift+Enter for new line.
              {isRateLimited && rateLimitedUntil ? ` Try again in ${rateLimitSeconds}s.` : ""}
            </p>
          </div>
        </section>

        <aside className="surface-card hidden h-[calc(100vh-220px)] min-h-[560px] overflow-y-auto p-6 xl:block">
          <h2 className="text-lg font-semibold text-foreground">Conversation Insights</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Contextual support while you chat</p>

          {contextQuery.isError ? (
            <p className="mt-4 rounded-2xl border border-[#e0c4c0] bg-[#faf0ee] p-3 text-sm text-[#8a5a52]">
              {handleApiError(contextQuery.error)}
            </p>
          ) : null}

          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Patterns</h3>
            <ul className="mt-2.5 space-y-2 text-sm">
              {(contextQuery.data?.patterns ?? []).map((pattern) => (
                <li key={pattern} className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-foreground/80">
                  {pattern}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Recent Entries</h3>
            <ul className="mt-2.5 space-y-2 text-sm">
              {(contextQuery.data?.recentEntries ?? []).map((entry) => (
                <li key={entry.id} className="rounded-xl border border-[var(--border)] px-3.5 py-2.5">
                  <p className="line-clamp-2 text-foreground/80">{entry.content}</p>
                  <p className="mt-1.5 text-xs capitalize text-[var(--text-secondary)]">{entry.emotion}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Tips</h3>
            <ul className="mt-2.5 space-y-2 text-sm">
              {(contextQuery.data?.tips ?? []).map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-[var(--text-secondary)]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                  {tip}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
