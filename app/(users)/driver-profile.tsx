import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";

import { locationApi } from "@/lib/rideApi";
import { T } from "@/hooks/use-translation";

type PublicDriverProfile = {
  _id: string;
  name: string;
  profile_picture: string | null;
  email: string | null;
  phone: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_description: string | null;
  vehicle_image: string | null;
  plate_number: string | null;
  available_seats: number | null;
  rating: number;
  total_ratings: number;
  is_online: boolean;
  status: string;
  last_online_at: string | null;
  joined_at: string | null;
};

function formatJoined(value?: string | null) {
  if (!value) return "Community driver";
  return `Joined ${new Date(value).toLocaleDateString("en-NG", {
    month: "short",
    year: "numeric",
  })}`;
}

export default function DriverProfileScreen() {
  const router = useRouter();
  const { driverId } = useLocalSearchParams<{ driverId?: string }>();
  const [driver, setDriver] = useState<PublicDriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!driverId) {
        setLoading(false);
        return;
      }
      try {
        const res = await locationApi.getPublicDriverProfile(driverId);
        if (mounted) {
          setDriver(res.data || null);
        }
      } catch {
        if (mounted) {
          setDriver(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [driverId]);

  const initials = useMemo(() => {
    if (!driver?.name) return "DR";
    return driver.name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }, [driver?.name]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#042F40" />
      </View>
    );
  }

  if (!driver) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Ionicons name="person-circle-outline" size={52} color="#CBD5E1" />
        <Text className="mt-4 text-center text-base text-slate-500">
          <T>Driver profile is not available right now.</T>
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 rounded-2xl bg-primary px-5 py-3"
        >
          <Text className="font-semibold text-white">
            <T>Go Back</T>
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={["top"]} className="flex-1">
        <Animated.View
          entering={FadeInUp.duration(260)}
          className="px-5 pb-2 pt-3"
        >
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white"
            >
              <Ionicons name="arrow-back" size={20} color="#042F40" />
            </TouchableOpacity>
            <Text className="flex-1 text-xl font-bold text-slate-900">
              <T>Driver Profile</T>
            </Text>
          </View>
        </Animated.View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInUp.delay(60).duration(260)}
            className="rounded-[30px] bg-primary px-5 py-6"
          >
            <View className="flex-row items-center">
              {driver.profile_picture ? (
                <Image
                  source={{ uri: driver.profile_picture }}
                  className="h-20 w-20 rounded-[28px]"
                />
              ) : (
                <View className="h-20 w-20 items-center justify-center rounded-[28px] bg-white/15">
                  <Text className="text-2xl font-bold text-white">
                    {initials}
                  </Text>
                </View>
              )}
              <View className="ml-4 flex-1">
                <View className="flex-row items-center">
                  <Text className="flex-1 text-xl font-bold text-white">
                    {driver.name}
                  </Text>
                  <View
                    className={`rounded-full px-3 py-1 ${driver.is_online ? "bg-emerald-500/20" : "bg-white/10"}`}
                  >
                    <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                      {driver.is_online ? "Online" : "Offline"}
                    </Text>
                  </View>
                </View>
                <Text className="mt-1 text-sm text-white/70">
                  {formatJoined(driver.joined_at)}
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  <View className="rounded-full bg-white/10 px-3 py-1.5">
                    <Text className="text-xs font-semibold text-white">
                      {driver.vehicle_model || "Vehicle ready"}
                    </Text>
                  </View>
                  {driver.vehicle_color ? (
                    <View className="rounded-full bg-white/10 px-3 py-1.5">
                      <Text className="text-xs font-semibold text-white">
                        {driver.vehicle_color}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            <View className="mt-5 flex-row gap-3">
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] uppercase tracking-[0.16em] text-white/65">
                  <T>Rating</T>
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {driver.rating > 0 ? driver.rating.toFixed(1) : "New"}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] uppercase tracking-[0.16em] text-white/65">
                  <T>Reviews</T>
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {driver.total_ratings || 0}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] uppercase tracking-[0.16em] text-white/65">
                  <T>Seats</T>
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {driver.available_seats || "—"}
                </Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(100).duration(260)}
            className="mt-4 rounded-[28px] border border-slate-200 bg-white px-5 py-5"
          >
            <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <T>Ride Identity</T>
            </Text>
            <View className="mt-4 gap-4">
              <View className="rounded-2xl bg-slate-50 px-4 py-4">
                <Text className="text-xs text-slate-500">
                  <T>Vehicle</T>
                </Text>
                <Text className="mt-1 text-base font-semibold text-slate-900">
                  {[driver.vehicle_model, driver.vehicle_color]
                    .filter(Boolean)
                    .join(" · ") || "Vehicle details unavailable"}
                </Text>
              </View>
              <View className="rounded-2xl bg-slate-50 px-4 py-4">
                <Text className="text-xs text-slate-500">
                  <T>Plate Number</T>
                </Text>
                <Text className="mt-1 text-base font-semibold text-slate-900">
                  {driver.plate_number || "Unavailable"}
                </Text>
              </View>
              {driver.vehicle_description ? (
                <View className="rounded-2xl bg-slate-50 px-4 py-4">
                  <Text className="text-xs text-slate-500">
                    <T>About this ride</T>
                  </Text>
                  <Text className="mt-1 text-sm leading-6 text-slate-700">
                    {driver.vehicle_description}
                  </Text>
                </View>
              ) : null}
              {driver.vehicle_image ? (
                <Image
                  source={{ uri: driver.vehicle_image }}
                  className="h-44 w-full rounded-[24px]"
                  resizeMode="cover"
                />
              ) : null}
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(140).duration(260)}
            className="mt-4 rounded-[28px] border border-slate-200 bg-white px-5 py-5"
          >
            <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <T>Contact</T>
            </Text>
            <Text className="mt-3 text-sm leading-6 text-slate-600">
              <T>
                Use the contact action if you need help coordinating pickup or
                arrival details for your trip.
              </T>
            </Text>
            <TouchableOpacity
              onPress={() =>
                driver.phone ? Linking.openURL(`tel:${driver.phone}`) : undefined
              }
              disabled={!driver.phone}
              className={`mt-4 flex-row items-center justify-center rounded-2xl px-4 py-4 ${driver.phone ? "bg-primary" : "bg-slate-200"}`}
            >
              <Ionicons
                name="call"
                size={18}
                color={driver.phone ? "#FFFFFF" : "#94A3B8"}
              />
              <Text
                className={`ml-2 text-sm font-semibold ${driver.phone ? "text-white" : "text-slate-500"}`}
              >
                {driver.phone || "Phone not available"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
