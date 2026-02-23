import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PostHogWebClient } from "@/api/client";

interface AuthState {
  apiHost: string;
  token: string;
  isAuthenticated: boolean;
  client: PostHogWebClient | null;
  setCredentials: (apiHost: string, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      apiHost: "https://us.posthog.com",
      token: "",
      isAuthenticated: false,
      client: null,
      setCredentials: (apiHost, token) => {
        const client = new PostHogWebClient(token, apiHost);
        set({ apiHost, token, isAuthenticated: true, client });
      },
      logout: () =>
        set({
          token: "",
          isAuthenticated: false,
          client: null,
        }),
    }),
    {
      name: "twig-web-auth",
      partialize: (state) => ({
        apiHost: state.apiHost,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<AuthState>;
        const merged = {
          ...current,
          ...p,
          client:
            p?.isAuthenticated && p?.token
              ? new PostHogWebClient(p.token, p.apiHost ?? current.apiHost)
              : null,
        };
        return merged;
      },
    },
  ),
);
