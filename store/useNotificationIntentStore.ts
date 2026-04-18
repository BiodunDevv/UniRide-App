import { create } from "zustand";

type NotificationIntentPayload = Record<string, any>;

interface NotificationIntentState {
  pendingPayload: NotificationIntentPayload | null;
  pendingResponseKey: string | null;
  lastHandledResponseKey: string | null;
  setPendingIntent: (
    payload: NotificationIntentPayload,
    responseKey?: string | null,
  ) => void;
  clearPendingIntent: () => void;
  markResponseHandled: (responseKey?: string | null) => void;
}

export const useNotificationIntentStore = create<NotificationIntentState>(
  (set, get) => ({
    pendingPayload: null,
    pendingResponseKey: null,
    lastHandledResponseKey: null,

    setPendingIntent: (payload, responseKey) => {
      if (!payload || typeof payload !== "object") return;
      if (
        responseKey &&
        get().lastHandledResponseKey &&
        get().lastHandledResponseKey === responseKey
      ) {
        return;
      }

      set({
        pendingPayload: payload,
        pendingResponseKey: responseKey || null,
      });
    },

    clearPendingIntent: () => {
      set({ pendingPayload: null, pendingResponseKey: null });
    },

    markResponseHandled: (responseKey) => {
      if (!responseKey) return;

      set((state) => {
        const shouldClearPending = state.pendingResponseKey === responseKey;
        return {
          lastHandledResponseKey: responseKey,
          pendingPayload: shouldClearPending ? null : state.pendingPayload,
          pendingResponseKey: shouldClearPending
            ? null
            : state.pendingResponseKey,
        };
      });
    },
  }),
);
