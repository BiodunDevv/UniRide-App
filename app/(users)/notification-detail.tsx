import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";

import {
  useNotificationStore,
  Notification,
} from "@/store/useNotificationStore";
import { T } from "@/hooks/use-translation";

const TYPE_META: Record<
  string,
  { icon: string; bg: string; color: string; label: string }
> = {
  booking_confirmed: {
    icon: "checkmark-circle",
    bg: "bg-green-50",
    color: "#16A34A",
    label: "Booking Confirmed",
  },
  booking_declined: {
    icon: "close-circle",
    bg: "bg-red-50",
    color: "#EF4444",
    label: "Booking Declined",
  },
  booking_cancelled: {
    icon: "close",
    bg: "bg-red-50",
    color: "#EF4444",
    label: "Booking Cancelled",
  },
  ride_started: {
    icon: "navigate",
    bg: "bg-blue-50",
    color: "#2563EB",
    label: "Ride Started",
  },
  ride_completed: {
    icon: "checkmark-done",
    bg: "bg-gray-50",
    color: "#6B7280",
    label: "Ride Completed",
  },
  ride_cancelled: {
    icon: "close-circle",
    bg: "bg-red-50",
    color: "#EF4444",
    label: "Ride Cancelled",
  },
  check_in_success: {
    icon: "key",
    bg: "bg-accent/10",
    color: "#D4A017",
    label: "Checked In",
  },
  payment_received: {
    icon: "cash",
    bg: "bg-green-50",
    color: "#16A34A",
    label: "Payment Received",
  },
  broadcast: {
    icon: "megaphone",
    bg: "bg-purple-50",
    color: "#7C3AED",
    label: "Announcement",
  },
  default: {
    icon: "notifications",
    bg: "bg-gray-50",
    color: "#6B7280",
    label: "Notification",
  },
};

export default function NotificationDetailScreen() {
  const router = useRouter();
  const { notificationId } = useLocalSearchParams<{ notificationId: string }>();
  const { fetchDetail } = useNotificationStore();
  const [notif, setNotif] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!notificationId) {
      setLoading(false);
      return;
    }
    (async () => {
      const n = await fetchDetail(notificationId);
      setNotif(n);
      setLoading(false);
    })();
  }, [notificationId]);

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#042F40" />
      </View>
    );
  if (!notif)
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Ionicons name="notifications-off-outline" size={48} color="#D1D5DB" />
        <Text className="text-base text-gray-400 mt-4">
          <T>Notification not found</T>
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-primary rounded-2xl px-6 py-3"
        >
          <Text className="text-white font-bold">
            <T>Go Back</T>
          </Text>
        </TouchableOpacity>
      </View>
    );

  const meta = TYPE_META[notif.type] || TYPE_META.default;
  const d = new Date(notif.createdAt);

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* Header */}
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="px-5 pt-3 pb-2 flex-row items-center"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
          >
            <Ionicons name="arrow-back" size={20} color="#042F40" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900 flex-1">
            <T>Notification</T>
          </Text>
        </Animated.View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {/* Type Badge */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(300)}
            className="mx-5 mt-4 items-center"
          >
            <View
              className={`w-16 h-16 rounded-full items-center justify-center ${meta.bg}`}
            >
              <Ionicons name={meta.icon as any} size={32} color={meta.color} />
            </View>
            <Text className="text-xs font-semibold text-gray-400 uppercase mt-3 tracking-wider">
              {meta.label}
            </Text>
          </Animated.View>

          {/* Title + Message */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(300)}
            className="mx-5 mt-5"
          >
            {notif.title && (
              <Text className="text-lg font-bold text-gray-900 text-center mb-3">
                {notif.title}
              </Text>
            )}
            <Text className="text-sm text-gray-600 leading-5 text-center">
              {notif.message}
            </Text>
          </Animated.View>

          {/* Timestamp */}
          <Animated.View
            entering={FadeInUp.delay(300).duration(300)}
            className="mx-5 mt-6 items-center"
          >
            <Text className="text-xs text-gray-300">
              {d.toLocaleDateString([], {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}{" "}
              ·{" "}
              {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </Animated.View>

          {/* Metadata Actions */}
          {notif.metadata &&
            (notif.metadata.booking_id || notif.metadata.ride_id) && (
              <Animated.View
                entering={FadeInUp.delay(400).duration(300)}
                className="mx-5 mt-8"
              >
                <TouchableOpacity
                  onPress={() => {
                    if (notif.metadata?.booking_id)
                      router.push({
                        pathname: "/(users)/ride-details" as any,
                        params: { bookingId: notif.metadata.booking_id },
                      });
                    else if (notif.metadata?.ride_id)
                      router.push({
                        pathname: "/(users)/ride-details" as any,
                        params: { rideId: notif.metadata.ride_id },
                      });
                  }}
                  className="bg-primary rounded-2xl py-4 items-center"
                >
                  <Text className="text-white font-bold text-sm">
                    <T>View Ride Details</T>
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
