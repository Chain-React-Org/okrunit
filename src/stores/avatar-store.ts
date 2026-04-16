import { create } from "zustand";

interface AvatarState {
  /** Optimistic override for the current user's avatar URL. null = use server value, undefined = not set. */
  avatarUrl: string | null | undefined;
  setAvatarUrl: (url: string | null) => void;
  clear: () => void;
}

export const useAvatarStore = create<AvatarState>()((set) => ({
  avatarUrl: undefined,
  setAvatarUrl: (avatarUrl) => set({ avatarUrl }),
  clear: () => set({ avatarUrl: undefined }),
}));
