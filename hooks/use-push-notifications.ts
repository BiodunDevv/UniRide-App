import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
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
  try {
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
    console.log("Failed to get push token:", err);
    return null;
  }
}

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null,
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const registeredRef = useRef(false);

  useEffect(() => {
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
              device_id: `${Platform.OS}-${Device.modelName || "unknown"}`,
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
        // Refresh notification store when a push comes in
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
