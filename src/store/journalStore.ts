import { create } from "zustand";

export type JournalEmotion = "anxiety" | "sadness" | "joy" | "stress" | "calm" | "neutral";

export type JournalEntry = {
  id: string;
  content: string;
  emotion: JournalEmotion;
  createdAt: string;
};

type JournalState = {
  entries: JournalEntry[];
  loading: boolean;
  setEntries: (entries: JournalEntry[]) => void;
  addEntry: (entry: JournalEntry) => void;
  removeEntry: (id: string) => void;
  setLoading: (loading: boolean) => void;
};

export const useJournalStore = create<JournalState>((set) => ({
  entries: [],
  loading: false,
  setEntries: (entries) => set({ entries }),
  addEntry: (entry) => set((state) => ({ entries: [entry, ...state.entries] })),
  removeEntry: (id) => set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),
  setLoading: (loading) => set({ loading }),
}));
