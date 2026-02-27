import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNotificationStore } from "@/store/useNotificationStore";
import { FadeIn } from "@/components/ui/animations";
import { T } from "@/hooks/use-translation";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const typeConfig: Record<
  string,
  { icon: IoniconsName; color: string; bg: string; label: string }
> = {
  broadcast: {
    icon: "radio-outline",
    color: "#D4A017",
    bg: "bg-[#D4A017]/10",
    label: "Broadcast",
  },
  ride: {
    icon: "car-outline",
    color: "#042F40",
    bg: "bg-primary/5",
    label: "Ride",
  },
  booking: {
    icon: "calendar-outline",
    color: "#7C3AED",
    bg: "bg-purple-50",
    label: "Booking",
  },
  system: {
    icon: "settings-outline",
    color: "#6B7280",
    bg: "bg-gray-100",
    label: "System",
  },
  promotion: {
    icon: "megaphone-outline",
    color: "#059669",
    bg: "bg-green-50",
    label: "Promotion",
  },
  security: {
    icon: "shield-checkmark-outline",
    color: "#DC2626",
    bg: "bg-red-50",
    label: "Security",
  },
  account: {
    icon: "person-circle-outline",
    color: "#2563EB",
    bg: "bg-blue-50",
    label: "Account",
  },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { notifications, fetchDetail } = useNotificationStore();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    // Try from local store first
    const local = notifications.find((n) => n._id === id);
    if (local) setDetail(local);

    if (!id) return;
    setLoading(true);
    try {
      const fetched = await fetchDetail(id);
      if (fetched) setDetail(fetched);
    } catch {
      // Use local if fetch fails
    } finally {
      setLoading(false);
    }
  };

  if (loading && !detail) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#042F40" />
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <Ionicons name="alert-circle-outline" size={48} color="#D1D5DB" />
        <Text className="text-primary text-lg font-bold mt-4">
          <T>Not Found</T>
        </Text>
        <Text className="text-gray-400 text-sm text-center mt-1">
          <T>This notification could not be loaded.</T>
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 px-6 py-3 rounded-xl bg-primary"
        >
          <Text className="text-white text-sm font-bold">
            <T>Go Back</T>
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const config = typeConfig[detail.type] || typeConfig.system;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-4">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color="#042F40" />
        </Pressable>
        <Text className="text-primary text-lg font-bold">
          <T>Detail</T>
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* Type Icon & Badge */}
        <FadeIn delay={0}>
          <View className="items-center pt-6 pb-6">
            <View
              className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${config.bg}`}
            >
              <Ionicons name={config.icon} size={28} color={config.color} />
            </View>
            <View
              className="px-3 py-1 rounded-full mb-4"
              style={{ backgroundColor: config.color + "15" }}
            >
              <Text
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: config.color }}
              >
                <T>{config.label}</T>
              </Text>
            </View>
            <Text className="text-primary text-xl font-bold text-center">
              {detail.title}
            </Text>
          </View>
        </FadeIn>

        {/* Message */}
        <FadeIn delay={100}>
          <View className="bg-gray-50 rounded-2xl p-5 mb-6">
            <Text className="text-gray-600 text-sm leading-6">
              {detail.message}
            </Text>
          </View>
        </FadeIn>

        {/* Metadata */}
        <FadeIn delay={200}>
          <View className="bg-white rounded-2xl border border-gray-100 mb-6">
            <View className="flex-row items-center p-4">
              <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
              <Text className="text-gray-400 text-sm ml-3 flex-1">
                <T>Date</T>
              </Text>
              <Text className="text-primary text-sm font-medium">
                {formatDate(detail.createdAt)}
              </Text>
            </View>
            <View className="h-px bg-gray-100 mx-4" />
            <View className="flex-row items-center p-4">
              <Ionicons name="time-outline" size={18} color="#9CA3AF" />
              <Text className="text-gray-400 text-sm ml-3 flex-1">
                <T>Time</T>
              </Text>
              <Text className="text-primary text-sm font-medium">
                {formatTime(detail.createdAt)}
              </Text>
            </View>
            <View className="h-px bg-gray-100 mx-4" />
            <View className="flex-row items-center p-4">
              <Ionicons name="eye-outline" size={18} color="#9CA3AF" />
              <Text className="text-gray-400 text-sm ml-3 flex-1">
                <T>Status</T>
              </Text>
              <View
                className={`px-2.5 py-0.5 rounded-full ${detail.is_read ? "bg-gray-100" : "bg-green-50"}`}
              >
                <Text
                  className={`text-xs font-semibold ${detail.is_read ? "text-gray-500" : "text-green-600"}`}
                >
                  {detail.is_read ? <T>Read</T> : <T>New</T>}
                </Text>
              </View>
            </View>
          </View>
        </FadeIn>

        {/* Metadata from backend (if any) */}
        {detail.metadata && Object.keys(detail.metadata).length > 0 && (
          <View className="bg-primary/[0.03] rounded-2xl p-4 mb-6">
            <Text className="text-primary text-sm font-bold mb-3">
              <T>Additional Info</T>
            </Text>
            {Object.entries(detail.metadata).map(([key, value]) => (
              <View key={key} className="flex-row justify-between mb-2">
                <Text className="text-gray-400 text-xs capitalize">
                  {key.replace(/_/g, " ")}
                </Text>
                <Text className="text-primary text-xs font-medium">
                  {String(value)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
