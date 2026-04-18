import React, { useEffect, useState, useCallback, useMemo } from "react";
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
import { useAuthStore } from "@/store/useAuthStore";
import { useSocket } from "@/hooks/use-socket";

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
  year_earnings?: number;
  total_rides: number;
  total_passengers: number;
  selected_period?: "all" | "week" | "month" | "year";
  filtered_earnings?: number;
  filtered_rides?: number;
  filtered_passengers?: number;
  rides: RideEarning[];
}

type EarningsPeriod = "week" | "month" | "year";

const PERIOD_OPTIONS: Array<{ key: EarningsPeriod; label: string }> = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

function getPeriodStart(period: EarningsPeriod): Date {
  const now = new Date();

  if (period === "week") {
    const start = new Date(now);
    const day = start.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - mondayOffset);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return new Date(now.getFullYear(), 0, 1);
}

function formatPeriodTitle(period: EarningsPeriod): string {
  if (period === "week") return "This Week";
  if (period === "month") return "This Month";
  return "This Year";
}

export default function EarningsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { connect, joinUserFeed } = useSocket();
  const [data, setData] = useState<EarningsData | null>(null);
  const [period, setPeriod] = useState<EarningsPeriod>("month");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = useCallback(async () => {
    try {
      const res = await bookingApi.getDriverEarnings("all");
      setData(res.data);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await connect();
        if (user?.id) {
          joinUserFeed(user.id);
        }
      } catch {}
      await fetchEarnings();
      setLoading(false);
    })();
  }, [connect, fetchEarnings, joinUserFeed, user?.id]);

  // Real-time: refresh when rides complete
  useEffect(() => {
    const u1 = eventBus.on("ride:ended", () => fetchEarnings());
    const u2 = eventBus.on("booking:updated", () => fetchEarnings());
    const u3 = eventBus.on("ride:started", () => fetchEarnings());
    const u4 = eventBus.on("ride:cancelled", () => fetchEarnings());
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [fetchEarnings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEarnings();
    setRefreshing(false);
  }, [fetchEarnings]);

  const periodStart = useMemo(() => getPeriodStart(period), [period]);

  const filteredRides = useMemo(() => {
    const rides = data?.rides || [];
    return rides.filter((ride) => {
      const sourceDate = ride.ended_at || ride.departure_time;
      if (!sourceDate) return false;
      const date = new Date(sourceDate);
      if (Number.isNaN(date.getTime())) return false;
      return date >= periodStart;
    });
  }, [data?.rides, periodStart]);

  const periodEarnings = useMemo(
    () =>
      filteredRides.reduce((sum, ride) => sum + (ride.total_earned || 0), 0),
    [filteredRides],
  );

  const periodPassengers = useMemo(
    () => filteredRides.reduce((sum, ride) => sum + (ride.passengers || 0), 0),
    [filteredRides],
  );

  const yearEarnings = useMemo(() => {
    if (typeof data?.year_earnings === "number") return data.year_earnings;
    const rides = data?.rides || [];
    const start = new Date(new Date().getFullYear(), 0, 1);
    return rides
      .filter((ride) => {
        const sourceDate = ride.ended_at || ride.departure_time;
        if (!sourceDate) return false;
        const date = new Date(sourceDate);
        return !Number.isNaN(date.getTime()) && date >= start;
      })
      .reduce((sum, ride) => sum + (ride.total_earned || 0), 0);
  }, [data?.rides, data?.year_earnings]);

  const periodTitle = useMemo(() => formatPeriodTitle(period), [period]);

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
          data={filteredRides}
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
              {/* Period Hero */}
              <Animated.View
                entering={FadeInUp.delay(100).duration(300)}
                className="bg-primary rounded-2xl p-6 items-center mb-4"
              >
                <Text className="text-white/60 text-xs font-medium uppercase tracking-wider">
                  {periodTitle}
                </Text>
                <Text className="text-white text-4xl font-bold mt-1">
                  ₦{periodEarnings.toLocaleString()}
                </Text>
                <View className="mt-2 flex-row items-center gap-3 rounded-full bg-white/10 px-3 py-1.5">
                  <Text className="text-[11px] font-semibold text-white/90">
                    {filteredRides.length} <T>ride</T>
                    {filteredRides.length === 1 ? "" : "s"}
                  </Text>
                  <View className="h-3.5 w-px bg-white/30" />
                  <Text className="text-[11px] font-semibold text-white/90">
                    {periodPassengers} <T>passenger</T>
                    {periodPassengers === 1 ? "" : "s"}
                  </Text>
                </View>
              </Animated.View>

              {/* Period Selector */}
              <Animated.View
                entering={FadeInUp.delay(200).duration(300)}
                className="mb-3 flex-row gap-2"
              >
                {PERIOD_OPTIONS.map((option) => {
                  const active = period === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      onPress={() => setPeriod(option.key)}
                      className={`flex-1 rounded-full border px-3 py-2.5 items-center ${
                        active
                          ? "border-[#042F40] bg-[#042F40]"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          active ? "text-white" : "text-slate-600"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>

              {/* Breakdown */}
              <Animated.View
                entering={FadeInUp.delay(220).duration(300)}
                className="flex-row gap-3 mb-3"
              >
                <View className="flex-1 bg-blue-50 rounded-2xl p-3 items-center border border-blue-100">
                  <Text className="text-[10px] text-gray-400 uppercase">
                    <T>This Week</T>
                  </Text>
                  <Text className="text-base font-bold text-blue-700 mt-0.5">
                    ₦{(data?.week_earnings || 0).toLocaleString()}
                  </Text>
                </View>
                <View className="flex-1 bg-violet-50 rounded-2xl p-3 items-center border border-violet-100">
                  <Text className="text-[10px] text-gray-400 uppercase">
                    <T>This Month</T>
                  </Text>
                  <Text className="text-base font-bold text-violet-700 mt-0.5">
                    ₦{(data?.month_earnings || 0).toLocaleString()}
                  </Text>
                </View>
                <View className="flex-1 bg-emerald-50 rounded-2xl p-3 items-center border border-emerald-100">
                  <Text className="text-[10px] text-gray-400 uppercase">
                    <T>This Year</T>
                  </Text>
                  <Text className="text-base font-bold text-emerald-700 mt-0.5">
                    ₦{yearEarnings.toLocaleString()}
                  </Text>
                </View>
              </Animated.View>

              <Animated.View
                entering={FadeInUp.delay(240).duration(300)}
                className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold text-slate-500 uppercase">
                    Lifetime total
                  </Text>
                  <Text className="text-sm font-bold text-slate-900">
                    ₦{(data?.total_earnings || 0).toLocaleString()}
                  </Text>
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-xs text-slate-500">
                    {data?.total_rides || 0} <T>rides</T>
                  </Text>
                  <Text className="text-xs text-slate-500">
                    {data?.total_passengers || 0} <T>passengers</T>
                  </Text>
                  <Text className="text-xs font-semibold text-slate-700">
                    <T>Today</T> · ₦
                    {(data?.today_earnings || 0).toLocaleString()}
                  </Text>
                </View>
              </Animated.View>

              {/* Section Header */}
              <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">
                <T>Ride History</T> · {periodTitle}
              </Text>
            </>
          }
          ListEmptyComponent={
            <View className="items-center mt-12">
              <Ionicons name="wallet-outline" size={48} color="#D1D5DB" />
              <Text className="text-base text-gray-400 mt-4">
                <T>No rides found for this period</T>
              </Text>
              <Text className="text-xs text-gray-300 mt-1">
                <T>Complete rides to populate this report</T>
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
