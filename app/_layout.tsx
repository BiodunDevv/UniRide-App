import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import "react-native-reanimated";
import "../global.css";
import { usePushNotifications } from "@/hooks/use-push-notifications";

// Prevent the native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const screenTransition = Platform.select({
  ios: {
    animation: "ios_from_right" as const,
    animationDuration: 350,
  },
  android: {
    animation: "fade_from_bottom" as const,
    animationDuration: 300,
  },
});

export default function RootLayout() {
  // Register for Expo push notifications
  usePushNotifications();

  useEffect(() => {
    // Hide native splash once our custom one renders
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          ...screenTransition,
          gestureEnabled: true,
          gestureDirection: "horizontal",
        }}
      >
        <Stack.Screen name="index" options={{ animation: "none" }} />
        <Stack.Screen name="welcome" options={{ animation: "fade" }} />
        <Stack.Screen name="auth" />
        <Stack.Screen name="lock" options={{ animation: "fade" }} />
        <Stack.Screen name="(users)" options={{ animation: "fade" }} />
        <Stack.Screen name="(drivers)" options={{ animation: "fade" }} />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
    </View>
  );
}
