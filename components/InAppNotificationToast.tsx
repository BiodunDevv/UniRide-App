/**
 * InAppNotificationToast
 * ──────────────────────
 * Mirrors the notification list‑item design exactly:
 *  • white rounded-xl card, light shadow
 *  • w-10 h-10 rounded-full tinted icon circle (left)
 *  • title (semibold) + message (gray-400) + timestamp (gray-300)
 *  • tiny accent dot for unread (right)
 *  • FadeInDown.duration(250) entry — same as notification list items
 *  • Simple fade-up exit on swipe / auto-dismiss
 */
import React, { useEffect, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  useNotificationStore,
  Notification,
} from "@/store/useNotificationStore";

// ─── Brand ────────────────────────────────────────────────────────────────────
const PRIMARY = "#042F40";
const ACCENT = "#D4A017";
const AUTO_DISMISS_MS = 4500;
const SWIPE_THRESHOLD = -40;

// ─── Type icons — same map used in the notification list screens ──────────────
const TYPE_ICONS: Record<string, { icon: string; bg: string; color: string }> =
  {
    new_booking: { icon: "person-add", bg: "#FDF8EC", color: ACCENT },
    booking_confirmed: {
      icon: "checkmark-circle",
      bg: "#F0FDF4",
      color: "#16A34A",
    },
    booking_declined: { icon: "close-circle", bg: "#FEF2F2", color: "#EF4444" },
    booking_cancelled: {
      icon: "close-circle",
      bg: "#FEF2F2",
      color: "#EF4444",
    },
    ride: { icon: "navigate", bg: "#EFF6FF", color: "#2563EB" },
    ride_started: { icon: "navigate", bg: "#EFF6FF", color: "#2563EB" },
    ride_completed: { icon: "checkmark-done", bg: "#F9FAFB", color: "#6B7280" },
    ride_cancelled: { icon: "close-circle", bg: "#FEF2F2", color: "#EF4444" },
    ride_request: { icon: "hand-right", bg: "#F5F3FF", color: "#7C3AED" },
    check_in_success: { icon: "key", bg: "#F0FDF4", color: "#16A34A" },
    payment_received: { icon: "cash", bg: "#F0FDF4", color: "#16A34A" },
    broadcast: { icon: "megaphone", bg: "#F5F3FF", color: "#7C3AED" },
    system: { icon: "settings", bg: "#F9FAFB", color: "#6B7280" },
    promotion: { icon: "gift", bg: "#FDF8EC", color: ACCENT },
    security: { icon: "shield-checkmark", bg: "#FEF2F2", color: "#E11D48" },
    account: { icon: "person-circle", bg: "#F9FAFB", color: PRIMARY },
  };

const DEFAULT_ICON = { icon: "notifications", bg: "#F9FAFB", color: "#6B7280" };

function getIcon(type: string) {
  return TYPE_ICONS[type] ?? DEFAULT_ICON;
}

// ─── Toast Card ───────────────────────────────────────────────────────────────
function ToastCard({
  notification,
  onDismiss,
  routeBase,
}: {
  notification: Notification;
  onDismiss: () => void;
  routeBase: "(users)" | "(drivers)";
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const info = getIcon(notification.type);

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const isDismissing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    if (timer.current) clearTimeout(timer.current);
    translateY.value = withTiming(-100, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onDismiss)();
    });
  }, [onDismiss]);

  useEffect(() => {
    timer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dismiss]);

  const swipe = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY < 0) {
        translateY.value = e.translationY;
        opacity.value = 1 + e.translationY / 80;
      }
    })
    .onEnd((e) => {
      if (e.translationY < SWIPE_THRESHOLD) {
        runOnJS(dismiss)();
      } else {
        translateY.value = withTiming(0, { duration: 150 });
        opacity.value = withTiming(1, { duration: 150 });
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handleTap = () => {
    dismiss();
    setTimeout(() => router.push(`/${routeBase}/notifications` as any), 220);
  };

  const d = new Date(notification.createdAt);
  const top = Platform.OS === "ios" ? insets.top + 6 : 12;

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View
        entering={FadeInDown.duration(250)}
        style={[
          animStyle,
          {
            position: "absolute",
            top,
            left: 20,
            right: 20,
            zIndex: 9999,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleTap}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            padding: 14,
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            shadowColor: PRIMARY,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          {/* Icon circle — w-10 h-10 rounded-full, same as list */}
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: info.bg,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name={info.icon as any} size={18} color={info.color} />
          </View>

          {/* Text — same hierarchy as notification list */}
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#111827",
              }}
            >
              {notification.title}
            </Text>
            {notification.message ? (
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 12,
                  color: "#9CA3AF",
                  marginTop: 2,
                }}
              >
                {notification.message}
              </Text>
            ) : null}
            <Text
              style={{
                fontSize: 10,
                color: "#D1D5DB",
                marginTop: 4,
              }}
            >
              {d.toLocaleDateString([], { month: "short", day: "numeric" })} ·{" "}
              {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>

          {/* Unread accent dot — same as list */}
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: ACCENT,
              marginTop: 6,
              marginLeft: 8,
            }}
          />
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Public wrapper ───────────────────────────────────────────────────────────
export default function InAppNotificationToast({
  routeBase = "(users)",
}: {
  routeBase?: "(users)" | "(drivers)";
}) {
  const toastQueue = useNotificationStore((s) => s.toastQueue);
  const dismissToast = useNotificationStore((s) => s.dismissToast);
  const current = toastQueue[0];
  if (!current) return null;

  return (
    <ToastCard
      key={current._id}
      notification={current}
      onDismiss={() => dismissToast(current._id)}
      routeBase={routeBase}
    />
  );
}
