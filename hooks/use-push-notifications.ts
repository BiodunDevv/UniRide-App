import { useEffect, useRef, useCallback } from "react";
import { Platform, AppState } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { registerPreLogoutHook, useAuthStore } from "@/store/useAuthStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { authApi } from "@/lib/api";
import { usePushDebugStore } from "@/store/usePushDebugStore";
import {
  canUseNativePush,
  getExpoPushRegistration,
  loadNotificationsModule,
} from "@/lib/pushNotifications";
import { getNotificationRoute } from "@/lib/notificationPresentation";
import { useNotificationIntentStore } from "@/store/useNotificationIntentStore";

const MIN_PUSH_SYNC_INTERVAL_MS = 60 * 1000;

// ─── Hook ────────────────────────────────────────────────────────────────────
export function usePushNotifications(enabled = true) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const segments = useSegments();
  const pushTokenRef = useRef<string | null>(null);
  const lastSyncAtRef = useRef(0);
  const registeredRef = useRef(false);
  const handledResponseRef = useRef<string | null>(null);
  const notificationsRef = useRef<typeof import("expo-notifications") | null>(
    null,
  );

  const routeBase: "(users)" | "(drivers)" =
    user?.role === "driver" ? "(drivers)" : "(users)";
  const rootSegment = segments[0] || null;

  const commitNotificationIntent = useCallback(
    (payload?: Record<string, any> | null, responseKey?: string | null) => {
      if (!payload || typeof payload !== "object") return;
      useNotificationIntentStore
        .getState()
        .setPendingIntent(payload as Record<string, any>, responseKey || null);
    },
    [],
  );

  const navigateFromNotification = useCallback(
    (payload?: Record<string, any> | null, responseKey?: string | null) => {
      if (!payload || typeof payload !== "object") return;

      const authState = useAuthStore.getState();
      const hasSession = Boolean(authState.token && authState.user);
      const shouldDeferUntilUnlocked =
        !hasSession ||
        !rootSegment ||
        rootSegment === "index" ||
        rootSegment === "lock" ||
        rootSegment === "bootstrap" ||
        rootSegment === "auth" ||
        rootSegment === "welcome" ||
        rootSegment === "maintenance";

      if (!hasSession) {
        commitNotificationIntent(payload, responseKey || null);
        return;
      }

      if (responseKey && handledResponseRef.current === responseKey) return;
      if (responseKey) {
        handledResponseRef.current = responseKey;
      }

      commitNotificationIntent(payload, responseKey || null);

      if (shouldDeferUntilUnlocked) {
        return;
      }

      const target = getNotificationRoute(
        {
          type: String(payload?.category || payload?.type || "system") as any,
          metadata: payload || {},
        },
        routeBase,
      );

      if (responseKey) {
        useNotificationIntentStore.getState().markResponseHandled(responseKey);
      }

      router.push(target as any);
    },
    [commitNotificationIntent, rootSegment, routeBase, router],
  );

  useEffect(() => {
    usePushDebugStore.getState().setNativePushAvailable(canUseNativePush());
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

    const now = Date.now();
    const hasSameToken = pushTokenRef.current === registration.currentPushToken;
    const syncedRecently =
      now - lastSyncAtRef.current < MIN_PUSH_SYNC_INTERVAL_MS;

    if (registeredRef.current && hasSameToken && syncedRecently) {
      return;
    }

    try {
      const res = await authApi.syncPushToken({
        push_token: registration.currentPushToken,
        device_id: registration.currentDeviceId,
        platform: registration.platform,
      });
      pushTokenRef.current = registration.currentPushToken;
      lastSyncAtRef.current = now;
      usePushDebugStore.getState().setBackendHealth(res.data || null);
      registeredRef.current = true;
      console.log("[Push] Token synced with backend");
    } catch (err: any) {
      usePushDebugStore.getState().setBackendHealth(null);
      registeredRef.current = false;
      console.warn("[Push] Failed to sync token:", err.message);
    }
  }, []);

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
      lastSyncAtRef.current = 0;
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
      lastSyncAtRef.current = 0;
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
        registerToken();
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

  // ── Notification tap — capture intent and navigate only after lock/auth ───
  useEffect(() => {
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
        const authState = useAuthStore.getState();
        const hasSession = Boolean(authState.token && authState.user);
        const shouldDeferUntilUnlocked =
          !hasSession ||
          !rootSegment ||
          rootSegment === "index" ||
          rootSegment === "lock" ||
          rootSegment === "bootstrap" ||
          rootSegment === "auth" ||
          rootSegment === "welcome" ||
          rootSegment === "maintenance";

        if (hasSession && !shouldDeferUntilUnlocked) {
          router.push(`/${routeBase}/notifications` as any);
        } else {
          useNotificationIntentStore
            .getState()
            .setPendingIntent({ route: "notifications" }, responseKey || null);
        }
      },
    );
    return () => sub.remove();
  }, [navigateFromNotification, rootSegment, routeBase, router]);

  return { registerToken, unregisterToken, routeBase };
}
