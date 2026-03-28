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

import { useRideStore, Ride } from "@/store/useRideStore";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { eventBus } from "@/lib/eventBus";
import { T } from "@/hooks/use-translation";

const STATUS_INFO: Record<string, { icon: string; bg: string; color: string }> =
  {
    scheduled: { icon: "time", bg: "bg-purple-50", color: "#7C3AED" },
    available: { icon: "radio", bg: "bg-green-50", color: "#16A34A" },
    accepted: { icon: "checkmark-circle", bg: "bg-blue-50", color: "#2563EB" },
    in_progress: { icon: "navigate", bg: "bg-amber-50", color: "#D97706" },
    completed: { icon: "checkmark-done", bg: "bg-gray-50", color: "#6B7280" },
    cancelled: { icon: "close-circle", bg: "bg-red-50", color: "#EF4444" },
  };

type FilterKey = "all" | "active" | "completed" | "cancelled";

export default function DriverRidesScreen() {
  const router = useRouter();
  const { driverRides, fetchDriverRides, isLoadingDriverRides } =
    useRideStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  useFocusEffect(
    useCallback(() => {
      fetchDriverRides();
    }, []),
  );

  // Real-time updates via socket events
  useEffect(() => {
    const u1 = eventBus.on("booking:updated", () => fetchDriverRides());
    const u2 = eventBus.on("booking:cancelled", () => fetchDriverRides());
    const u3 = eventBus.on("ride:ended", () => fetchDriverRides());
    const u4 = eventBus.on("ride:accepted", () => fetchDriverRides());
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDriverRides();
    setRefreshing(false);
  }, []);

  const filtered = driverRides.filter((r) => {
    if (filter === "all") return true;
    if (filter === "active")
      return ["scheduled", "available", "accepted", "in_progress"].includes(
        r.status,
      );
    if (filter === "completed") return r.status === "completed";
    if (filter === "cancelled") return r.status === "cancelled";
    return true;
  });

  const liveCount = driverRides.filter((ride) =>
    ["accepted", "in_progress"].includes(ride.status),
  ).length;
  const scheduledCount = driverRides.filter((ride) =>
    ["scheduled", "available"].includes(ride.status),
  ).length;
  const completedCount = driverRides.filter(
    (ride) => ride.status === "completed",
  ).length;

  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={["top"]} className="flex-1">
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="px-5 pt-3 pb-3"
        >
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-11 h-11 rounded-2xl bg-white items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={20} color="#042F40" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Driver Operations
              </Text>
              <Text className="mt-1 text-xl font-bold text-gray-900">
                <T>My Rides</T>
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(drivers)/create-ride" as any)}
              className="w-11 h-11 rounded-2xl bg-primary items-center justify-center"
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <View className="rounded-[28px] bg-[#042F40] px-5 py-5">
            <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4A017]">
              Ride Portfolio
            </Text>
            <Text className="mt-2 text-2xl font-bold text-white">
              {driverRides.length} <T>Total Rides</T>
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-300">
              <T>Track live trips, upcoming departures, and completed work from one place.</T>
            </Text>
            <View className="mt-5 flex-row gap-3">
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] text-slate-300">
                  <T>Live</T>
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {liveCount}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] text-slate-300">
                  <T>Scheduled</T>
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {scheduledCount}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] text-slate-300">
                  <T>Completed</T>
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {completedCount}
                </Text>
              </View>
            </View>
          </View>
          <View className="flex-row gap-2 mt-4">
            {(["all", "active", "completed", "cancelled"] as FilterKey[]).map(
              (f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
                  className={`px-3.5 py-2 rounded-full ${filter === f ? "bg-primary" : "bg-white border border-slate-200"}`}
                >
                  <Text
                    className={`text-xs font-semibold capitalize ${filter === f ? "text-white" : "text-slate-600"}`}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        </Animated.View>

        {isLoadingDriverRides && driverRides.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#042F40" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 100,
              paddingTop: 10,
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
              <View className="items-center mt-16 rounded-[28px] bg-white p-8 border border-slate-200">
                <Ionicons name="car-outline" size={48} color="#D1D5DB" />
                <Text className="text-base font-semibold text-slate-700 mt-4">
                  <T>No rides yet</T>
                </Text>
                <Text className="text-sm text-slate-400 mt-2 text-center">
                  <T>Create your first ride or go online to start receiving requests.</T>
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const pickup =
                typeof item.pickup_location_id === "object"
                  ? item.pickup_location_id
                  : null;
              const dest =
                typeof item.destination_id === "object"
                  ? item.destination_id
                  : null;
              const info = STATUS_INFO[item.status] || STATUS_INFO.scheduled;
              const dep = item.departure_time
                ? new Date(item.departure_time)
                : null;
              const isLive = item.status === "in_progress";
              return (
                <Animated.View
                  entering={FadeInDown.delay(index * 50).duration(250)}
                >
                  <TouchableOpacity
                    onPress={() =>
                      isLive
                        ? router.push({
                            pathname: "/(drivers)/active-ride" as any,
                            params: { rideId: item._id },
                          })
                        : router.push({
                            pathname: "/(drivers)/ride-details" as any,
                            params: { rideId: item._id },
                          })
                    }
                    className="bg-white rounded-[26px] p-4 mb-3 border border-slate-200"
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
                          <Ionicons
                            name={info.icon as any}
                            size={14}
                            color={info.color}
                          />
                        </View>
                        <Text
                          className="text-xs font-semibold capitalize"
                          style={{ color: info.color }}
                        >
                          {item.status.replace("_", " ")}
                        </Text>
                      </View>
                      {dep && (
                        <Text className="text-xs text-gray-400">
                          {dep.toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          ·{" "}
                          {dep.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center">
                      <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                      <Text
                        className="text-xs text-gray-600 flex-1"
                        numberOfLines={1}
                      >
                        {pickup?.short_name || pickup?.name || "—"}
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={10}
                        color="#D1D5DB"
                      />
                      <View className="w-2 h-2 rounded-full bg-red-500 mx-2" />
                      <Text
                        className="text-xs text-gray-600 flex-1 text-right"
                        numberOfLines={1}
                      >
                        {dest?.short_name || dest?.name || "—"}
                      </Text>
                    </View>
                    <View className="mt-3 flex-row items-center gap-2">
                      <View className="rounded-full bg-slate-100 px-2.5 py-1">
                        <Text className="text-[10px] font-semibold text-slate-500">
                          {item.booked_seats}/{item.available_seats} seats
                        </Text>
                      </View>
                      <View className="rounded-full bg-primary/5 px-2.5 py-1">
                        <Text className="text-[10px] font-semibold text-primary">
                          {isLive ? "Live trip" : "Trip details"}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-50">
                      <Text className="text-xs text-gray-400">
                        {item.booked_seats}/{item.available_seats} seats
                      </Text>
                      <FareLabel fare={item.fare} />
                    </View>
                    {/* View details */}
                    <View className="mt-3 bg-primary/5 rounded-2xl py-3 items-center flex-row justify-center">
                      <Ionicons name="eye-outline" size={14} color="#042F40" />
                      <Text className="text-xs font-semibold text-primary ml-1.5">
                        <T>View Details</T>
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color="#042F40"
                        className="ml-1"
                      />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function FareLabel({ fare }: { fare: number }) {
  const { settings } = usePlatformSettingsStore();
  return (
    <View className="flex-row items-center">
      <Text className="text-sm font-bold text-primary">₦{fare}</Text>
      {settings.fare_per_seat && (
        <Text className="text-[10px] text-gray-400 ml-1">/seat</Text>
      )}
    </View>
  );
}
