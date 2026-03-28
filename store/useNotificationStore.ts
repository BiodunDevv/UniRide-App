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
  error: string | null;

  fetchNotifications: (limit?: number) => Promise<void>;
  fetchDetail: (id: string) => Promise<Notification | null>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchNotifications: async (limit = 50) => {
    try {
      set((state) => ({
        isLoading: state.notifications.length === 0,
        error: null,
      }));
      const res = await authApi.getNotifications({ limit });
      const incoming: Notification[] = res.data || [];
      set({
        notifications: incoming,
        unreadCount: res.unread_count || 0,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error?.message || "Failed to load notifications",
      });
    }
  },

  fetchDetail: async (id: string) => {
    try {
      const res = await authApi.getNotificationDetail(id);
      const notification = res.data as Notification;
      set((state) => ({
        notifications: state.notifications.some((n) => n._id === id)
          ? state.notifications.map((n) =>
              n._id === id ? { ...notification, is_read: true } : n,
            )
          : [{ ...notification, is_read: true }, ...state.notifications],
        unreadCount: state.notifications.find((n) => n._id === id && !n.is_read)
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
        error: null,
      }));
      return notification;
    } catch {
      return null;
    }
  },

  markRead: async (id: string) => {
    try {
      await authApi.markNotificationRead(id);
      set((state) => {
        const wasUnread = state.notifications.some(
          (n) => n._id === id && !n.is_read,
        );

        return {
          notifications: state.notifications.map((n) =>
            n._id === id ? { ...n, is_read: true } : n,
          ),
          unreadCount: wasUnread
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
        };
      });
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
}));
