import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DashboardRoute = "/(users)" | "/(drivers)";

interface BootstrapState {
  isBooting: boolean;
  isReady: boolean;
  safeMode: boolean;
  stage: string | null;
  lastError: string | null;
  lastSuccessfulRoute: DashboardRoute | null;
  begin: (stage?: string) => void;
  advance: (stage: string) => void;
  complete: (route: DashboardRoute) => void;
  fail: (message: string) => void;
  enableSafeMode: () => void;
  disableSafeMode: () => void;
  resetTransient: () => void;
}

export const useBootstrapStore = create<BootstrapState>()(
  persist(
    (set) => ({
      isBooting: false,
      isReady: false,
      safeMode: false,
      stage: null,
      lastError: null,
      lastSuccessfulRoute: null,

      begin: (stage = "starting") =>
        set({
          isBooting: true,
          isReady: false,
          stage,
          lastError: null,
        }),

      advance: (stage) =>
        set({
          isBooting: true,
          stage,
          lastError: null,
        }),

      complete: (route) =>
        set({
          isBooting: false,
          isReady: true,
          stage: "ready",
          lastError: null,
          lastSuccessfulRoute: route,
        }),

      fail: (message) =>
        set({
          isBooting: false,
          isReady: false,
          stage: "failed",
          lastError: message,
        }),

      enableSafeMode: () => set({ safeMode: true }),
      disableSafeMode: () => set({ safeMode: false }),

      resetTransient: () =>
        set({
          isBooting: false,
          isReady: false,
          stage: null,
          lastError: null,
        }),
    }),
    {
      name: "bootstrap-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lastSuccessfulRoute: state.lastSuccessfulRoute,
      }),
    },
  ),
);
