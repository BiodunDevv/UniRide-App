import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";

import { useRideStore, Booking } from "@/store/useRideStore";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { T } from "@/hooks/use-translation";

const STATUS_INFO: Record<
  string,
  { icon: string; bg: string; color: string; label: string }
> = {
  pending: {
    icon: "time",
    bg: "bg-yellow-50",
    color: "#CA8A04",
    label: "Pending",
  },
  accepted: {
    icon: "checkmark-circle",
    bg: "bg-green-50",
    color: "#16A34A",
    label: "Accepted",
  },
  in_progress: {
    icon: "navigate",
    bg: "bg-blue-50",
    color: "#2563EB",
    label: "In Progress",
  },
  completed: {
    icon: "checkmark-done",
    bg: "bg-gray-50",
    color: "#6B7280",
    label: "Completed",
  },
  cancelled: {
    icon: "close-circle",
    bg: "bg-red-50",
    color: "#EF4444",
    label: "Cancelled",
  },
  declined: {
    icon: "close",
    bg: "bg-red-50",
    color: "#EF4444",
    label: "Declined",
  },
  timed_out: {
    icon: "alarm-outline",
    bg: "bg-orange-50",
    color: "#EA580C",
    label: "Timed Out",
  },
};

type FilterKey = "all" | "active" | "completed" | "cancelled";

export default function ActivityScreen() {
  const router = useRouter();
  const { myBookings, fetchMyBookings, isLoadingBookings } = useRideStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  useFocusEffect(
    useCallback(() => {
      fetchMyBookings();
    }, []),
  );

  // Auto-refresh bookings every 8s for real-time status updates
  useEffect(() => {
    const iv = setInterval(() => fetchMyBookings(), 8000);
    return () => clearInterval(iv);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMyBookings();
    setRefreshing(false);
  }, []);

  const filtered = myBookings.filter((b) => {
    if (filter === "all") return true;
    if (filter === "active")
      return ["pending", "accepted", "in_progress"].includes(b.status);
    if (filter === "completed") return b.status === "completed";
    if (filter === "cancelled")
      return b.status === "cancelled" || b.status === "declined";
    return true;
  });

  // ═════════════════════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* Header */}
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="px-5 pt-3 pb-2"
        >
          <View className="flex-row items-center mb-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={20} color="#042F40" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-gray-900 flex-1">
              <T>My Activity</T>
            </Text>
            <Text className="text-sm text-gray-400">{filtered.length}</Text>
          </View>

          {/* Filters */}
          <View className="flex-row gap-2 mb-1">
            {(["all", "active", "completed", "cancelled"] as FilterKey[]).map(
              (f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full ${filter === f ? "bg-primary" : "bg-gray-100"}`}
                >
                  <Text
                    className={`text-xs font-semibold capitalize ${filter === f ? "text-white" : "text-gray-600"}`}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        </Animated.View>

        {/* List */}
        {isLoadingBookings && myBookings.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#042F40" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 40,
              paddingTop: 8,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#042F40"
              />
            }
            ListEmptyComponent={
              <View className="items-center mt-16">
                <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
                <Text className="text-base text-gray-400 mt-4">
                  <T>No bookings yet</T>
                </Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <BookingCard
                booking={item}
                index={index}
                onPress={() =>
                  router.push({
                    pathname: "/(users)/ride-details" as any,
                    params: { bookingId: item._id },
                  })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function FareLabel({ fare, seats }: { fare: number; seats: number }) {
  const { settings } = usePlatformSettingsStore();
  const total = settings.fare_per_seat ? fare * seats : fare;
  return (
    <View className="flex-row items-center">
      <Text className="text-sm font-bold text-primary">₦{total}</Text>
      {settings.fare_per_seat && seats > 1 && (
        <Text className="text-[10px] text-gray-400 ml-1">
          ({seats}×₦{fare})
        </Text>
      )}
    </View>
  );
}

function BookingCard({
  booking,
  index,
  onPress,
}: {
  booking: Booking;
  index: number;
  onPress: () => void;
}) {
  const ride = typeof booking.ride_id === "object" ? booking.ride_id : null;
  const pickup =
    ride && typeof ride.pickup_location_id === "object"
      ? ride.pickup_location_id
      : null;
  const dest =
    ride && typeof ride.destination_id === "object"
      ? ride.destination_id
      : null;

  // Detect timed out bookings (cancelled + admin_note contains "timed out" or ride has no driver)
  const isTimedOut =
    booking.status === "cancelled" &&
    (booking.admin_note?.toLowerCase().includes("timed out") ||
      (ride && ride.status === "cancelled" && !ride.driver_id));

  const displayStatus = isTimedOut ? "timed_out" : booking.status;
  const info = STATUS_INFO[displayStatus] || STATUS_INFO.pending;
  const d = new Date(booking.booking_time || booking.createdAt);

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(250)}>
      <TouchableOpacity
        onPress={onPress}
        className="bg-white rounded-2xl p-4 mb-3 border border-gray-100"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
        }}
        activeOpacity={0.7}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <View
              className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${info.bg}`}
            >
              <Ionicons name={info.icon as any} size={16} color={info.color} />
            </View>
            <Text
              className="text-sm font-semibold"
              style={{ color: info.color }}
            >
              <T>{info.label}</T>
            </Text>
          </View>
          <Text className="text-xs text-gray-400">
            {d.toLocaleDateString([], { month: "short", day: "numeric" })} ·{" "}
            {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
          <Text className="text-xs text-gray-600 flex-1" numberOfLines={1}>
            {pickup?.short_name || pickup?.name || "—"}
          </Text>
          <Ionicons name="arrow-forward" size={10} color="#D1D5DB" />
          <View className="w-2 h-2 rounded-full bg-red-500 mx-2" />
          <Text
            className="text-xs text-gray-600 flex-1 text-right"
            numberOfLines={1}
          >
            {dest?.short_name || dest?.name || "—"}
          </Text>
        </View>
        <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-gray-50">
          <Text className="text-xs text-gray-400">
            {booking.seats_requested} seat
            {booking.seats_requested > 1 ? "s" : ""} · {booking.payment_method}
          </Text>
          {ride?.fare !== undefined && (
            <FareLabel fare={ride.fare} seats={booking.seats_requested} />
          )}
        </View>
        {isTimedOut && (
          <View className="mt-2 bg-orange-50 rounded-xl px-3 py-2 flex-row items-center">
            <Ionicons name="alarm-outline" size={14} color="#EA580C" />
            <Text className="text-[11px] text-orange-600 ml-2 flex-1">
              <T>No driver accepted before departure time</T>
            </Text>
          </View>
        )}
        {booking.admin_note &&
          !isTimedOut &&
          booking.status === "cancelled" && (
            <View className="mt-2 bg-red-50 rounded-xl px-3 py-2">
              <Text className="text-[11px] text-red-500">
                {booking.admin_note}
              </Text>
            </View>
          )}
      </TouchableOpacity>
    </Animated.View>
  );
}
