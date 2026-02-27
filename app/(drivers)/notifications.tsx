import { useEffect, useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  useNotificationStore,
  type Notification,
} from "@/store/useNotificationStore";
import NotificationSkeleton from "@/components/ui/NotificationSkeleton";
import { useTranslations } from "@/hooks/use-translation";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const typeConfig: Record<
  string,
  { icon: IoniconsName; color: string; bg: string }
> = {
  broadcast: {
    icon: "radio-outline",
    color: "#D4A017",
    bg: "bg-[#D4A017]/10",
  },
  ride: { icon: "car-outline", color: "#042F40", bg: "bg-primary/5" },
  booking: {
    icon: "calendar-outline",
    color: "#7C3AED",
    bg: "bg-purple-50",
  },
  system: { icon: "settings-outline", color: "#6B7280", bg: "bg-gray-100" },
  promotion: {
    icon: "megaphone-outline",
    color: "#059669",
    bg: "bg-green-50",
  },
  security: {
    icon: "shield-checkmark-outline",
    color: "#DC2626",
    bg: "bg-red-50",
  },
  account: {
    icon: "person-circle-outline",
    color: "#2563EB",
    bg: "bg-blue-50",
  },
};

function formatTimeRaw(
  dateStr: string,
  tJustNow: string,
  tMAgo: string,
  tHAgo: string,
  tDAgo: string,
) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return tJustNow;
  if (diffMin < 60) return `${diffMin}${tMAgo}`;
  if (diffHr < 24) return `${diffHr}${tHAgo}`;
  if (diffDay < 7) return `${diffDay}${tDAgo}`;
  return date.toLocaleDateString();
}

function NotificationItem({
  item,
  onPress,
  formatTime,
}: {
  item: Notification;
  onPress: () => void;
  formatTime: (dateStr: string) => string;
}) {
  const config = typeConfig[item.type] || typeConfig.system;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row px-6 py-4 ${!item.is_read ? "bg-[#D4A017]/[0.02]" : ""} active:bg-gray-50`}
    >
      <View
        className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${config.bg}`}
      >
        <Ionicons name={config.icon} size={18} color={config.color} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text
            className={`text-sm flex-1 mr-2 ${!item.is_read ? "font-bold text-primary" : "font-medium text-gray-600"}`}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text className="text-[10px] text-gray-400">
            {formatTime(item.createdAt)}
          </Text>
        </View>
        <Text className="text-xs text-gray-400 leading-4" numberOfLines={2}>
          {item.message}
        </Text>
      </View>
      {!item.is_read && (
        <View className="ml-2 mt-1.5">
          <View className="w-2 h-2 rounded-full bg-[#D4A017]" />
        </View>
      )}
    </Pressable>
  );
}

export default function DriverNotificationsScreen() {
  const [
    tNotifications,
    tUnread,
    tClearAll,
    tDeleteAll,
    tCancel,
    tClearAllBtn,
    tMarkAllRead,
    tNoNotifications,
    tEmptyMessage,
    tJustNow,
    tMAgo,
    tHAgo,
    tDAgo,
  ] = useTranslations([
    "Notifications",
    "unread",
    "Clear All",
    "Delete all notifications? This cannot be undone.",
    "Cancel",
    "Clear All",
    "Mark all read",
    "No Notifications",
    "You're all caught up! Ride requests, trip updates, and announcements will appear here.",
    "Just now",
    "m ago",
    "h ago",
    "d ago",
  ]);

  const formatTime = useCallback(
    (dateStr: string) => formatTimeRaw(dateStr, tJustNow, tMAgo, tHAgo, tDAgo),
    [tJustNow, tMAgo, tHAgo, tDAgo],
  );

  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markRead,
    markAllRead,
    clearAll,
    startPolling,
    stopPolling,
  } = useNotificationStore();

  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    fetchNotifications().finally(() => setInitialLoad(false));
    startPolling(15000);
    return () => stopPolling();
  }, []);

  const onRefresh = useCallback(() => {
    fetchNotifications();
  }, []);

  const handlePress = (item: Notification) => {
    if (!item.is_read) markRead(item._id);
    router.push({
      pathname: "/settings/notification-detail",
      params: { id: item._id },
    });
  };

  const handleClearAll = () => {
    Alert.alert(tClearAll, tDeleteAll, [
      { text: tCancel, style: "cancel" },
      {
        text: tClearAllBtn,
        style: "destructive",
        onPress: () => clearAll(),
      },
    ]);
  };

  if (initialLoad) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <NotificationSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-3">
        <View>
          <Text className="text-primary text-xl font-bold">
            {tNotifications}
          </Text>
          {unreadCount > 0 && (
            <Text className="text-xs text-gray-400 mt-0.5">
              {unreadCount} {tUnread}
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          {notifications.length > 0 && (
            <Pressable
              onPress={handleClearAll}
              className="px-3 py-1.5 rounded-full bg-red-50 active:bg-red-100"
            >
              <Text className="text-red-500 text-xs font-semibold">
                {tClearAllBtn}
              </Text>
            </Pressable>
          )}
          {unreadCount > 0 && (
            <Pressable
              onPress={markAllRead}
              className="px-3 py-1.5 rounded-full bg-[#D4A017]/10 active:bg-[#D4A017]/20"
            >
              <Text className="text-[#D4A017] text-xs font-semibold">
                {tMarkAllRead}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <NotificationItem
            item={item}
            onPress={() => handlePress(item)}
            formatTime={formatTime}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor="#042F40"
          />
        }
        contentContainerStyle={
          notifications.length === 0 ? { flex: 1 } : { paddingBottom: 100 }
        }
        ItemSeparatorComponent={() => <View className="h-px bg-gray-50 mx-6" />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8">
            <View className="w-20 h-20 rounded-full bg-[#D4A017]/10 items-center justify-center mb-4">
              <Ionicons
                name="notifications-off-outline"
                size={36}
                color="#D1D5DB"
              />
            </View>
            <Text className="text-primary text-lg font-bold mb-2">
              {tNoNotifications}
            </Text>
            <Text className="text-gray-400 text-sm text-center leading-5">
              {tEmptyMessage}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
