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

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="flex-1">
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
              <T>My Rides</T>
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(drivers)/create-ride" as any)}
              className="w-10 h-10 rounded-full bg-primary items-center justify-center"
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
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
                <Ionicons name="car-outline" size={48} color="#D1D5DB" />
                <Text className="text-base text-gray-400 mt-4">
                  <T>No rides yet</T>
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
                    className="bg-white rounded-2xl p-4 mb-3 border border-gray-100"
                    style={{
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.04,
                      shadowRadius: 3,
                    }}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center">
                        <View
                          className={`w-7 h-7 rounded-full items-center justify-center mr-2 ${info.bg}`}
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
                    <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-gray-50">
                      <Text className="text-xs text-gray-400">
                        {item.booked_seats}/{item.available_seats} seats
                      </Text>
                      <FareLabel fare={item.fare} />
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
