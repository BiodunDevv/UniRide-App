import React, { useEffect, useMemo, useState } from "react";
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
import {
  getNotificationPresentation,
  getNotificationRoute,
} from "@/lib/notificationPresentation";

type Props = {
  routeBase: "(users)" | "(drivers)";
};

export function NotificationDetailScreen({ routeBase }: Props) {
  const router = useRouter();
  const { notificationId } = useLocalSearchParams<{ notificationId: string }>();
  const { fetchDetail } = useNotificationStore();
  const [notif, setNotif] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!notificationId) {
      setLoading(false);
      return;
    }

    (async () => {
      const nextNotification = await fetchDetail(notificationId);
      if (!alive) return;
      setNotif(nextNotification);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [fetchDetail, notificationId]);

  const routeTarget = useMemo(() => {
    if (!notif) return null;
    return getNotificationRoute(notif, routeBase);
  }, [notif, routeBase]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#042F40" />
      </View>
    );
  }

  if (!notif) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Ionicons name="notifications-off-outline" size={48} color="#D1D5DB" />
        <Text className="mt-4 text-base text-gray-400">
          <T>Notification not found</T>
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 rounded-2xl bg-primary px-6 py-3"
        >
          <Text className="font-bold text-white">
            <T>Go Back</T>
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const meta = getNotificationPresentation(notif);
  const d = new Date(notif.createdAt);
  const hasAction = Boolean(notif.metadata?.booking_id || notif.metadata?.ride_id);

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="flex-1">
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="flex-row items-center px-5 pt-3 pb-2"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-gray-100"
          >
            <Ionicons name="arrow-back" size={20} color="#042F40" />
          </TouchableOpacity>
          <Text className="flex-1 text-xl font-bold text-gray-900">
            <T>Notification</T>
          </Text>
        </Animated.View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          <Animated.View
            entering={FadeInUp.delay(100).duration(300)}
            className="mx-5 mt-4 items-center"
          >
            <View
              className={`h-16 w-16 items-center justify-center rounded-full ${meta.bgClassName}`}
            >
              <Ionicons name={meta.icon as any} size={32} color={meta.color} />
            </View>
            <Text className="mt-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {meta.label}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(200).duration(300)}
            className="mx-5 mt-5"
          >
            {notif.title ? (
              <Text className="mb-3 text-center text-lg font-bold text-gray-900">
                {notif.title}
              </Text>
            ) : null}
            <Text className="text-center text-sm leading-5 text-gray-600">
              {notif.message}
            </Text>
          </Animated.View>

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

          {hasAction && routeTarget ? (
            <Animated.View
              entering={FadeInUp.delay(400).duration(300)}
              className="mx-5 mt-8"
            >
              <TouchableOpacity
                onPress={() => router.push(routeTarget as any)}
                className="items-center rounded-2xl bg-primary py-4"
              >
                <Text className="text-sm font-bold text-white">
                  <T>View Ride Details</T>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
