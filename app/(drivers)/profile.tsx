import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import * as WebBrowser from "expo-web-browser";

import { useAuthStore } from "@/store/useAuthStore";
import { useLocationStore } from "@/store/useLocationStore";
import { T } from "@/hooks/use-translation";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || "http://localhost:3000";

export default function DriverProfileScreen() {
  const router = useRouter();
  const { user, logout, fetchMe } = useAuthStore();
  const { isDriverOnline } = useLocationStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMe();
    } catch {}
    setRefreshing(false);
  }, []);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "D";
  const driverProfile = user?.driver;

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
          } catch {}
          setLoggingOut(false);
          router.replace("/auth/role-select");
        },
      },
    ]);
  };

  const menuItems = [
    {
      icon: "person-outline",
      label: "Edit Profile",
      route: "/settings/edit-driver-profile",
      color: "#042F40",
    },
    {
      icon: "lock-closed-outline",
      label: "Change Password",
      route: "/settings/change-password",
      color: "#042F40",
    },
    {
      icon: "finger-print-outline",
      label: "Security",
      route: "/settings/security",
      color: "#042F40",
    },
    {
      icon: "notifications-outline",
      label: "Notifications",
      route: "/settings/notification-settings",
      color: "#042F40",
    },
    {
      icon: "phone-portrait-outline",
      label: "Linked Devices",
      route: "/settings/devices",
      color: "#042F40",
    },
    {
      icon: "language-outline",
      label: "Language",
      route: "/language-picker",
      color: "#042F40",
    },
    {
      icon: "car-sport-outline",
      label: "Vehicle Info",
      route: "/settings/vehicle",
      color: "#D4A017",
    },
    {
      icon: "help-circle-outline",
      label: "Support",
      route: "__support__",
      color: "#6B7280",
    },
    {
      icon: "star-outline",
      label: "Leave a Review",
      route: "__review__",
      color: "#D4A017",
    },
    {
      icon: "document-text-outline",
      label: "Terms of Service",
      route: "/auth/terms",
      color: "#6B7280",
    },
  ];

  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={["top"]} className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#042F40"
            />
          }
        >
          {/* Header */}
          <Animated.View
            entering={FadeInUp.duration(300)}
            className="px-5 pt-3 pb-2"
          >
            <View className="mb-5 flex-row items-center">
              <TouchableOpacity
                onPress={() => router.back()}
                className="mr-3 h-10 w-10 rounded-full bg-white items-center justify-center"
              >
                <Ionicons name="arrow-back" size={20} color="#042F40" />
              </TouchableOpacity>
              <View>
                <Text className="text-xl font-bold text-gray-900">
                  <T>Profile</T>
                </Text>
                <Text className="text-xs text-slate-500">
                  <T>Your driver account and tools</T>
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Avatar + Info */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(300)}
            className="mx-5 mb-5 rounded-[30px] bg-[#042F40] px-5 py-6"
          >
            <View className="flex-row items-center">
              {user?.profile_picture ? (
                <Image
                  source={{ uri: user.profile_picture }}
                  className="h-24 w-24 rounded-full"
                />
              ) : (
                <View className="h-24 w-24 rounded-full bg-white/15 items-center justify-center">
                  <Text className="text-white font-bold text-2xl">
                    {initials}
                  </Text>
                </View>
              )}
              <View className="ml-4 flex-1">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4A017]">
                  <T>Driver Account</T>
                </Text>
                <Text className="mt-1 text-2xl font-bold text-white">
                  {user?.name || "Driver"}
                </Text>
                <Text className="mt-1 text-sm text-slate-300">
                  {user?.email || ""}
                </Text>
                <View className="mt-3 flex-row items-center gap-2">
                  <View className="rounded-full bg-white/10 px-3 py-1.5">
                    <Text className="text-xs font-semibold text-white capitalize">
                      {user?.role || "driver"}
                    </Text>
                  </View>
                  <View
                    className={`rounded-full px-3 py-1.5 ${isDriverOnline ? "bg-emerald-500/20" : "bg-white/10"}`}
                  >
                    <Text
                      className={`text-xs font-semibold ${isDriverOnline ? "text-emerald-200" : "text-slate-300"}`}
                    >
                      {isDriverOnline ? "Online" : "Offline"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Vehicle Info */}
          {driverProfile && (
            <Animated.View
              entering={FadeInUp.delay(150).duration(300)}
              className="mx-5 mb-4 rounded-[28px] bg-white p-4"
            >
              <Text className="text-xs font-semibold text-gray-400 uppercase mb-3 tracking-wider">
                <T>Vehicle</T>
              </Text>
              <View className="flex-row justify-between mb-1">
                <Text className="text-xs text-gray-500">
                  <T>Model</T>
                </Text>
                <Text className="text-xs font-semibold text-gray-800">
                  {driverProfile.vehicle_model}
                </Text>
              </View>
              <View className="flex-row justify-between mb-1">
                <Text className="text-xs text-gray-500">
                  <T>Color</T>
                </Text>
                <Text className="text-xs font-semibold text-gray-800">
                  {driverProfile.vehicle_color}
                </Text>
              </View>
              <View className="flex-row justify-between mb-1">
                <Text className="text-xs text-gray-500">
                  <T>Plate</T>
                </Text>
                <Text className="text-xs font-semibold text-gray-800">
                  {driverProfile.plate_number}
                </Text>
              </View>
              {driverProfile.rating != null && (
                <View className="flex-row justify-between">
                  <Text className="text-xs text-gray-500">
                    <T>Rating</T>
                  </Text>
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={10} color="#D4A017" />
                    <Text className="text-xs font-semibold text-accent ml-1">
                      {driverProfile.rating?.toFixed?.(1) ||
                        driverProfile.rating}
                    </Text>
                  </View>
                </View>
              )}
            </Animated.View>
          )}

        
          {/* Menu */}
          <View className="mx-5 rounded-[28px] bg-white px-4 py-2">
            {menuItems.map((item, idx) => (
              <Animated.View
                key={item.label}
                entering={FadeInDown.delay(idx * 40).duration(250)}
              >
                <TouchableOpacity
                  onPress={() => {
                    if (item.route === "__support__") {
                      WebBrowser.openBrowserAsync(`${WEB_URL}/support`, {
                        presentationStyle:
                          WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                        controlsColor: "#042F40",
                        toolbarColor: "#FFFFFF",
                      });
                    } else if (item.route === "__review__") {
                      const authToken = useAuthStore.getState().token;
                      const reviewUrl = authToken
                        ? `${WEB_URL}/reviews?token=${authToken}`
                        : `${WEB_URL}/reviews`;
                      WebBrowser.openBrowserAsync(reviewUrl, {
                        presentationStyle:
                          WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                        controlsColor: "#042F40",
                        toolbarColor: "#FFFFFF",
                      });
                    } else {
                      router.push(item.route as any);
                    }
                  }}
                  className="flex-row items-center py-3.5 border-b border-slate-100"
                  activeOpacity={0.7}
                >
                  <View className="w-10 h-10 rounded-2xl bg-slate-50 items-center justify-center mr-3">
                    <Ionicons
                      name={item.icon as any}
                      size={18}
                      color={item.color}
                    />
                  </View>
                  <Text className="flex-1 text-sm text-gray-700">
                    <T>{item.label}</T>
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          {/* Logout */}
          <Animated.View
            entering={FadeInDown.delay(350).duration(250)}
            className="mx-5 mt-6"
          >
            <TouchableOpacity
              onPress={handleLogout}
              disabled={loggingOut}
              className="bg-white rounded-2xl py-4 items-center border border-red-100"
            >
              {loggingOut ? (
                <ActivityIndicator color="#EF4444" />
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                  <Text className="text-red-500 font-bold text-sm ml-2">
                    <T>Logout</T>
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
