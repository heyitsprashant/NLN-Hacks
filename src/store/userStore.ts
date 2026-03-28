import { create } from "zustand";

export type UserProfile = {
  id?: string;
  email?: string;
  name?: string;
  timezone?: string;
};

type UserState = {
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  logout: () => void;
};

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
