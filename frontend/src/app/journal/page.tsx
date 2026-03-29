"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Search, Trash2, Upload, Send, ChevronDown, ArrowDownUp, Filter, Mic, Square, BookOpen } from "lucide-react";
import api from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { formatReadableDate, formatRelativeTime } from "@/lib/time";
import { useJournalStore, type JournalEmotion, type JournalEntry } from "@/store/journalStore";

// Minimal Web Speech API types
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

const WAVE_BARS = 18;

type EntriesResponse = {
  entries: JournalEntry[];
  page: number;
  hasMore: boolean;
};

const emotionStyles: Record<JournalEmotion, string> = {
  anxiety: "bg-[var(--emotion-anxiety)]",
  sadness: "bg-[var(--emotion-sadness)]",
  joy: "bg-[var(--emotion-joy)]",
  stress: "bg-[var(--emotion-stress)]",
  calm: "bg-[var(--emotion-calm)]",
  neutral: "bg-slate-400",
};

const emotionEmoji: Record<JournalEmotion | "neutral", string> = {
  anxiety: "😰",
  sadness: "😔",
  joy: "😊",
  stress: "😤",
  calm: "😌",
  neutral: "😐",
};

function getEmotionFromText(content: string): JournalEmotion {
  const lowered = content.toLowerCase();
  if (lowered.includes("anx")) return "anxiety";
  if (lowered.includes("stress")) return "stress";
  if (lowered.includes("sad")) return "sadness";
  if (lowered.includes("calm")) return "calm";
  if (lowered.includes("happy") || lowered.includes("joy")) return "joy";
  return "neutral";
}

function fallbackEntries(): JournalEntry[] {
  const now = Date.now();
  return [
    {
      id: "entry-1",
      content: "Had a great conversation with my team today. Feeling much more confident about the project deadline. The collaboration really helped reduce my anxiety.",
      emotion: "joy",
      createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "entry-2",
      content: "Feeling anxious about tomorrow's presentation. Can't stop thinking about all the things that could go wrong. Need to remember my breathing exercises.",
      emotion: "anxiety",
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "entry-3",
      content: "Took a long walk in the park during lunch. The weather was beautiful and it really helped clear my mind. Feeling more centered now.",
      emotion: "calm",
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function truncateText(text: string, length = 160): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length)}…`;
}

const todayLabel = new Date().toLocaleDateString(undefined, {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

export default function JournalPage() {
  const [entryText, setEntryText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [emotionFilter, setEmotionFilter] = useState<"all" | JournalEmotion>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [fileHover, setFileHover] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [waveBars, setWaveBars] = useState<number[]>(Array.from({ length: WAVE_BARS }, () => 4));
  const [liveTranscript, setLiveTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformRafRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const liveTranscriptRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { entries, setEntries, addEntry, removeEntry, setLoading } = useJournalStore();

  const entriesQuery = useInfiniteQuery<EntriesResponse>({
    queryKey: ["journal-entries"],
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get(`/api/journal/entries?page=${pageParam}&limit=20`);
      const data = response.data;
      if (Array.isArray(data)) return { entries: data as JournalEntry[], page: Number(pageParam), hasMore: false };
      if (Array.isArray(data?.entries)) return { entries: data.entries as JournalEntry[], page: typeof data.page === "number" ? data.page : Number(pageParam), hasMore: Boolean(data.hasMore) };
      return { entries: fallbackEntries(), page: 1, hasMore: false };
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });

  useEffect(() => { setLoading(entriesQuery.isFetching); }, [entriesQuery.isFetching, setLoading]);

  useEffect(() => {
    const all = entriesQuery.data?.pages.flatMap((p) => p.entries) ?? [];
    if (all.length > 0) { setEntries(all); return; }
    if (!entriesQuery.isLoading && entries.length === 0) setEntries(fallbackEntries());
  }, [entriesQuery.data, entriesQuery.isLoading, setEntries, entries.length]);

  const createMutation = useMutation({
    mutationFn: async (payload: { content: string }) => {
      const response = await api.post("/api/journal/entry", payload);
      return response.data as Partial<JournalEntry>;
    },
    onSuccess: (data) => {
      const content = entryText.trim();
      addEntry({ id: data.id ?? crypto.randomUUID(), content, emotion: (data.emotion as JournalEmotion) ?? getEmotionFromText(content), createdAt: data.createdAt ?? new Date().toISOString() });
      setEntryText("");
      setSelectedFile(null);
      toast.success("Entry saved to your journal.");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    },
    onError: (error) => toast.error(handleApiError(error)),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return (await api.post("/api/journal/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (p) => setUploadProgress(Math.round((p.loaded / (p.total ?? file.size)) * 100)),
      })).data;
    },
    onSuccess: () => {
      toast.success("File uploaded.");
      setUploadProgress(100);
      setTimeout(() => { setUploadProgress(0); setSelectedFile(null); }, 800);
    },
    onError: (error) => { toast.error(handleApiError(error)); setUploadProgress(0); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/journal/entry/${id}`); },
    onSuccess: (_data, id) => { removeEntry(id); toast.success("Entry deleted."); },
    onError: (error) => toast.error(handleApiError(error)),
  });

  const filteredEntries = useMemo(() => {
    const trimmed = searchText.trim().toLowerCase();
    return entries
      .filter((e) => (emotionFilter === "all" || e.emotion === emotionFilter) && (!trimmed || e.content.toLowerCase().includes(trimmed)))
      .sort((a, b) => { const d = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); return sortOrder === "newest" ? d : -d; });
  }, [entries, searchText, emotionFilter, sortOrder]);

  const stopWaveform = useCallback(() => {
    if (waveformRafRef.current) { cancelAnimationFrame(waveformRafRef.current); waveformRafRef.current = null; }
  }, []);

  const startWaveform = useCallback(() => {
    const analyser = analyserRef.current; if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const chunkSize = Math.floor(dataArray.length / WAVE_BARS);
      setWaveBars(Array.from({ length: WAVE_BARS }, (_, i) => {
        let s = 0; for (let j = i * chunkSize; j < (i + 1) * chunkSize; j++) s += dataArray[j];
        return Math.max(4, Math.round((s / chunkSize / 255) * 32));
      }));
      waveformRafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const startTranscription = useCallback(() => {
    const Ctor: SpeechRecognitionCtor | undefined =
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition
      ?? (window as Window & { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true; r.interimResults = true; r.lang = "en-US";
    r.onresult = (e: SpeechRecognitionEvent) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0]?.transcript ?? "";
      if (text.trim()) { liveTranscriptRef.current = text.trim(); setLiveTranscript(text.trim()); }
    };
    r.start();
    speechRecognitionRef.current = r;
  }, []);

  const startRecording = async () => {
    if (voiceState === "recording") return;
    liveTranscriptRef.current = ""; setLiveTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        stopWaveform(); setWaveBars(Array.from({ length: WAVE_BARS }, () => 4)); setVoiceState("idle");
        const finalText = liveTranscriptRef.current.trim(); setLiveTranscript("");
        if (finalText) {
          setEntryText((prev) => prev + (prev.trim() ? " " : "") + finalText);
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = "auto";
              textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            }
          }, 0);
        } else toast("No speech detected. Try again.", { icon: "🎙️" });
      };
      const audioCtx = new AudioContext(); audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser(); analyser.fftSize = 256; analyserRef.current = analyser;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      mediaRecorder.start(); setVoiceState("recording"); startWaveform(); startTranscription();
    } catch { toast.error("Microphone permission is required for voice input."); setVoiceState("idle"); }
  };

  const stopRecording = () => {
    speechRecognitionRef.current?.stop(); speechRecognitionRef.current = null;
    mediaRecorderRef.current?.stop();
  };

  useEffect(() => {
    return () => {
      stopWaveform();
      speechRecognitionRef.current?.stop();
      if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current?.state !== "closed") void audioContextRef.current?.close();
    };
  }, [stopWaveform]);

  const onFilePicked = (file?: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt")) { toast.error("Only .txt files are supported."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("File size exceeds 5MB."); return; }
    setSelectedFile(file);
  };

  return (
    <div className="animate-fade-in-up">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">

        {/* ── LEFT: Paper writing area ──────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Paper notebook card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              border: "1px solid rgba(61,112,96,0.11)",
              boxShadow: "0 4px 24px rgba(61,112,96,0.07), 0 1px 4px rgba(61,112,96,0.04)",
            }}
          >
            {/* Notebook header bar */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{
                background: "linear-gradient(135deg, #2a5045 0%, #3d7060 100%)",
                borderBottom: "3px solid #7c6fcd",
              }}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#fae4b2]" />
                <span className="text-sm font-semibold text-[#fae4b2]">
                  {todayLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#fae4b2]/30" />
                <span className="h-3 w-3 rounded-full bg-[#fae4b2]/20" />
                <span className="h-3 w-3 rounded-full bg-[#fae4b2]/10" />
              </div>
            </div>

            {/* Ruled paper surface */}
            <div
              style={{
                background: "#fffdf7",
                backgroundImage: `repeating-linear-gradient(transparent, transparent 27px, rgba(61,112,96,0.07) 28px)`,
                position: "relative",
              }}
            >
              {/* Left margin line */}
              <div
                style={{
                  position: "absolute",
                  top: 0, bottom: 0, left: "52px",
                  width: "1px",
                  background: "rgba(194,113,79,0.28)",
                  pointerEvents: "none",
                }}
              />

              {/* Line numbers */}
              <div className="absolute top-0 bottom-0 left-0 flex flex-col pt-[6px]" style={{ width: "52px", gap: "16px", pointerEvents: "none" }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <span key={i} className="block text-center select-none" style={{ fontSize: "10px", color: "rgba(61,112,96,0.16)", lineHeight: "12px" }}>
                    {i + 1}
                  </span>
                ))}
              </div>

              {/* The textarea */}
              <textarea
                ref={textareaRef}
                value={entryText}
                onChange={(e) => {
                  setEntryText(e.target.value);
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                }}
                placeholder={voiceState === "recording" ? "Listening… speak your thoughts" : "Begin writing… let your thoughts flow onto the page"}
                rows={14}
                aria-label="Journal entry"
                className="block w-full resize-none bg-transparent outline-none"
                style={{
                  minHeight: "392px",
                  paddingLeft: "68px",
                  paddingRight: "24px",
                  paddingTop: "8px",
                  paddingBottom: "16px",
                  fontSize: "15px",
                  lineHeight: "28px",
                  color: "#2d3f3f",
                  caretColor: "var(--primary-blue)",
                }}
              />

              {/* Live transcription strip */}
              {voiceState === "recording" && (
                <div
                  className="border-t px-4 py-3"
                  style={{ borderColor: "rgba(190,18,60,0.15)", background: "rgba(190,18,60,0.04)", paddingLeft: "68px" }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--accent-voice)" }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--accent-voice)" }}>Transcribing live…</span>
                    <div className="ml-2 flex items-end gap-[2px] h-5">
                      {waveBars.map((h, i) => (
                        <span key={i} className="rounded-full transition-all duration-75" style={{ width: "2px", height: `${h}px`, background: "var(--accent-voice)", opacity: 0.45 + (h / 32) * 0.55 }} />
                      ))}
                    </div>
                  </div>
                  {liveTranscript
                    ? <p className="text-sm italic leading-relaxed" style={{ color: "var(--text-secondary)" }}>"{liveTranscript}"</p>
                    : <p className="text-xs" style={{ color: "var(--text-secondary)", opacity: 0.6 }}>Speak now…</p>
                  }
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div
              className="flex items-center justify-between gap-3 px-5 py-3"
              style={{ background: "#f5faf7", borderTop: "1px solid rgba(61,112,96,0.08)" }}
            >
              <div className="flex items-center gap-3">
                {voiceState === "recording" ? (
                  <button
                    type="button"
                    aria-label="Stop recording"
                    onClick={stopRecording}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md transition hover:opacity-90"
                    style={{ background: "var(--accent-voice)" }}
                  >
                    <Square className="h-3.5 w-3.5 fill-white" />
                    <span className="absolute inset-0 animate-ping rounded-full opacity-30" style={{ background: "var(--accent-voice)" }} />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Start voice input"
                    onClick={() => void startRecording()}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-80"
                    style={{ background: "rgba(61,112,96,0.08)", color: "var(--primary-blue)" }}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {entryText.length > 0
                    ? `${entryText.length} chars · ${entryText.trim().split(/\s+/).filter(Boolean).length} words`
                    : "Start typing…"}
                </span>
              </div>
              <button
                type="button"
                disabled={createMutation.isPending || entryText.trim().length === 0}
                onClick={() => createMutation.mutate({ content: entryText.trim() })}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #2a5045 0%, #3d7060 100%)" }}
              >
                <Send className="h-4 w-4" />
                {createMutation.isPending ? "Saving…" : "Save Entry"}
              </button>
            </div>
          </div>

          {/* File upload */}
          <div
            className="rounded-xl border border-dashed p-5 text-center transition-colors"
            style={{
              borderColor: fileHover ? "var(--primary-blue)" : "rgba(61,112,96,0.18)",
              background: fileHover ? "rgba(61,112,96,0.04)" : "#f5faf7",
            }}
            onDragOver={(e) => { e.preventDefault(); setFileHover(true); }}
            onDragLeave={() => setFileHover(false)}
            onDrop={(e) => { e.preventDefault(); setFileHover(false); onFilePicked(e.dataTransfer.files?.[0]); }}
          >
            <Upload className="mx-auto h-6 w-6" style={{ color: "var(--text-secondary)" }} />
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              Drag &amp; drop a <code className="rounded px-1 text-xs" style={{ background: "rgba(61,112,96,0.07)" }}>.txt</code> file, or{" "}
              <button type="button" className="underline font-medium" style={{ color: "var(--primary-blue)" }} onClick={() => fileInputRef.current?.click()}>
                browse
              </button>
            </p>
            <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)} />

            {selectedFile && (
              <div className="mx-auto mt-3 max-w-sm rounded-lg border p-3 text-left text-sm" style={{ borderColor: "rgba(61,112,96,0.12)", background: "#fff" }}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-semibold" style={{ color: "var(--text-primary)" }}>{selectedFile.name}</p>
                  <button type="button" className="rounded-md px-3 py-1 text-xs font-semibold text-white" style={{ background: "var(--primary-blue)" }} onClick={() => uploadMutation.mutate(selectedFile)} disabled={uploadMutation.isPending}>
                    {uploadMutation.isPending ? "Uploading…" : "Upload"}
                  </button>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{Math.round(selectedFile.size / 1024)} KB</p>
                {uploadProgress > 0 && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(61,112,96,0.10)" }}>
                    <div className="h-full transition-all" style={{ width: `${uploadProgress}%`, background: "var(--primary-blue)" }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Past entries sidebar ───────────────────────────── */}
        <aside className="flex flex-col gap-4">

          {/* Search & filters */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#f5faf7", border: "1px solid rgba(61,112,96,0.10)" }}>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Past Entries</h2>

            <div className="field relative px-3 py-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
              <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search…" className="w-full bg-transparent pl-6 text-sm outline-none" aria-label="Search journal entries" />
            </div>

            <div className="flex gap-2">
              <label className="field flex flex-1 items-center gap-2 px-2 py-2 text-xs">
                <Filter className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-secondary)" }} />
                <select className="w-full bg-transparent outline-none" value={emotionFilter} onChange={(e) => setEmotionFilter(e.target.value as "all" | JournalEmotion)}>
                  <option value="all">All Moods</option>
                  <option value="anxiety">Anxiety</option>
                  <option value="stress">Stress</option>
                  <option value="sadness">Sadness</option>
                  <option value="joy">Joy</option>
                  <option value="calm">Calm</option>
                  <option value="neutral">Neutral</option>
                </select>
              </label>
              <label className="field flex flex-1 items-center gap-2 px-2 py-2 text-xs">
                <ArrowDownUp className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-secondary)" }} />
                <select className="w-full bg-transparent outline-none" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </label>
            </div>
          </div>

          {/* Entries list */}
          <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
            {entriesQuery.isError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{handleApiError(entriesQuery.error)}</div>
            )}

            {filteredEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm" style={{ borderColor: "rgba(61,112,96,0.16)", color: "var(--text-secondary)" }}>
                No entries match your filters.
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const isExpanded = Boolean(expanded[entry.id]);
                const preview = isExpanded ? entry.content : truncateText(entry.content, 160);
                return (
                  <article key={entry.id} className="rounded-xl p-4 transition-shadow" style={{ background: "#ffffff", border: "1px solid rgba(61,112,96,0.08)", boxShadow: "0 1px 4px rgba(61,112,96,0.04)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${emotionStyles[entry.emotion] || emotionStyles.neutral}`}>
                        {emotionEmoji[entry.emotion]} {entry.emotion[0].toUpperCase() + entry.emotion.slice(1)}
                      </span>
                      <button type="button" aria-label="Delete entry" className="rounded p-1 text-red-400 hover:bg-red-50 transition-colors" onClick={() => { if (window.confirm("Delete this entry permanently?")) deleteMutation.mutate(entry.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="mt-2.5 text-[13.5px] leading-6" style={{ color: "#2d3f3f" }}>{preview}</p>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }} title={formatReadableDate(entry.createdAt)}>
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                      {entry.content.length > 160 && (
                        <button type="button" className="inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: "var(--primary-blue)" }} onClick={() => setExpanded((prev) => ({ ...prev, [entry.id]: !isExpanded }))}>
                          {isExpanded ? "Less" : "More"}
                          <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}

            {entriesQuery.hasNextPage && (
              <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold transition" style={{ border: "1px solid rgba(61,112,96,0.16)", color: "var(--primary-blue)", background: "#f5faf7" }} onClick={() => entriesQuery.fetchNextPage()} disabled={entriesQuery.isFetchingNextPage}>
                {entriesQuery.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
