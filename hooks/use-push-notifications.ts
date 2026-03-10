/**
 * usePushNotifications
 * ─────────────────────
 * Full Expo push notification system
 *
 *  1. Requests permission + gets Expo push token (physical device only)
 *  2. Registers token with backend on auth / app foreground
 *  3. Shows OS notification banners even when app is in foreground
 *  4. Refreshes notification list on incoming push
 *  5. Navigates to notifications screen when user taps a notification
 *  6. Cleans up token on logout
 *
 * Call once in the root layout.
 *
 * NOTE: expo-notifications crashes at import time in Expo Go (SDK 53+).
 *       We use a dynamic require() wrapped in try-catch so the app still
 *       loads — push features simply become no-ops inside Expo Go.
 */
import { useEffect, useRef, useCallback } from "react";
import { Platform, AppState } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/useAuthStore";
import { registerPreLogoutHook } from "@/store/useAuthStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { authApi } from "@/lib/api";

// ─── Safe dynamic import of expo-notifications ──────────────────────────────
// In Expo Go (SDK 53+) the module throws at require-time, so we catch it
// and let the rest of the app continue without push support.
let Notifications: typeof import("expo-notifications") | null = null;
try {
  Notifications = require("expo-notifications");
} catch {
  console.warn(
    "[Push] expo-notifications unavailable (Expo Go?). Push notifications disabled.",
  );
}

// ─── Show OS notification even when app is in foreground ─────────────────────
if (Notifications) {
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
}

// ─── Android notification channel ───────────────────────────────────────────
if (Notifications && Platform.OS === "android") {
  try {
    Notifications.setNotificationChannelAsync("default", {
      name: "UniRide",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#042F40",
      sound: "default",
    }).catch(() => {});
  } catch {
    console.warn("[Push] Failed to create Android notification channel");
  }
}

// ─── Get Expo push token ─────────────────────────────────────────────────────
async function getExpoPushToken(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    if (!Device.isDevice) {
      console.log("[Push] Not a physical device — skipping push token");
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Push] Notification permission not granted");
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn("[Push] No EAS project ID found");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (error: any) {
    console.warn("[Push] Failed to get push token:", error.message);
    return null;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function usePushNotifications() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const pushTokenRef = useRef<string | null>(null);
  const registeredRef = useRef(false);

  const routeBase: "(users)" | "(drivers)" =
    user?.role === "driver" ? "(drivers)" : "(users)";

  // Register push token with backend
  const registerToken = useCallback(async () => {
    if (!Notifications) return; // Push not available
    const currentToken = useAuthStore.getState().token;
    if (!currentToken || registeredRef.current) return;

    const pushToken = await getExpoPushToken();
    if (!pushToken) return;

    pushTokenRef.current = pushToken;

    try {
      await authApi.registerPushToken({
        push_token: pushToken,
        device_id: `${Device.modelName ?? "unknown"}-${Device.osVersion ?? "0"}`,
        platform: Platform.OS,
      });
      registeredRef.current = true;
      console.log("[Push] Token registered with backend");
    } catch (err: any) {
      console.warn("[Push] Failed to register token:", err.message);
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
  }, []);

  // ── Register on mount / auth change ────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      pushTokenRef.current = null;
      registeredRef.current = false;
      return;
    }
    registerToken();
  }, [token, registerToken]);

  // ── Pre-logout: unregister push token BEFORE auth token is cleared ────────
  useEffect(() => {
    const unregisterHook = registerPreLogoutHook(async () => {
      if (!pushTokenRef.current) return;
      try {
        await authApi.removePushToken({ push_token: pushTokenRef.current });
        console.log("[Push] Token unregistered on logout");
      } catch {}
      pushTokenRef.current = null;
      registeredRef.current = false;
    });
    return () => unregisterHook();
  }, []);

  // ── Re-register when app comes back to foreground + refresh notifications ──
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && useAuthStore.getState().token) {
        if (!registeredRef.current) registerToken();
        useNotificationStore.getState().fetchNotifications();
      }
    });
    return () => sub.remove();
  }, [token, registerToken]);

  // ── Foreground push received — refresh notification list from server ───────
  useEffect(() => {
    if (!Notifications) return; // No cleanup needed
    const sub = Notifications.addNotificationReceivedListener(() => {
      if (useAuthStore.getState().token) {
        useNotificationStore.getState().fetchNotifications();
      }
    });
    return () => sub.remove();
  }, []);

  // ── Notification tap — navigate to notifications screen ───────────────────
  useEffect(() => {
    if (!Notifications) return; // No cleanup needed
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      if (useAuthStore.getState().token) {
        router.push(`/${routeBase}/notifications` as any);
      }
    });
    return () => sub.remove();
  }, [routeBase, router]);

  return { registerToken, unregisterToken, routeBase };
}
