import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";

export type PushPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "simulator"
  | "unavailable";

export type ExpoPushRegistration = {
  nativePushAvailable: boolean;
  permissionStatus: PushPermissionStatus;
  currentPushToken: string | null;
  currentDeviceId: string;
  platform: "android" | "ios";
  reason?: string;
};

let notificationsModule: typeof import("expo-notifications") | null = null;

function resolveExpoProjectId(): string | null {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  return projectId ? String(projectId).trim() : null;
}

export function getPushDeviceId(): string {
  return `${Device.modelName ?? "unknown"}-${Device.osVersion ?? "0"}`;
}

export function getPushPlatform(): "android" | "ios" {
  return Platform.OS === "ios" ? "ios" : "android";
}

export function canUseNativePush() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export function loadNotificationsModule() {
  if (notificationsModule) return notificationsModule;

  try {
    notificationsModule = require("expo-notifications");
    return notificationsModule;
  } catch (error) {
    console.warn(
      "[Push] expo-notifications unavailable in this runtime. Push disabled.",
      error,
    );
    return null;
  }
}

export async function getExpoPushToken(): Promise<string | null> {
  const Notifications = loadNotificationsModule();
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

    const projectId = resolveExpoProjectId();

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

export async function getExpoPushRegistration(): Promise<ExpoPushRegistration> {
  const currentDeviceId = getPushDeviceId();
  const platform = getPushPlatform();

  if (!Device.isDevice) {
    return {
      nativePushAvailable: false,
      permissionStatus: "simulator",
      currentPushToken: null,
      currentDeviceId,
      platform,
      reason: "Push notifications require a physical device.",
    };
  }

  const Notifications = loadNotificationsModule();
  if (!Notifications) {
    return {
      nativePushAvailable: false,
      permissionStatus: "unavailable",
      currentPushToken: null,
      currentDeviceId,
      platform,
      reason: "expo-notifications could not be loaded in this runtime.",
    };
  }

  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return {
        nativePushAvailable: true,
        permissionStatus: finalStatus as PushPermissionStatus,
        currentPushToken: null,
        currentDeviceId,
        platform,
        reason: "Notification permission was not granted.",
      };
    }

    const projectId = resolveExpoProjectId();

    if (!projectId) {
      return {
        nativePushAvailable: false,
        permissionStatus: "unavailable",
        currentPushToken: null,
        currentDeviceId,
        platform,
        reason: "Expo projectId is missing from app config.",
      };
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

    return {
      nativePushAvailable: true,
      permissionStatus: "granted",
      currentPushToken: tokenData.data,
      currentDeviceId,
      platform,
    };
  } catch (error: any) {
    const message =
      error?.message || "Failed to initialize Expo push notifications.";
    const normalizedMessage = String(message).toLowerCase();
    const unsupportedInExpoGo =
      message.includes("removed from Expo Go") ||
      message.includes("development build");
    const missingAndroidPushCredentials =
      platform === "android" &&
      (normalizedMessage.includes("default firebaseapp") ||
        normalizedMessage.includes("firebase") ||
        normalizedMessage.includes("fcm") ||
        normalizedMessage.includes("messaging"));
    const missingProjectId = normalizedMessage.includes("projectid");

    return {
      nativePushAvailable: false,
      permissionStatus: "unavailable",
      currentPushToken: null,
      currentDeviceId,
      platform,
      reason: unsupportedInExpoGo
        ? "Expo Go cannot provide remote Android push for this SDK/runtime. Use a development build or standalone app."
        : missingAndroidPushCredentials
          ? "Android push is not fully configured for this build. Add google-services.json, upload FCM credentials to EAS, and rebuild the Play Store binary."
          : missingProjectId
            ? "Expo EAS projectId is missing in app config for push registration."
            : message,
    };
  }
}
