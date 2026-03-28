import React, { useCallback, useState } from "react";
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
import { useNotificationStore, type Notification } from "@/store/useNotificationStore";
import { T } from "@/hooks/use-translation";
import { getNotificationPresentation } from "@/lib/notificationPresentation";

type Props = {
  routeBase: "(users)" | "(drivers)";
};

export function NotificationListScreen({ routeBase }: Props) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markRead,
    markAllRead,
  } = useNotificationStore();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const handlePress = useCallback(
    async (notif: Notification) => {
      if (!notif.is_read) {
        await markRead(notif._id);
      }

      router.push({
        pathname: `/${routeBase}/notification-detail` as any,
        params: { notificationId: notif._id },
      });
    },
    [markRead, routeBase, router],
  );

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="flex-1">
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="px-5 pt-3 pb-2"
        >
          <View className="mb-1 flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-gray-100"
            >
              <Ionicons name="arrow-back" size={20} color="#042F40" />
            </TouchableOpacity>
            <Text className="flex-1 text-xl font-bold text-gray-900">
              <T>Notifications</T>
            </Text>
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={markAllRead}
                className="rounded-full bg-primary/10 px-3 py-1.5"
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
              paddingTop: 8,
              paddingBottom: 48,
              flexGrow: notifications.length === 0 ? 1 : undefined,
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
              <View className="mt-16 items-center">
                <Ionicons
                  name={
                    error ? "alert-circle-outline" : "notifications-off-outline"
                  }
                  size={48}
                  color={error ? "#EF4444" : "#D1D5DB"}
                />
                <Text className="mt-4 text-base text-gray-400">
                  {error ? error : <T>No notifications</T>}
                </Text>
                {error ? (
                  <TouchableOpacity
                    onPress={() => fetchNotifications()}
                    className="mt-4 rounded-2xl bg-primary px-5 py-3"
                  >
                    <Text className="text-sm font-semibold text-white">
                      <T>Try Again</T>
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            }
            renderItem={({ item, index }) => {
              const info = getNotificationPresentation(item);
              const d = new Date(item.createdAt);
              return (
                <Animated.View
                  entering={FadeInDown.delay(index * 40).duration(250)}
                >
                  <TouchableOpacity
                    onPress={() => handlePress(item)}
                    className={`mb-2 flex-row items-start rounded-xl p-3.5 ${item.is_read ? "bg-white" : "bg-primary/[0.02]"}`}
                    activeOpacity={0.7}
                  >
                    <View
                      className={`mr-3 h-10 w-10 items-center justify-center rounded-full ${info.bgClassName}`}
                    >
                      <Ionicons name={info.icon as any} size={18} color={info.color} />
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-sm ${item.is_read ? "text-gray-600" : "font-semibold text-gray-900"}`}
                        numberOfLines={2}
                      >
                        {item.title || item.message}
                      </Text>
                      {item.message && item.title && (
                        <Text
                          className="mt-0.5 text-xs text-gray-400"
                          numberOfLines={2}
                        >
                          {item.message}
                        </Text>
                      )}
                      <Text className="mt-1 text-[10px] text-gray-300">
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
                      <View className="mt-2 h-2 w-2 rounded-full bg-accent" />
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
