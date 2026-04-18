import { Stack, usePathname, useRouter } from "expo-router";
import { Platform } from "react-native";
import React, { useEffect, useRef } from "react";
import { eventBus } from "@/lib/eventBus";

const pushAnimation =
  Platform.OS === "ios" ? "slide_from_right" : "simple_push";
const modalAnimation =
  Platform.OS === "ios" ? "slide_from_bottom" : "fade_from_bottom";
const revealAnimation = Platform.OS === "ios" ? "fade" : "fade_from_bottom";

export default function UserLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const lastAutoRideIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = eventBus.on("ride:started", (payload: any) => {
      const rawRideId = payload?.ride_id ?? payload?.rideId ?? payload?.id;
      const rideId = rawRideId == null ? "" : String(rawRideId).trim();
      if (!rideId) return;

      const alreadyOnActiveRide = pathname.includes("active-ride");
      if (alreadyOnActiveRide && lastAutoRideIdRef.current === rideId) {
        return;
      }

      lastAutoRideIdRef.current = rideId;
      const target = {
        pathname: "/(users)/active-ride" as any,
        params: { rideId },
      };

      if (alreadyOnActiveRide) {
        router.replace(target);
      } else {
        router.push(target);
      }
    });

    return unsubscribe;
  }, [pathname, router]);

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
