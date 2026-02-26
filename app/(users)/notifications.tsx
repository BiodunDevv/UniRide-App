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

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function NotificationItem({
  item,
  onPress,
}: {
  item: Notification;
  onPress: () => void;
}) {
  const config = typeConfig[item.type] || typeConfig.system;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row px-6 py-4 ${!item.is_read ? "bg-primary/[0.02]" : ""} active:bg-gray-50`}
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

export default function UserNotificationsScreen() {
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
    Alert.alert(
      "Clear All",
      "Delete all notifications? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => clearAll(),
        },
      ],
    );
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
          <Text className="text-primary text-xl font-bold">Notifications</Text>
          {unreadCount > 0 && (
            <Text className="text-xs text-gray-400 mt-0.5">
              {unreadCount} unread
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
                Clear All
              </Text>
            </Pressable>
          )}
          {unreadCount > 0 && (
            <Pressable
              onPress={markAllRead}
              className="px-3 py-1.5 rounded-full bg-primary/5 active:bg-primary/10"
            >
              <Text className="text-primary text-xs font-semibold">
                Mark all read
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <NotificationItem item={item} onPress={() => handlePress(item)} />
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
            <View className="w-20 h-20 rounded-full bg-primary/5 items-center justify-center mb-4">
              <Ionicons
                name="notifications-off-outline"
                size={36}
                color="#D1D5DB"
              />
            </View>
            <Text className="text-primary text-lg font-bold mb-2">
              No Notifications
            </Text>
            <Text className="text-gray-400 text-sm text-center leading-5">
              You're all caught up! New notifications will appear here when you
              receive ride updates or announcements.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
