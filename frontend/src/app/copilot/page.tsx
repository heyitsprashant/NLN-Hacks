"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Send, Mic, Square, Volume2, VolumeX } from "lucide-react";
import api from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { formatRelativeTime } from "@/lib/time";
import { useChatStore, type ChatMessage } from "@/store/chatStore";

type CopilotContext = {
  patterns?: string[];
  recentEntries?: Array<{ id: string; content: string; emotion: string }>;
  tips?: string[];
};

// Minimal Web Speech API types (not present in all TS lib configurations)
interface SpeechRecognitionAlternative { transcript: string }
interface SpeechRecognitionResult { [index: number]: SpeechRecognitionAlternative }
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type VoiceState = "idle" | "recording";

const LOCAL_STORAGE_KEY = "mindcare-copilot-history";
const WAVE_BARS = 20;

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

  // ── Voice state ────────────────────────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [waveBars, setWaveBars] = useState<number[]>(
    Array.from({ length: WAVE_BARS }, () => 4)
  );
  // Live transcription shown in the chat bubble while recording
  const [liveTranscript, setLiveTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformRafRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const liveTranscriptRef = useRef("");
  const lastSentViaVoiceRef = useRef(false);
  // ──────────────────────────────────────────────────────────────────────────

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
        patterns: Array.isArray(data?.patterns)
          ? data.patterns
          : ["Anxiety before meetings", "Better mood after social contact"],
        recentEntries: Array.isArray(data?.recentEntries)
          ? data.recentEntries
          : [{ id: "entry-1", content: "Felt overwhelmed before stand-up but calmer after team support.", emotion: "anxiety" }],
        tips: Array.isArray(data?.tips)
          ? data.tips
          : ["Try a 4-7-8 breathing cycle", "Break presentation prep into 20-minute sessions"],
      };
    },
  });

  useEffect(() => {
    if (historyQuery.data?.length) { setMessages(historyQuery.data); return; }
    if (!historyQuery.isLoading) {
      const local = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) {
        try { setMessages(normalizeMessages(JSON.parse(local))); return; }
        catch { window.localStorage.removeItem(LOCAL_STORAGE_KEY); }
      }
      setMessages([{
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Hello. I'm your mental health companion. How are you feeling today?",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      }]);
    }
  }, [historyQuery.data, historyQuery.isLoading, setMessages]);

  useEffect(() => {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  // Scroll to bottom as live transcription text grows during recording
  useEffect(() => {
    if (!scrollRef.current || !liveTranscript) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [liveTranscript]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Cleanup audio on unmount
  const stopWaveform = useCallback(() => {
    if (waveformRafRef.current) {
      cancelAnimationFrame(waveformRafRef.current);
      waveformRafRef.current = null;
    }
  }, []);

  const teardownAudio = useCallback(() => {
    stopWaveform();
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, [stopWaveform]);

  useEffect(() => () => teardownAudio(), [teardownAudio]);

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const lastMinuteMessages = useMemo(
    () => messages.filter((m) => m.role === "user" && nowTs - new Date(m.timestamp).getTime() <= 60_000).length,
    [messages, nowTs]
  );
  const isRateLimited = rateLimitedUntil ? nowTs < rateLimitedUntil : false;
  const rateLimitSeconds = rateLimitedUntil ? Math.max(1, Math.ceil((rateLimitedUntil - nowTs) / 1000)) : 0;

  // ── Text-to-speech ────────────────────────────────────────────────────────
  const speakText = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  // ── Send mutation ─────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await api.post("/api/copilot/message", { message: text });
      return response.data as { message?: string; content?: string };
    },
    onMutate: () => setTyping(true),
    onSuccess: (data) => {
      const content = data?.message || data?.content || "I'm here with you. Tell me more.";
      addMessage({ id: crypto.randomUUID(), role: "assistant", content, timestamp: new Date().toISOString() });
      if (autoSpeak && lastSentViaVoiceRef.current) {
        lastSentViaVoiceRef.current = false;
        speakText(content);
      }
    },
    onError: (error) => toast.error(handleApiError(error)),
    onSettled: () => setTyping(false),
  });

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text) return;
    if (lastMinuteMessages >= 6) {
      setRateLimitedUntil(Date.now() + 30_000);
      toast.error("Too many messages too quickly. Please wait a few seconds.");
      return;
    }
    addMessage({ id: crypto.randomUUID(), role: "user", content: text, timestamp: new Date().toISOString() });
    setInput("");
    await sendMutation.mutateAsync(text);
  };

  // ── Voice: waveform visualiser ────────────────────────────────────────────
  const startWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const chunkSize = Math.floor(dataArray.length / WAVE_BARS);
      const next = Array.from({ length: WAVE_BARS }, (_, i) => {
        let sum = 0;
        for (let j = i * chunkSize; j < (i + 1) * chunkSize; j++) sum += dataArray[j];
        return Math.max(4, Math.round((sum / chunkSize / 255) * 36));
      });
      setWaveBars(next);
      waveformRafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  // ── Voice: browser SpeechRecognition ──────────────────────────────────────
  const startTranscription = useCallback(() => {
    const SpeechRecognitionCtor: SpeechRecognitionCtor | undefined =
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition
      ?? (window as Window & { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0]?.transcript ?? "";
      }
      if (text.trim()) {
        liveTranscriptRef.current = text.trim();
        setLiveTranscript(text.trim());
      }
    };

    recognition.start();
    speechRecognitionRef.current = recognition;
  }, []);

  // ── Voice: start recording ────────────────────────────────────────────────
  const startRecording = async () => {
    if (voiceState === "recording") return;
    // Stop any ongoing TTS before recording
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    liveTranscriptRef.current = "";
    setLiveTranscript("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        // Release mic
        streamRef.current?.getTracks().forEach((t) => t.stop());
        stopWaveform();
        setWaveBars(Array.from({ length: WAVE_BARS }, () => 4));
        setVoiceState("idle");
        setLiveTranscript("");

        const finalText = liveTranscriptRef.current.trim();
        if (finalText) {
          setInput(finalText);
          lastSentViaVoiceRef.current = true;
          void sendMessage(finalText);
        } else {
          toast("No speech detected. Try again.", { icon: "🎙️" });
        }
      };

      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      audioCtx.createMediaStreamSource(stream).connect(analyser);

      mediaRecorder.start();
      setVoiceState("recording");
      startWaveform();
      startTranscription();
    } catch {
      toast.error("Microphone permission is required for voice input.");
      setVoiceState("idle");
    }
  };

  // ── Voice: stop recording ─────────────────────────────────────────────────
  const stopRecording = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    mediaRecorderRef.current?.stop();
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[2.2rem] font-bold tracking-tight">AI Copilot</h1>
        <p className="mt-1 text-lg text-(--text-secondary)">
          Your mental health companion is here to support you
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* ── Chat panel ──────────────────────────────────────────────────── */}
        <section className="surface-card flex h-[calc(100vh-220px)] min-h-[560px] flex-col p-4 sm:p-5">

          {/* Message list */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
            {historyQuery.isLoading && messages.length === 0 ? (
              <div className="space-y-2">
                <div className="h-16 w-2/3 animate-pulse rounded-xl bg-gray-100" />
                <div className="ml-auto h-14 w-2/3 animate-pulse rounded-xl bg-purple-100" />
              </div>
            ) : null}

            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <article
                    className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                      isUser
                        ? "rounded-tr-sm bg-(--primary-blue) text-white"
                        : "rounded-tl-sm border border-(--border) bg-white text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-[15px] leading-7">{message.content}</p>
                    <p className={`mt-2 text-xs ${isUser ? "text-purple-200" : "text-(--text-secondary)"}`}>
                      {formatRelativeTime(message.timestamp)}
                    </p>
                  </article>
                </div>
              );
            })}

            {/* Live transcription ghost bubble while recording */}
            {voiceState === "recording" && (
              <div className="flex justify-end">
                <article className="max-w-[85%] rounded-2xl rounded-tr-sm border-2 border-dashed border-red-300 bg-red-50 px-4 py-3 shadow-sm">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    <span className="text-xs font-semibold tracking-wide text-red-500">
                      Transcribing…
                    </span>
                  </div>
                  <p className="min-h-[24px] whitespace-pre-wrap text-[15px] italic leading-7 text-red-800">
                    {liveTranscript ? liveTranscript : (
                      <span className="opacity-40">Speak now…</span>
                    )}
                  </p>
                </article>
              </div>
            )}

            {typing ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-(--border) bg-white px-4 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-(--primary-blue) [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-(--primary-blue) [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-(--primary-blue) [animation-delay:300ms]" />
                </div>
              </div>
            ) : null}
          </div>

          {/* ── Input bar ─────────────────────────────────────────────────── */}
          <div className="mt-4 rounded-xl border border-(--border) bg-white p-3">

            {voiceState === "recording" ? (
              /* Waveform strip while recording */
              <div className="flex h-11 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3">
                {waveBars.map((h, i) => (
                  <span
                    key={`bar-${i}`}
                    className="w-1 rounded-full bg-red-500 transition-all duration-75"
                    style={{ height: `${h}px` }}
                  />
                ))}
                <span className="ml-2 animate-pulse text-xs font-semibold text-red-600">
                  Listening…
                </span>
              </div>
            ) : (
              <div className="field flex items-center gap-2 px-2 py-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={1}
                  placeholder="Type your message or press the mic…"
                  className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
                  }}
                  aria-label="Message input"
                  disabled={sendMutation.isPending || isRateLimited}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
                  onClick={() => void sendMessage()}
                  disabled={sendMutation.isPending || isRateLimited || input.trim().length === 0}
                >
                  <Send className="h-4 w-4" />
                  Send
                </button>
              </div>
            )}

            {/* Bottom row: hint + mic + auto-speak */}
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-(--text-secondary)">
                {voiceState === "recording"
                  ? "Speak now — press ■ to stop and send."
                  : isRateLimited
                  ? `Rate limited. Try again in ${rateLimitSeconds}s.`
                  : "Enter to send · Shift+Enter for new line · 🎙 for voice"}
              </p>

              <div className="flex items-center gap-1.5">
                {/* Auto-speak toggle */}
                <button
                  type="button"
                  title={autoSpeak ? "Auto-speak ON — click to mute AI voice" : "Auto-speak OFF — click to enable AI voice"}
                  className={`rounded-lg p-1.5 transition-colors ${
                    autoSpeak
                      ? "bg-(--primary-soft) text-(--primary-blue)"
                      : "border border-(--border) text-(--text-secondary)"
                  }`}
                  onClick={() => {
                    if (autoSpeak && "speechSynthesis" in window) window.speechSynthesis.cancel();
                    setAutoSpeak((v) => !v);
                  }}
                >
                  {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>

                {/* Mic / Stop button */}
                {voiceState === "recording" ? (
                  <button
                    type="button"
                    aria-label="Stop recording"
                    className="relative flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition hover:bg-red-600"
                    onClick={stopRecording}
                  >
                    <Square className="h-3.5 w-3.5 fill-white" />
                    {/* pulse ring */}
                    <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-50" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Start voice input"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-(--border) bg-white text-(--text-secondary) shadow-sm transition hover:border-(--primary-blue) hover:text-(--primary-blue) disabled:opacity-40"
                    onClick={() => void startRecording()}
                    disabled={sendMutation.isPending || isRateLimited}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Context sidebar ──────────────────────────────────────────────── */}
        <aside className="surface-card hidden h-[calc(100vh-220px)] min-h-[560px] overflow-y-auto p-5 xl:block">
          <h2 className="text-lg font-semibold">Conversation Insights</h2>
          <p className="mt-1 text-sm text-(--text-secondary)">Contextual support while you chat</p>

          {contextQuery.isError ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {handleApiError(contextQuery.error)}
            </p>
          ) : null}

          <section className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Patterns</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {(contextQuery.data?.patterns ?? []).map((pattern) => (
                <li key={pattern} className="rounded-lg border border-(--border) bg-(--surface-muted) px-3 py-2">
                  {pattern}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Recent Entries</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {(contextQuery.data?.recentEntries ?? []).map((entry) => (
                <li key={entry.id} className="rounded-lg border border-(--border) px-3 py-2">
                  <p className="line-clamp-2">{entry.content}</p>
                  <p className="mt-1 text-xs capitalize text-(--text-secondary)">{entry.emotion}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Tips</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-(--text-secondary)">
              {(contextQuery.data?.tips ?? []).map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>

          {/* Voice mode info */}
          <section className="mt-6 rounded-xl border border-(--border) bg-(--surface-muted) p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Mic className="h-4 w-4 text-(--primary-blue)" />
              Voice Mode
            </h3>
            <p className="mt-2 text-xs text-(--text-secondary) leading-relaxed">
              Press the <strong>mic button</strong> in the input bar to speak. Your words are transcribed live and sent to the AI. Toggle the <strong>speaker icon</strong> to have AI responses read aloud automatically.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
