import { create } from "zustand";
import { authApi } from "@/lib/api";

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

  fetchNotifications: (limit?: number) => Promise<void>;
  fetchDetail: (id: string) => Promise<Notification | null>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  pollingInterval: null,

  fetchNotifications: async (limit = 50) => {
    try {
      const res = await authApi.getNotifications({ limit });
      set({
        notifications: res.data || [],
        unreadCount: res.unread_count || 0,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchDetail: async (id: string) => {
    try {
      const res = await authApi.getNotificationDetail(id);
      const notification = res.data as Notification;
      // Mark as read locally
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
    } catch {
      // Silently fail
    }
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
    } catch {
      // Silently fail
    }
  },

  clearAll: async () => {
    try {
      await authApi.clearAllNotifications();
      set({ notifications: [], unreadCount: 0 });
    } catch {
      // Silently fail
    }
  },

  startPolling: (intervalMs = 15000) => {
    const existing = get().pollingInterval;
    if (existing) clearInterval(existing);

    // Fetch immediately
    set({ isLoading: true });
    get().fetchNotifications();

    // Then poll
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
