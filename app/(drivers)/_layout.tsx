import { Stack } from "expo-router";
import React from "react";

export default function DriverLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FFFFFF" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="rides" options={{ animation: "slide_from_right" }} />
      <Stack.Screen
        name="notifications"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="profile"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="create-ride"
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="ride-details"
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="active-ride"
        options={{ presentation: "modal", animation: "fade" }}
      />
      <Stack.Screen
        name="notification-detail"
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
