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
import { T } from "@/hooks/use-translation";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || "http://localhost:3000";

export default function UserProfileScreen() {
  const router = useRouter();
  const { user, logout, fetchMe } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const deletionStatus = user?.account_deletion_status;
  const hasDeletionState = ["pending_review", "scheduled", "rejected"].includes(
    deletionStatus || "",
  );
  const deletionUrl =
    deletionStatus === "scheduled" || deletionStatus === "pending_review"
      ? `${WEB_URL}/account-deletion?mode=cancel&source=mobile`
      : `${WEB_URL}/account-deletion?mode=request&source=mobile`;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMe();
    } catch {}
    setRefreshing(false);
  }, [fetchMe]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
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
      route: "/settings/edit-profile",
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
    {
      icon: "trash-outline",
      label: "Delete Account",
      route: "__account_deletion__",
      color: "#DC2626",
    },
  ];

  // ═════════════════════════════════════════════════════════════════════
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
                  <T>Your account and personal settings</T>
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
                  <T>Passenger Account</T>
                </Text>
                <Text className="mt-1 text-2xl font-bold text-white">
                  {user?.name || "User"}
                </Text>
                <Text className="mt-1 text-sm text-slate-300">
                  {user?.email || ""}
                </Text>
                {user?.phone ? (
                  <View className="mt-2 self-start flex-row items-center rounded-full bg-white/10 px-3 py-1.5">
                    <Ionicons
                      name="call-outline"
                      size={13}
                      color="#E2E8F0"
                    />
                    <Text className="ml-2 text-xs font-semibold text-white">
                      {user.phone}
                    </Text>
                  </View>
                ) : null}
                <View className="mt-3 self-start rounded-full bg-white/10 px-3 py-1.5">
                  <Text className="text-xs font-semibold text-white capitalize">
                    {user?.role || "user"}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {hasDeletionState ? (
            <Animated.View
              entering={FadeInUp.delay(140).duration(300)}
              className="mx-5 mb-4 rounded-[28px] border border-amber-100 bg-amber-50 p-4"
            >
              <Text className="text-sm font-semibold text-amber-900">
                {deletionStatus === "pending_review"
                  ? "Account deletion request pending review"
                  : deletionStatus === "scheduled"
                    ? "Account deletion scheduled"
                    : "Account deletion request rejected"}
              </Text>
              <Text className="mt-2 text-xs leading-5 text-amber-800">
                {deletionStatus === "pending_review"
                  ? "UniRide has received your request. An administrator will review it before any deletion is scheduled."
                  : deletionStatus === "scheduled"
                    ? `Your account is scheduled for deletion on ${new Date(
                        user?.account_deletion_scheduled_for || "",
                      ).toLocaleString()}. You can still cancel this request before that date.`
                    : user?.account_deletion_review_note ||
                      "Your request was rejected. Open the account deletion page for more details."}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  WebBrowser.openBrowserAsync(deletionUrl, {
                    presentationStyle:
                      WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                    controlsColor: "#042F40",
                    toolbarColor: "#FFFFFF",
                  })
                }
                className="mt-3 self-start rounded-full bg-amber-900 px-4 py-2"
              >
                <Text className="text-xs font-semibold text-white">
                  {deletionStatus === "scheduled" ||
                  deletionStatus === "pending_review"
                    ? "Cancel deletion request"
                    : "Open deletion details"}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ) : null}

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
                    } else if (item.route === "__account_deletion__") {
                      WebBrowser.openBrowserAsync(deletionUrl, {
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
