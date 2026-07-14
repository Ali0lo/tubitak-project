import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  hasHydrated: boolean;
  setSession: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  setHasHydrated: (value: boolean) => void;
}

/**
 * Holds the current user and short-lived access token in memory,
 * persisted to localStorage so a page refresh doesn't force a
 * re-login. The refresh token itself never touches JS — it lives in
 * an httpOnly cookie set by auth-service and is only ever sent
 * automatically by the browser to /auth/refresh.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      hasHydrated: false,
      setSession: (user, accessToken) => set({ user, accessToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearSession: () => set({ user: null, accessToken: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "todotak-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
