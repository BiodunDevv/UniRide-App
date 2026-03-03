import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

// Lazy-load expo-notifications to avoid crashing in Expo Go SDK 53+
let Notifications: typeof import("expo-notifications") | null = null;
let Device: typeof import("expo-device") | null = null;

try {
  Notifications = require("expo-notifications");
  Device = require("expo-device");
} catch (e) {
  console.log(
    "expo-notifications not available (Expo Go?). Push notifications disabled.",
  );
}

// Configure how notifications appear when the app is in the foreground
try {
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.log("Failed to set notification handler:", e);
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications || !Device) return null;

  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Ask for permission if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission not granted");
      return null;
    }

    // Android notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#042F40",
      });
    }

    // Get the Expo push token
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.log("No project ID found for push token registration");
      return null;
    }

    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return pushTokenData.data;
  } catch (err) {
    console.log("Failed to register for push notifications:", err);
    return null;
  }
}

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!Notifications || !Device) return;

    const { token } = useAuthStore.getState();
    if (!token) return;

    // Register push token with backend
    if (!registeredRef.current) {
      registerForPushNotificationsAsync().then(async (pushToken) => {
        if (pushToken) {
          setExpoPushToken(pushToken);
          try {
            await authApi.registerPushToken({
              push_token: pushToken,
              device_id: `${Platform.OS}-${Device!.modelName || "unknown"}`,
              platform: Platform.OS,
            });
            registeredRef.current = true;
          } catch (err) {
            console.log("Failed to register push token with backend:", err);
          }
        }
      });
    }

    // Listen for incoming notifications (foreground)
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const { fetchNotifications } =
          require("@/store/useNotificationStore").useNotificationStore.getState();
        fetchNotifications();
      });

    // Listen for notification taps (opens the app)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const { fetchNotifications } =
          require("@/store/useNotificationStore").useNotificationStore.getState();
        fetchNotifications();
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { expoPushToken };
}
