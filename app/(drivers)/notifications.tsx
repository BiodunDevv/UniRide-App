import React, { useState, useCallback } from "react";
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

import { useNotificationStore } from "@/store/useNotificationStore";
import { T } from "@/hooks/use-translation";

const TYPE_ICONS: Record<string, { icon: string; bg: string; color: string }> =
  {
    new_booking: { icon: "person-add", bg: "bg-accent/10", color: "#D4A017" },
    booking_cancelled: {
      icon: "close-circle",
      bg: "bg-red-50",
      color: "#EF4444",
    },
    ride_request: { icon: "hand-right", bg: "bg-purple-50", color: "#7C3AED" },
    check_in_success: { icon: "key", bg: "bg-green-50", color: "#16A34A" },
    payment_received: { icon: "cash", bg: "bg-green-50", color: "#16A34A" },
    broadcast: { icon: "megaphone", bg: "bg-purple-50", color: "#7C3AED" },
    default: { icon: "notifications", bg: "bg-gray-50", color: "#6B7280" },
  };

export default function DriverNotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markRead,
    markAllRead,
  } = useNotificationStore();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, []);

  const handlePress = async (notif: any) => {
    if (!notif.is_read) await markRead(notif._id);
    router.push({
      pathname: "/(drivers)/notification-detail" as any,
      params: { notificationId: notif._id },
    });
  };

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="flex-1">
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="px-5 pt-3 pb-2"
        >
          <View className="flex-row items-center mb-1">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={20} color="#042F40" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-gray-900 flex-1">
              <T>Notifications</T>
            </Text>
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={markAllRead}
                className="px-3 py-1.5 rounded-full bg-primary/10"
              >
                <Text className="text-xs font-semibold text-primary">
                  <T>Mark all read</T>
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {isLoading && notifications.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#042F40" />
          </View>
        ) : (
          <FlatList
            data={notifications}
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
                <Ionicons
                  name="notifications-off-outline"
                  size={48}
                  color="#D1D5DB"
                />
                <Text className="text-base text-gray-400 mt-4">
                  <T>No notifications</T>
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const info = TYPE_ICONS[item.type] || TYPE_ICONS.default;
              const d = new Date(item.createdAt);
              return (
                <Animated.View
                  entering={FadeInDown.delay(index * 40).duration(250)}
                >
                  <TouchableOpacity
                    onPress={() => handlePress(item)}
                    className={`flex-row items-start p-3.5 rounded-xl mb-2 ${item.is_read ? "bg-white" : "bg-primary/[0.02]"}`}
                    activeOpacity={0.7}
                  >
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${info.bg}`}
                    >
                      <Ionicons
                        name={info.icon as any}
                        size={18}
                        color={info.color}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-sm ${item.is_read ? "text-gray-600" : "text-gray-900 font-semibold"}`}
                        numberOfLines={2}
                      >
                        {item.title || item.message}
                      </Text>
                      {item.message && item.title && (
                        <Text
                          className="text-xs text-gray-400 mt-0.5"
                          numberOfLines={2}
                        >
                          {item.message}
                        </Text>
                      )}
                      <Text className="text-[10px] text-gray-300 mt-1">
                        {d.toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        ·{" "}
                        {d.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    {!item.is_read && (
                      <View className="w-2 h-2 rounded-full bg-accent mt-2" />
                    )}
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
