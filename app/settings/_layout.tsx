import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function SettingsLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      >
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="edit-driver-profile" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="biometric" />
        <Stack.Screen name="security" />
        <Stack.Screen name="devices" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="notification-detail" />
        <Stack.Screen name="bank-picker" />
        <Stack.Screen name="vehicle" />
      </Stack>
    </>
  );
}
