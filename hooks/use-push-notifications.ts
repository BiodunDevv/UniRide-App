import { useEffect, useRef, useCallback } from "react";
import { Platform, AppState } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/useAuthStore";
import { registerPreLogoutHook } from "@/store/useAuthStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { authApi } from "@/lib/api";
import { usePushDebugStore } from "@/store/usePushDebugStore";
import {
  canUseNativePush,
  getExpoPushRegistration,
  loadNotificationsModule,
} from "@/lib/pushNotifications";
import { getNotificationRoute } from "@/lib/notificationPresentation";

// ─── Hook ────────────────────────────────────────────────────────────────────
export function usePushNotifications(enabled = true) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const pushTokenRef = useRef<string | null>(null);
  const registeredRef = useRef(false);
  const handledResponseRef = useRef<string | null>(null);
  const notificationsRef =
    useRef<typeof import("expo-notifications") | null>(null);

  const routeBase: "(users)" | "(drivers)" =
    user?.role === "driver" ? "(drivers)" : "(users)";

  const navigateFromNotification = useCallback(
    (payload?: Record<string, any> | null, responseKey?: string | null) => {
      if (!useAuthStore.getState().token) return;
      if (responseKey && handledResponseRef.current === responseKey) return;
      if (responseKey) {
        handledResponseRef.current = responseKey;
      }
      const target = getNotificationRoute(
        {
          type: String(payload?.category || payload?.type || "system") as any,
          metadata: payload || {},
        },
        routeBase,
      );
      router.push(target as any);
    },
    [routeBase, router],
  );

  useEffect(() => {
    usePushDebugStore
      .getState()
      .setNativePushAvailable(canUseNativePush());
    const Notifications = loadNotificationsModule();
    notificationsRef.current = Notifications;

    if (!enabled || !Notifications) return;

    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch {
      console.warn("[Push] Failed to set notification handler");
    }

    if (Platform.OS === "android") {
      Promise.allSettled([
        Notifications.setNotificationChannelAsync("default", {
          name: "UniRide",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#042F40",
          sound: "default",
        }),
        Notifications.setNotificationChannelAsync("rides", {
          name: "Ride updates",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 180, 120, 180],
          lightColor: "#2563EB",
          sound: "default",
        }),
        Notifications.setNotificationChannelAsync("bookings", {
          name: "Booking updates",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 160, 100, 160],
          lightColor: "#D4A017",
          sound: "default",
        }),
        Notifications.setNotificationChannelAsync("announcements", {
          name: "Announcements",
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 220, 180, 220],
          lightColor: "#7C3AED",
          sound: "default",
        }),
      ]).catch(() => {
        console.warn("[Push] Failed to create Android notification channels");
      });
    }
  }, [enabled]);

  // Register push token with backend
  const registerToken = useCallback(async () => {
    if (!notificationsRef.current && !loadNotificationsModule()) return;
    const currentToken = useAuthStore.getState().token;
    if (!currentToken) return;

    const registration = await getExpoPushRegistration();
    usePushDebugStore
      .getState()
      .setNativePushAvailable(registration.nativePushAvailable);
    usePushDebugStore
      .getState()
      .setPermissionStatus(registration.permissionStatus);
    usePushDebugStore
      .getState()
      .setCurrentDeviceId(registration.currentDeviceId);
    usePushDebugStore
      .getState()
      .setCurrentPushToken(registration.currentPushToken);

    if (!registration.currentPushToken) {
      registeredRef.current = false;
      return;
    }

    if (
      registeredRef.current &&
      pushTokenRef.current === registration.currentPushToken
    ) {
      return;
    }

    try {
      const res = await authApi.syncPushToken({
        push_token: registration.currentPushToken,
        device_id: registration.currentDeviceId,
        platform: registration.platform,
      });
      pushTokenRef.current = registration.currentPushToken;
      usePushDebugStore.getState().setBackendHealth(res.data || null);
      registeredRef.current = true;
      console.log("[Push] Token synced with backend");
    } catch (err: any) {
      usePushDebugStore.getState().setBackendHealth(null);
      registeredRef.current = false;
      console.warn("[Push] Failed to sync token:", err.message);
    }
  }, [token]);

  // Unregister token (on logout) — must be called BEFORE auth token is cleared
  const unregisterToken = useCallback(async () => {
    if (!pushTokenRef.current) return;
    try {
      await authApi.removePushToken({ push_token: pushTokenRef.current });
    } catch {}
    pushTokenRef.current = null;
    registeredRef.current = false;
    usePushDebugStore.getState().clear();
  }, []);

  // ── Register on mount / auth change ────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    if (!token) {
      pushTokenRef.current = null;
      registeredRef.current = false;
      usePushDebugStore.getState().clear();
      return;
    }
    registerToken();
  }, [enabled, token, registerToken]);

  // ── Pre-logout: unregister push token BEFORE auth token is cleared ────────
  useEffect(() => {
    if (!enabled) return;
    const unregisterHook = registerPreLogoutHook(async () => {
      if (!pushTokenRef.current) return;
      try {
        await authApi.removePushToken({ push_token: pushTokenRef.current });
        console.log("[Push] Token unregistered on logout");
      } catch {}
      pushTokenRef.current = null;
      registeredRef.current = false;
      usePushDebugStore.getState().clear();
    });
    return () => unregisterHook();
  }, [enabled]);

  // ── Re-register when app comes back to foreground + refresh notifications ──
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && useAuthStore.getState().token) {
        if (!registeredRef.current) registerToken();
        useNotificationStore.getState().fetchNotifications();
      }
    });
    return () => sub.remove();
  }, [enabled, token, registerToken]);

  // ── Foreground push received — refresh notification list from server ───────
  useEffect(() => {
    if (!enabled) return;
    const Notifications = notificationsRef.current || loadNotificationsModule();
    if (!Notifications) return;
    const sub = Notifications.addNotificationReceivedListener(() => {
      if (useAuthStore.getState().token) {
        useNotificationStore.getState().fetchNotifications();
      }
    });
    return () => sub.remove();
  }, [enabled]);

  // ── Notification tap — navigate to notifications screen ───────────────────
  useEffect(() => {
    if (!enabled) return;
    const Notifications = notificationsRef.current || loadNotificationsModule();
    if (!Notifications) return;

    Notifications.getLastNotificationResponseAsync?.()
      .then((response) => {
        const data = response?.notification?.request?.content?.data;
        const responseKey =
          response?.notification?.request?.identifier ||
          String(data?.timestamp || "");
        if (data) {
          navigateFromNotification(data as Record<string, any>, responseKey);
        }
      })
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response?.notification?.request?.content?.data;
        const responseKey =
          response?.notification?.request?.identifier ||
          String(data?.timestamp || "");
        if (data) {
          navigateFromNotification(data as Record<string, any>, responseKey);
          return;
        }
        if (useAuthStore.getState().token) {
          router.push(`/${routeBase}/notifications` as any);
        }
      },
    );
    return () => sub.remove();
  }, [enabled, navigateFromNotification, routeBase, router]);

  return { registerToken, unregisterToken, routeBase };
}
