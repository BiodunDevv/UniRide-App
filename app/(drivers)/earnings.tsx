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
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { bookingApi } from "@/lib/rideApi";
import { eventBus } from "@/lib/eventBus";
import { T } from "@/hooks/use-translation";

interface RideEarning {
  ride_id: string;
  pickup: string;
  destination: string;
  fare: number;
  passengers: number;
  total_earned: number;
  ended_at: string;
  departure_time: string;
}

interface EarningsData {
  total_earnings: number;
  today_earnings: number;
  week_earnings: number;
  month_earnings: number;
  total_rides: number;
  total_passengers: number;
  rides: RideEarning[];
}

export default function EarningsScreen() {
  const router = useRouter();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = useCallback(async () => {
    try {
      const res = await bookingApi.getDriverEarnings();
      setData(res.data);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchEarnings();
      setLoading(false);
    })();
  }, []);

  // Real-time: refresh when rides complete
  useEffect(() => {
    const u1 = eventBus.on("ride:ended", () => fetchEarnings());
    const u2 = eventBus.on("booking:updated", () => fetchEarnings());
    return () => {
      u1();
      u2();
    };
  }, [fetchEarnings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEarnings();
    setRefreshing(false);
  }, [fetchEarnings]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#042F40" />
      </View>
    );
  }

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
              <T>Earnings</T>
            </Text>
          </View>
        </Animated.View>

        <FlatList
          data={data?.rides || []}
          keyExtractor={(item) => item.ride_id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 100,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#042F40"
            />
          }
          ListHeaderComponent={
            <>
              {/* Total Earnings Hero */}
              <Animated.View
                entering={FadeInUp.delay(100).duration(300)}
                className="bg-primary rounded-2xl p-6 items-center mb-4"
              >
                <Text className="text-white/60 text-xs font-medium uppercase tracking-wider">
                  <T>Total Earnings</T>
                </Text>
                <Text className="text-white text-4xl font-bold mt-1">
                  ₦{(data?.total_earnings || 0).toLocaleString()}
                </Text>
                <View className="flex-row items-center mt-2 gap-4">
                  <View className="items-center">
                    <Text className="text-white/50 text-[10px]">
                      <T>Rides</T>
                    </Text>
                    <Text className="text-white text-sm font-bold">
                      {data?.total_rides || 0}
                    </Text>
                  </View>
                  <View className="w-px h-6 bg-white/20" />
                  <View className="items-center">
                    <Text className="text-white/50 text-[10px]">
                      <T>Passengers</T>
                    </Text>
                    <Text className="text-white text-sm font-bold">
                      {data?.total_passengers || 0}
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* Period Breakdown */}
              <Animated.View
                entering={FadeInUp.delay(200).duration(300)}
                className="flex-row gap-3 mb-5"
              >
                <View className="flex-1 bg-green-50 rounded-2xl p-3 items-center border border-green-100">
                  <Text className="text-[10px] text-gray-400 uppercase">
                    <T>Today</T>
                  </Text>
                  <Text className="text-lg font-bold text-green-700 mt-0.5">
                    ₦{(data?.today_earnings || 0).toLocaleString()}
                  </Text>
                </View>
                <View className="flex-1 bg-blue-50 rounded-2xl p-3 items-center border border-blue-100">
                  <Text className="text-[10px] text-gray-400 uppercase">
                    <T>This Week</T>
                  </Text>
                  <Text className="text-lg font-bold text-blue-700 mt-0.5">
                    ₦{(data?.week_earnings || 0).toLocaleString()}
                  </Text>
                </View>
                <View className="flex-1 bg-purple-50 rounded-2xl p-3 items-center border border-purple-100">
                  <Text className="text-[10px] text-gray-400 uppercase">
                    <T>This Month</T>
                  </Text>
                  <Text className="text-lg font-bold text-purple-700 mt-0.5">
                    ₦{(data?.month_earnings || 0).toLocaleString()}
                  </Text>
                </View>
              </Animated.View>

              {/* Section Header */}
              <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">
                <T>Ride History</T>
              </Text>
            </>
          }
          ListEmptyComponent={
            <View className="items-center mt-12">
              <Ionicons name="wallet-outline" size={48} color="#D1D5DB" />
              <Text className="text-base text-gray-400 mt-4">
                <T>No completed rides yet</T>
              </Text>
              <Text className="text-xs text-gray-300 mt-1">
                <T>Complete rides to start earning</T>
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const d = item.ended_at
              ? new Date(item.ended_at)
              : new Date(item.departure_time);
            return (
              <Animated.View
                entering={FadeInDown.delay(index * 40).duration(250)}
              >
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/(drivers)/ride-details" as any,
                      params: { rideId: item.ride_id },
                    })
                  }
                  className="bg-white rounded-2xl p-4 mb-2 border border-gray-100"
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.03,
                    shadowRadius: 3,
                  }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center flex-1">
                      <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                      <Text
                        className="text-xs text-gray-600 flex-1"
                        numberOfLines={1}
                      >
                        {item.pickup}
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
                        {item.destination}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between pt-2 border-t border-gray-50">
                    <Text className="text-[10px] text-gray-400">
                      {d.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      ·{" "}
                      {d.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {item.passengers} passenger
                      {item.passengers !== 1 ? "s" : ""}
                    </Text>
                    <Text className="text-sm font-bold text-green-600">
                      +₦{item.total_earned.toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      </SafeAreaView>
    </View>
  );
}
