"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Mic, Volume2, Pause, Play, Square } from "lucide-react";
import api from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { formatRelativeTime } from "@/lib/time";

type VoiceState = "idle" | "recording" | "processing" | "speaking";

type VoiceHistoryItem = {
  id: string;
  userText: string;
  aiText: string;
  timestamp: string;
};

function getStateClasses(state: VoiceState): string {
  if (state === "recording") return "bg-[var(--emotion-anxiety)] text-white recording-pulse shadow-[0_0_30px_rgba(212,135,127,0.3)]";
  if (state === "processing") return "bg-[var(--emotion-stress)] text-white shadow-[0_0_30px_rgba(212,169,106,0.3)]";
  if (state === "speaking") return "bg-[var(--primary)] text-white shadow-[0_0_30px_rgba(139,126,200,0.3)]";
  return "bg-[var(--primary)] text-white shadow-lg hover:shadow-xl hover:scale-105";
}

export default function VoicePage() {
  const [state, setState] = useState<VoiceState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("Your AI response will appear here after processing.");
  const [volume, setVolume] = useState(0.8);
  const [speed, setSpeed] = useState(1);
  const [waveBars, setWaveBars] = useState<number[]>(Array.from({ length: 28 }, () => 6));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformRafRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);

  const historyQuery = useQuery<VoiceHistoryItem[]>({
    queryKey: ["voice-history"],
    queryFn: async () => {
      const response = await api.get("/api/voice/history");
      const data = response.data;
      if (Array.isArray(data)) return data as VoiceHistoryItem[];
      if (Array.isArray(data?.history)) return data.history as VoiceHistoryItem[];
      return [
        {
          id: "voice-1",
          userText: "I'm feeling stressed about work today.",
          aiText: "I hear that you're experiencing work-related stress. Can you tell me more about what's happening?",
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];
    },
  });

  const processMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData();
      formData.append("audio", audioBlob, "voice.webm");
      formData.append("transcript", transcript);

      const response = await api.post("/api/voice/process", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return response.data as { text?: string; response?: string; responseText?: string };
    },
    onSuccess: (data) => {
      const text = data.responseText || data.response || data.text || "I hear you. Thank you for sharing that with me.";
      setAiResponse(text);
      setState("speaking");
    },
    onError: (error) => {
      toast.error(handleApiError(error));
      setState("idle");
    },
  });

  const stopWaveform = () => {
    if (waveformRafRef.current) {
      cancelAnimationFrame(waveformRafRef.current);
      waveformRafRef.current = null;
    }
  };

  const teardownAudio = useCallback(() => {
    stopWaveform();

    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => teardownAudio();
  }, [teardownAudio]);

  const startWaveform = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const sourceArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(sourceArray);
      const bars = 28;
      const chunkSize = Math.floor(sourceArray.length / bars);
      const nextBars = Array.from({ length: bars }, (_, index) => {
        const start = index * chunkSize;
        const end = start + chunkSize;
        let total = 0;
        for (let i = start; i < end; i += 1) total += sourceArray[i];
        const avg = total / chunkSize;
        return Math.max(4, Math.round((avg / 255) * 42));
      });

      setWaveBars(nextBars);
      waveformRafRef.current = requestAnimationFrame(tick);
    };

    tick();
  };

  const startTranscription = () => {
    const SpeechRecognitionConstructor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) return;

    const recognition = new SpeechRecognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        text += event.results[i][0]?.transcript ?? "";
      }
      if (text.trim()) setTranscript(text.trim());
    };

    recognition.start();
    speechRecognitionRef.current = recognition;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) {
          setState("idle");
          return;
        }

        setState("processing");
        processMutation.mutate(blob);
      };

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNode.connect(analyser);

      mediaRecorder.start();
      setState("recording");
      startWaveform();
      startTranscription();
    } catch {
      toast.error("Microphone permission is required for voice mode.");
      setState("idle");
    }
  };

  const stopRecording = () => {
    setState("processing");
    stopWaveform();
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    mediaRecorderRef.current?.stop();
  };

  const speakResponse = () => {
    if (!("speechSynthesis" in window)) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(aiResponse);
    utterance.rate = speed;
    utterance.volume = isMuted ? 0 : volume;
    utterance.onstart = () => setState("speaking");
    utterance.onend = () => setState("idle");

    window.speechSynthesis.speak(utterance);
  };

  const pauseSpeech = () => {
    window.speechSynthesis.pause();
  };

  const resumeSpeech = () => {
    window.speechSynthesis.resume();
  };

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
    setState("idle");
  };

  const stateTitle = useMemo(() => {
    if (state === "recording") return "Recording";
    if (state === "processing") return "Processing Audio";
    if (state === "speaking") return "Speaking";
    return "Start Recording";
  }, [state]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Voice Mode</h1>
        <p className="mt-2 text-base text-[var(--text-secondary)]">Speak naturally with your AI mental health companion</p>
      </header>

      <section className="surface-card p-8 text-center sm:p-12">
        <button
          type="button"
          aria-label="Start or stop voice recording"
          className={`relative mx-auto flex h-32 w-32 items-center justify-center rounded-full transition-all duration-300 ${getStateClasses(state)}`}
          onClick={() => {
            if (state === "recording") {
              stopRecording();
              return;
            }

            if (state === "idle") {
              void startRecording();
            }
          }}
          disabled={state === "processing"}
        >
          <Mic className="h-10 w-10" />
        </button>

        <h2 className="mt-7 text-2xl font-semibold text-foreground">{stateTitle}</h2>
        <p className="mt-2 text-base text-[var(--text-secondary)]">
          {state === "idle" ? "Click the microphone to start speaking" : "Voice interaction is currently active"}
        </p>

        <button
          type="button"
          className="mt-6 rounded-2xl border border-[var(--border)] bg-white px-5 py-2 text-sm font-semibold transition-all duration-200 hover:bg-[var(--surface-muted)] hover:shadow-sm"
          onClick={() => setIsMuted((value) => !value)}
        >
          {isMuted ? "Unmute" : "Mute"}
        </button>

        <div className="mx-auto mt-6 flex h-24 max-w-md items-end justify-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
          {waveBars.map((value, index) => (
            <span
              key={`wave-${index}`}
              className="w-2 rounded-full bg-[var(--primary)] transition-all duration-75"
              style={{ height: `${value}px`, opacity: 0.4 + (value / 42) * 0.6 }}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="surface-card p-6 sm:p-7">
          <h3 className="text-lg font-semibold text-foreground">Live Transcription</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Edit transcript before sending for AI analysis</p>
          <textarea
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            rows={8}
            className="field mt-5 w-full resize-y p-4 text-sm leading-7 outline-none"
            placeholder="Your speech transcript appears here in real time..."
          />
        </section>

        <section className="surface-card p-6 sm:p-7">
          <h3 className="text-lg font-semibold text-foreground">AI Response Player</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Playback generated response with controls</p>

          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm leading-7 text-foreground/85">
            {processMutation.isPending ? "Processing your voice input..." : aiResponse}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" className="rounded-xl border border-[var(--border)] bg-white p-2.5 transition-all duration-200 hover:bg-[var(--surface-muted)] hover:shadow-sm" onClick={speakResponse}>
              <Play className="h-4 w-4 text-[var(--text-secondary)]" />
            </button>
            <button type="button" className="rounded-xl border border-[var(--border)] bg-white p-2.5 transition-all duration-200 hover:bg-[var(--surface-muted)] hover:shadow-sm" onClick={pauseSpeech}>
              <Pause className="h-4 w-4 text-[var(--text-secondary)]" />
            </button>
            <button type="button" className="rounded-xl border border-[var(--border)] bg-white p-2.5 transition-all duration-200 hover:bg-[var(--surface-muted)] hover:shadow-sm" onClick={resumeSpeech}>
              <Volume2 className="h-4 w-4 text-[var(--text-secondary)]" />
            </button>
            <button type="button" className="rounded-xl border border-[var(--border)] bg-white p-2.5 transition-all duration-200 hover:bg-[var(--surface-muted)] hover:shadow-sm" onClick={stopSpeech}>
              <Square className="h-4 w-4 text-[var(--text-secondary)]" />
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-[var(--text-secondary)]">Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                className="w-full accent-[var(--primary)]"
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-[var(--text-secondary)]">Speed</span>
              <select
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                className="field w-full px-3 py-2 outline-none"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={1.5}>1.5x</option>
              </select>
            </label>
          </div>
        </section>
      </div>

      <section className="surface-card p-6 sm:p-7">
        <h3 className="text-lg font-semibold text-foreground">Conversation History</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Your past voice interactions</p>

        {historyQuery.isError ? (
          <p className="mt-4 rounded-2xl border border-[#e0c4c0] bg-[#faf0ee] p-3 text-sm text-[#8a5a52]">
            {handleApiError(historyQuery.error)}
          </p>
        ) : null}

        <div className="mt-5 space-y-4">
          {(historyQuery.data ?? []).map((item) => (
            <article key={item.id} className="rounded-2xl border border-[var(--border)] p-5 transition-all duration-200 hover:shadow-md">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                {formatRelativeTime(item.timestamp)}
              </p>
              <p className="mt-2.5 text-sm text-foreground"><span className="font-semibold">You:</span> {item.userText}</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]"><span className="font-semibold text-foreground">AI:</span> {item.aiText}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
