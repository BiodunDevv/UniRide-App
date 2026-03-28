import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { T } from "@/hooks/use-translation";
import { eventBus } from "@/lib/eventBus";
import { Ride, useRideStore } from "@/store/useRideStore";

function formatTime(value?: string) {
  if (!value) return "Flexible departure";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Flexible departure";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DriverRideRequestsScreen() {
  const router = useRouter();
  const {
    availableRequests,
    fetchAvailableRequests,
    isLoadingAvailableRequests,
  } = useRideStore();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAvailableRequests();
    setRefreshing(false);
  }, [fetchAvailableRequests]);

  useFocusEffect(
    useCallback(() => {
      fetchAvailableRequests();
    }, [fetchAvailableRequests]),
  );

  useEffect(() => {
    const refresh = () => fetchAvailableRequests();
    const off1 = eventBus.on("ride:new_request", refresh);
    const off2 = eventBus.on("ride:accepted", refresh);
    const off3 = eventBus.on("ride:ended", refresh);
    const off4 = eventBus.on("booking:updated", refresh);
    return () => {
      off1();
      off2();
      off3();
      off4();
    };
  }, [fetchAvailableRequests]);

  const totalSeats = useMemo(
    () =>
      availableRequests.reduce(
        (sum, ride) => sum + (ride.available_seats || 0),
        0,
      ),
    [availableRequests],
  );

  const renderRequest = ({ item, index }: { item: Ride; index: number }) => {
    const pickup =
      typeof item.pickup_location_id === "object" ? item.pickup_location_id : null;
    const destination =
      typeof item.destination_id === "object" ? item.destination_id : null;

    return (
      <Animated.View entering={FadeInDown.delay(index * 40).duration(220)}>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/(drivers)/ride-details" as any,
              params: { rideId: item._id },
            })
          }
          activeOpacity={0.8}
          className="mb-3 rounded-[26px] border border-slate-200 bg-white p-4"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 5,
          }}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-violet-50">
                <Ionicons name="hand-right" size={18} color="#7C3AED" />
              </View>
              <View>
                <Text className="text-sm font-semibold text-slate-900">
                  {pickup?.short_name || pickup?.name || "Pickup"} {"→"}{" "}
                  {destination?.short_name || destination?.name || "Destination"}
                </Text>
                <Text className="mt-1 text-xs text-slate-500">
                  <T>Tap to review and accept this request</T>
                </Text>
              </View>
            </View>
            <View className="rounded-full bg-violet-50 px-3 py-1.5">
              <Text className="text-xs font-semibold text-violet-700">
                <T>Open</T>
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 rounded-2xl bg-slate-50 px-3 py-3">
              <Text className="text-[11px] text-slate-500">
                <T>Fare</T>
              </Text>
              <Text className="mt-1 text-base font-bold text-slate-900">
                ₦{Number(item.fare || 0).toLocaleString()}
              </Text>
            </View>
            <View className="flex-1 rounded-2xl bg-slate-50 px-3 py-3">
              <Text className="text-[11px] text-slate-500">
                <T>Seats</T>
              </Text>
              <Text className="mt-1 text-base font-bold text-slate-900">
                {item.available_seats}
              </Text>
            </View>
            <View className="flex-1 rounded-2xl bg-slate-50 px-3 py-3">
              <Text className="text-[11px] text-slate-500">
                <T>Departure</T>
              </Text>
              <Text className="mt-1 text-base font-bold text-slate-900">
                {formatTime(item.departure_time)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={["top"]} className="flex-1">
        <Animated.View
          entering={FadeInUp.duration(280)}
          className="px-5 pb-3 pt-3"
        >
          <View className="mb-4 flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-white"
            >
              <Ionicons name="arrow-back" size={20} color="#042F40" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Driver Operations
              </Text>
              <Text className="mt-1 text-xl font-bold text-slate-900">
                <T>Ride Requests</T>
              </Text>
            </View>
          </View>

          <View className="rounded-[28px] bg-[#042F40] px-5 py-5">
            <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4A017]">
              Demand Queue
            </Text>
            <Text className="mt-2 text-2xl font-bold text-white">
              {availableRequests.length} <T>Open Requests</T>
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-300">
              <T>
                Review all current passenger ride requests from one place and
                jump straight into the request details screen to accept.
              </T>
            </Text>
            <View className="mt-5 flex-row gap-3">
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] text-slate-300">
                  <T>Requests</T>
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {availableRequests.length}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] text-slate-300">
                  <T>Open seats</T>
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {totalSeats}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {isLoadingAvailableRequests && availableRequests.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#042F40" />
          </View>
        ) : (
          <FlatList
            data={availableRequests}
            keyExtractor={(item) => item._id}
            renderItem={renderRequest}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: 100,
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
              <View className="mt-16 items-center rounded-[28px] border border-slate-200 bg-white p-8">
                <Ionicons name="car-outline" size={48} color="#CBD5E1" />
                <Text className="mt-4 text-base font-semibold text-slate-700">
                  <T>No open requests right now</T>
                </Text>
                <Text className="mt-2 text-center text-sm text-slate-400">
                  <T>
                    New passenger requests will appear here as soon as they are
                    available.
                  </T>
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}
