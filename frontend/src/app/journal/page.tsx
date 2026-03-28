"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Search, Trash2, Upload, Send, ChevronDown, ArrowDownUp, Filter, Mic, Square } from "lucide-react";
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

const WAVE_BARS = 24;

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
  neutral: "bg-slate-500",
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
      content:
        "Had a great conversation with my team today. Feeling much more confident about the project deadline. The collaboration really helped reduce my anxiety.",
      emotion: "joy",
      createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "entry-2",
      content:
        "Feeling anxious about tomorrow's presentation. Can't stop thinking about all the things that could go wrong. Need to remember my breathing exercises.",
      emotion: "anxiety",
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "entry-3",
      content:
        "Took a long walk in the park during lunch. The weather was beautiful and it really helped clear my mind. Feeling more centered now.",
      emotion: "calm",
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function truncateText(text: string, length = 150): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length)}...`;
}

export default function JournalPage() {
  const [entryText, setEntryText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [emotionFilter, setEmotionFilter] = useState<"all" | JournalEmotion>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [fileHover, setFileHover] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Voice state ────────────────────────────────────────────────────────────
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
  // ──────────────────────────────────────────────────────────────────────────

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { entries, setEntries, addEntry, removeEntry, setLoading } = useJournalStore();

  const entriesQuery = useInfiniteQuery<EntriesResponse>({
    queryKey: ["journal-entries"],
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get(`/api/journal/entries?page=${pageParam}&limit=20`);
      const data = response.data;

      if (Array.isArray(data)) {
        return { entries: data as JournalEntry[], page: Number(pageParam), hasMore: false };
      }

      if (Array.isArray(data?.entries)) {
        return {
          entries: data.entries as JournalEntry[],
          page: typeof data.page === "number" ? data.page : Number(pageParam),
          hasMore: Boolean(data.hasMore),
        };
      }

      return { entries: fallbackEntries(), page: 1, hasMore: false };
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });

  useEffect(() => {
    setLoading(entriesQuery.isFetching);
  }, [entriesQuery.isFetching, setLoading]);

  useEffect(() => {
    const all = entriesQuery.data?.pages.flatMap((page) => page.entries) ?? [];
    if (all.length > 0) {
      setEntries(all);
      return;
    }

    if (!entriesQuery.isLoading && entries.length === 0) {
      setEntries(fallbackEntries());
    }
  }, [entriesQuery.data, entriesQuery.isLoading, setEntries, entries.length]);

  const createMutation = useMutation({
    mutationFn: async (payload: { content: string }) => {
      const response = await api.post("/api/journal/entry", payload);
      return response.data as Partial<JournalEntry>;
    },
    onSuccess: (data) => {
      const content = entryText.trim();
      const nextEntry: JournalEntry = {
        id: data.id ?? crypto.randomUUID(),
        content,
        emotion: (data.emotion as JournalEmotion) ?? getEmotionFromText(content),
        createdAt: data.createdAt ?? new Date().toISOString(),
      };
      addEntry(nextEntry);
      setEntryText("");
      setSelectedFile(null);
      toast.success("Journal entry saved.");
      if (textareaRef.current) {
        textareaRef.current.style.height = "120px";
      }
    },
    onError: (error) => {
      toast.error(handleApiError(error));
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post("/api/journal/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progress) => {
          const total = progress.total ?? file.size;
          const nextProgress = Math.round((progress.loaded / total) * 100);
          setUploadProgress(nextProgress);
        },
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("File uploaded successfully.");
      setUploadProgress(100);
      setTimeout(() => {
        setUploadProgress(0);
        setSelectedFile(null);
      }, 800);
    },
    onError: (error) => {
      toast.error(handleApiError(error));
      setUploadProgress(0);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/journal/entry/${id}`);
    },
    onSuccess: (_data, id) => {
      removeEntry(id);
      toast.success("Entry deleted.");
    },
    onError: (error) => {
      toast.error(handleApiError(error));
    },
  });

  const filteredEntries = useMemo(() => {
    const trimmed = searchText.trim().toLowerCase();

    const next = entries.filter((entry) => {
      if (emotionFilter !== "all" && entry.emotion !== emotionFilter) return false;
      if (!trimmed) return true;
      return entry.content.toLowerCase().includes(trimmed);
    });

    return next.sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortOrder === "newest" ? diff : -diff;
    });
  }, [entries, searchText, emotionFilter, sortOrder]);

  // ── Voice: waveform ────────────────────────────────────────────────────────
  const stopWaveform = useCallback(() => {
    if (waveformRafRef.current) {
      cancelAnimationFrame(waveformRafRef.current);
      waveformRafRef.current = null;
    }
  }, []);

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

  // ── Voice: SpeechRecognition ───────────────────────────────────────────────
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

  const startRecording = async () => {
    if (voiceState === "recording") return;
    liveTranscriptRef.current = "";
    setLiveTranscript("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        stopWaveform();
        setWaveBars(Array.from({ length: WAVE_BARS }, () => 4));
        setVoiceState("idle");

        const finalText = liveTranscriptRef.current.trim();
        setLiveTranscript("");
        if (finalText) {
          // Append transcribed text to whatever is already in the textarea
          setEntryText((prev) => {
            const spacer = prev.trim().length > 0 ? " " : "";
            return prev + spacer + finalText;
          });
          // Resize textarea to fit new content
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = "120px";
              textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            }
          }, 0);
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

  const stopRecording = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    mediaRecorderRef.current?.stop();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWaveform();
      if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
      if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current?.state !== "closed") void audioContextRef.current?.close();
    };
  }, [stopWaveform]);

  const onFilePicked = (file?: File | null) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".txt")) {
      toast.error("Only .txt files are supported.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB.");
      return;
    }

    setSelectedFile(file);
  };

  return (
    <div className="space-y-6">
     
      <section className="surface-card p-5 sm:p-6">
        <h2 className="text-xl font-semibold">New Entry</h2>
        <p className="text-sm">Write about your day, feelings, or anything on your mind</p>

        <div className="mt-4">
          <div className={`field overflow-hidden transition-all ${voiceState === "recording" ? "ring-2 ring-(--accent-voice)" : ""}`}>
            <textarea
              ref={textareaRef}
              value={entryText}
              onChange={(event) => {
                setEntryText(event.target.value);
                event.currentTarget.style.height = "120px";
                event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
              }}
              placeholder={voiceState === "recording" ? "Listening… speak now" : "Start writing, or press the mic to speak your thoughts…"}
              className="min-h-[120px] w-full resize-none bg-transparent p-4 text-sm outline-none"
              rows={3}
              aria-label="Journal entry text"
            />

            {/* Live transcription strip */}
            {voiceState === "recording" && (
              <div className="border-t border-(--border) bg-[var(--accent-voice)]/5 px-4 py-2.5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-voice)]" />
                  <span className="text-xs font-semibold text-[var(--accent-voice)]">Transcribing live…</span>
                </div>
                {/* Waveform */}
                <div className="flex h-8 items-center gap-[2px]">
                  {waveBars.map((h, i) => (
                    <span
                      key={`bar-${i}`}
                      className="w-[3px] rounded-full bg-[var(--accent-voice)] transition-all duration-75"
                      style={{ height: `${h}px`, opacity: 0.5 + (h / 36) * 0.5 }}
                    />
                  ))}
                </div>
                {liveTranscript ? (
                  <p className="mt-2 text-sm italic text-[var(--text-secondary)] leading-relaxed">
                    "{liveTranscript}"
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-[var(--text-secondary)] opacity-60">Speak now…</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-(--text-secondary)">{entryText.length} characters</span>
            {/* Mic / Stop button */}
            {voiceState === "recording" ? (
              <button
                type="button"
                aria-label="Stop recording"
                className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-voice)] text-white shadow-md transition hover:opacity-90"
                onClick={stopRecording}
              >
                <Square className="h-3 w-3 fill-white" />
                <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent-voice)] opacity-30" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Start voice input"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-(--border) bg-white text-(--text-secondary) shadow-sm transition hover:border-(--primary-blue) hover:text-(--primary-blue)"
                onClick={() => void startRecording()}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={createMutation.isPending || entryText.trim().length === 0}
            onClick={() => createMutation.mutate({ content: entryText.trim() })}
          >
            <Send className="h-4 w-4" />
            {createMutation.isPending ? "Saving..." : "Save Entry"}
          </button>
        </div>

        <div
          className={`mt-6 rounded-xl border border-dashed p-8 text-center ${fileHover ? "border-[var(--primary-blue)] bg-blue-50" : "border-[var(--border)] bg-[var(--surface-muted)]"}`}
          onDragOver={(event) => {
            event.preventDefault();
            setFileHover(true);
          }}
          onDragLeave={() => setFileHover(false)}
          onDrop={(event) => {
            event.preventDefault();
            setFileHover(false);
            onFilePicked(event.dataTransfer.files?.[0]);
          }}
        >
          <Upload className="mx-auto h-7 w-7 text-[var(--text-secondary)]" />
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Drag and drop a .txt file here, or</p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-muted)]"
            onClick={() => fileInputRef.current?.click()}
          >
            Browse Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            className="hidden"
            onChange={(event) => onFilePicked(event.target.files?.[0] ?? null)}
          />
          <p className="mt-2 text-xs text-[var(--text-secondary)]">Max file size: 5MB</p>

          {selectedFile ? (
            <div className="mx-auto mt-4 max-w-lg rounded-lg border border-[var(--border)] bg-white p-3 text-left text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-semibold">{selectedFile.name}</p>
                <button
                  type="button"
                  className="rounded-md bg-[var(--primary-blue)] px-3 py-1.5 text-xs font-semibold text-white"
                  onClick={() => uploadMutation.mutate(selectedFile)}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? "Uploading..." : "Upload"}
                </button>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{Math.round(selectedFile.size / 1024)} KB</p>
              {uploadProgress > 0 ? (
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full bg-[var(--primary-blue)]" style={{ width: `${uploadProgress}%` }} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface-card p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_260px_240px]">
          <div className="field relative px-3 py-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search entries..."
              className="w-full bg-transparent pl-6 text-sm outline-none"
              aria-label="Search journal entries"
            />
          </div>

          <label className="field flex items-center gap-2 px-3 py-2 text-sm">
            <Filter className="h-4 w-4 text-[var(--text-secondary)]" />
            <select
              className="w-full bg-transparent outline-none"
              value={emotionFilter}
              onChange={(event) => setEmotionFilter(event.target.value as "all" | JournalEmotion)}
            >
              <option value="all">All Emotions</option>
              <option value="anxiety">Anxiety</option>
              <option value="stress">Stress</option>
              <option value="sadness">Sadness</option>
              <option value="joy">Joy</option>
              <option value="calm">Calm</option>
              <option value="neutral">Neutral</option>
            </select>
          </label>

          <label className="field flex items-center gap-2 px-3 py-2 text-sm">
            <ArrowDownUp className="h-4 w-4 text-[var(--text-secondary)]" />
            <select
              className="w-full bg-transparent outline-none"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-4">
        {entriesQuery.isError ? (
          <div className="surface-card p-4 text-sm text-red-700">{handleApiError(entriesQuery.error)}</div>
        ) : null}

        {filteredEntries.length === 0 ? (
          <div className="surface-card p-6 text-sm text-[var(--text-secondary)]">No entries match your current filters.</div>
        ) : (
          filteredEntries.map((entry) => {
            const isExpanded = Boolean(expanded[entry.id]);
            const preview = isExpanded ? entry.content : truncateText(entry.content, 150);
            return (
              <article key={entry.id} className="surface-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold text-white ${
                        emotionStyles[entry.emotion] || emotionStyles.neutral
                      }`}
                    >
                      {entry.emotion[0].toUpperCase() + entry.emotion.slice(1)}
                    </span>
                    <span className="text-sm text-[var(--text-secondary)]" title={formatReadableDate(entry.createdAt)}>
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                    aria-label="Delete journal entry"
                    onClick={() => {
                      const confirmed = window.confirm("Delete this journal entry permanently?");
                      if (!confirmed) return;
                      deleteMutation.mutate(entry.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-4 text-[15px] leading-7 text-[#1f2937]">{preview}</p>

                {entry.content.length > 150 ? (
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]"
                    onClick={() => setExpanded((prev) => ({ ...prev, [entry.id]: !isExpanded }))}
                  >
                    {isExpanded ? "Show less" : "Show more"}
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                ) : null}
              </article>
            );
          })
        )}

        {entriesQuery.hasNextPage ? (
          <button
            type="button"
            className="mx-auto block rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-muted)]"
            onClick={() => entriesQuery.fetchNextPage()}
            disabled={entriesQuery.isFetchingNextPage}
          >
            {entriesQuery.isFetchingNextPage ? "Loading more..." : "Load more entries"}
          </button>
        ) : null}
      </section>
    </div>
  );
}
