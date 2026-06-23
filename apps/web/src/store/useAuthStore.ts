import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserDTO } from "@sail/shared";

interface AuthState {
  token: string | null;
  user: UserDTO | null;
  setAuth: (token: string, user: UserDTO) => void;
  clear: () => void;
}

/**
 * Persisted auth state. The API client reads the token to authorize requests
 * and calls `clear()` on a 401 so the app drops back to the login screen.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: "sail-auth" },
  ),
);
