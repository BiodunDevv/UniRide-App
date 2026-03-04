import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi } from "@/lib/api";

const SEEN_IDS_KEY = "notification_seen_ids";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Notification {
  _id: string;
  title: string;
  message: string;
  type:
    | "broadcast"
    | "ride"
    | "booking"
    | "system"
    | "promotion"
    | "security"
    | "account";
  is_read: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  pollingInterval: ReturnType<typeof setInterval> | null;
  /** IDs of notifications already shown as in-app toasts */
  seenIds: Set<string>;
  /** Queue of notifications waiting to be shown as toasts */
  toastQueue: Notification[];

  fetchNotifications: (limit?: number) => Promise<void>;
  fetchDetail: (id: string) => Promise<Notification | null>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
  /** Remove the front-of-queue toast (after it has been shown) */
  dismissToast: (id: string) => void;
  /** Load persisted seenIds from storage — call once on auth */
  loadSeenIds: () => Promise<void>;
  /** Wipe seenIds (e.g. after logout so fresh toasts show on next login) */
  resetSeenIds: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function persistSeenIds(ids: Set<string>) {
  try {
    // Keep only the latest 500 to prevent unbounded growth
    const arr = Array.from(ids).slice(-500);
    await AsyncStorage.setItem(SEEN_IDS_KEY, JSON.stringify(arr));
  } catch {}
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  pollingInterval: null,
  seenIds: new Set(),
  toastQueue: [],

  loadSeenIds: async () => {
    try {
      const raw = await AsyncStorage.getItem(SEEN_IDS_KEY);
      if (raw) {
        const arr: string[] = JSON.parse(raw);
        set({ seenIds: new Set(arr) });
      }
    } catch {}
  },

  resetSeenIds: () => {
    set({ seenIds: new Set(), toastQueue: [] });
    AsyncStorage.removeItem(SEEN_IDS_KEY).catch(() => {});
  },

  fetchNotifications: async (limit = 50) => {
    try {
      const res = await authApi.getNotifications({ limit });
      const incoming: Notification[] = res.data || [];
      const { seenIds } = get();

      // Detect brand-new unread notifications not yet shown as toast
      const newToasts = incoming.filter(
        (n) => !n.is_read && !seenIds.has(n._id),
      );

      if (newToasts.length > 0) {
        const updatedSeenIds = new Set(seenIds);
        newToasts.forEach((n) => updatedSeenIds.add(n._id));
        persistSeenIds(updatedSeenIds);

        set((state) => ({
          notifications: incoming,
          unreadCount: res.unread_count || 0,
          isLoading: false,
          seenIds: updatedSeenIds,
          // Append new toasts — show at most 3 in queue at once to avoid spam
          toastQueue: [...state.toastQueue, ...newToasts].slice(0, 3),
        }));
      } else {
        set({
          notifications: incoming,
          unreadCount: res.unread_count || 0,
          isLoading: false,
        });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  dismissToast: (id: string) => {
    set((state) => ({
      toastQueue: state.toastQueue.filter((n) => n._id !== id),
    }));
  },

  fetchDetail: async (id: string) => {
    try {
      const res = await authApi.getNotificationDetail(id);
      const notification = res.data as Notification;
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n._id === id ? { ...n, is_read: true } : n,
        ),
        unreadCount: state.notifications.find((n) => n._id === id && !n.is_read)
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      }));
      return notification;
    } catch {
      return null;
    }
  },

  markRead: async (id: string) => {
    try {
      await authApi.markNotificationRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n._id === id ? { ...n, is_read: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {}
  },

  markAllRead: async () => {
    try {
      await authApi.markAllNotificationsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          is_read: true,
        })),
        unreadCount: 0,
      }));
    } catch {}
  },

  clearAll: async () => {
    try {
      await authApi.clearAllNotifications();
      set({ notifications: [], unreadCount: 0 });
    } catch {}
  },

  startPolling: (intervalMs = 15000) => {
    const existing = get().pollingInterval;
    if (existing) clearInterval(existing);

    set({ isLoading: true });
    get().fetchNotifications();

    const interval = setInterval(() => {
      get().fetchNotifications();
    }, intervalMs);

    set({ pollingInterval: interval });
  },

  stopPolling: () => {
    const interval = get().pollingInterval;
    if (interval) {
      clearInterval(interval);
      set({ pollingInterval: null });
    }
  },
}));
