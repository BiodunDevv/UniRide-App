import { Stack } from "expo-router";
import { Platform } from "react-native";
import React from "react";

const pushAnimation =
  Platform.OS === "ios" ? "slide_from_right" : "simple_push";
const modalAnimation =
  Platform.OS === "ios" ? "slide_from_bottom" : "fade_from_bottom";
const revealAnimation = Platform.OS === "ios" ? "fade" : "fade_from_bottom";

export default function UserLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FFFFFF" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="activity" options={{ animation: pushAnimation }} />
      <Stack.Screen
        name="notifications"
        options={{ presentation: "modal", animation: modalAnimation }}
      />
      <Stack.Screen name="profile" options={{ animation: pushAnimation }} />
      <Stack.Screen
        name="search-ride"
        options={{
          presentation: "modal",
          animation: modalAnimation,
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="available-rides"
        options={{
          presentation: "modal",
          animation: modalAnimation,
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="ride-details"
        options={{
          presentation: "modal",
          animation: modalAnimation,
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="check-in"
        options={{
          presentation: "modal",
          animation: modalAnimation,
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="driver-profile"
        options={{
          presentation: "modal",
          animation: modalAnimation,
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="request-ride"
        options={{
          presentation: "modal",
          animation: modalAnimation,
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="active-ride"
        options={{ presentation: "modal", animation: revealAnimation }}
      />
      <Stack.Screen
        name="notification-detail"
        options={{
          presentation: "modal",
          animation: modalAnimation,
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
