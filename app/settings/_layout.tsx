import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function SettingsLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#F8FAFC" },
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      >
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="edit-driver-profile" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="security" />
        <Stack.Screen name="devices" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="bank-picker" />
        <Stack.Screen name="vehicle" />
      </Stack>
    </>
  );
}
