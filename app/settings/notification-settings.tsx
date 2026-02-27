import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { settingsApi } from "@/lib/driverApi";
import { FadeIn } from "@/components/ui/animations";
import { T, useTranslation } from "@/hooks/use-translation";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const prefLabels: Record<string, { label: string; icon: IoniconsName }> = {
  ride_requests: { label: "Ride Requests", icon: "car-outline" },
  ride_accepted: { label: "Ride Accepted", icon: "checkmark-circle-outline" },
  ride_started: { label: "Ride Started", icon: "play-circle-outline" },
  ride_completed: { label: "Ride Completed", icon: "flag-outline" },
  driver_nearby: { label: "Driver Nearby", icon: "navigate-outline" },
  payment_received: { label: "Payment Received", icon: "wallet-outline" },
  promotional_messages: { label: "Promotions", icon: "megaphone-outline" },
  broadcast_messages: { label: "Broadcasts", icon: "radio-outline" },
};

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Alert strings (non-JSX) — individual useTranslation calls
  const tError = useTranslation("Error");
  const tFailedLoadSettings = useTranslation(
    "Failed to load notification settings",
  );
  const tFailedUpdateSetting = useTranslation("Failed to update setting");
  const tFailedUpdatePreference = useTranslation("Failed to update preference");

  // Dynamic category labels (used as string values in map)
  const translatedPrefLabels: Record<string, string> = {
    ride_requests: useTranslation("Ride Requests"),
    ride_accepted: useTranslation("Ride Accepted"),
    ride_started: useTranslation("Ride Started"),
    ride_completed: useTranslation("Ride Completed"),
    driver_nearby: useTranslation("Driver Nearby"),
    payment_received: useTranslation("Payment Received"),
    promotional_messages: useTranslation("Promotions"),
    broadcast_messages: useTranslation("Broadcasts"),
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settingsApi.getNotificationSettings();
      setSettings(res.data);
    } catch {
      Alert.alert(tError, tFailedLoadSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleMaster = async (key: string, value: boolean) => {
    setSaving(true);
    try {
      await settingsApi.updateNotificationSettings({ [key]: value });
      setSettings((s: any) => ({ ...s, [key]: value }));
    } catch {
      Alert.alert(tError, tFailedUpdateSetting);
    } finally {
      setSaving(false);
    }
  };

  const togglePref = async (key: string, value: boolean) => {
    const newPrefs = { ...settings?.notification_preferences, [key]: value };
    setSaving(true);
    try {
      await settingsApi.updateNotificationSettings({
        notification_preferences: newPrefs,
      });
      setSettings((s: any) => ({ ...s, notification_preferences: newPrefs }));
    } catch {
      Alert.alert(tError, tFailedUpdatePreference);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-4">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
        >
          <Ionicons name="close" size={20} color="#042F40" />
        </Pressable>
        <Text className="text-primary text-lg font-bold">
          <T>Notifications</T>
        </Text>
        <View className="w-10" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#042F40" />
        </View>
      ) : settings ? (
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-12"
        >
          {/* Info */}
          <FadeIn delay={0}>
            <View className="mb-5 bg-primary/5 rounded-2xl p-4 flex-row items-center">
              <Ionicons name="information-circle" size={20} color="#042F40" />
              <Text className="text-primary/70 text-xs ml-2 flex-1">
                <T>Control how you receive notifications from UniRide</T>
              </Text>
            </View>
          </FadeIn>

          {/* Master Toggles */}
          <FadeIn delay={100}>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              <T>Channels</T>
            </Text>
            <View className="bg-gray-50 rounded-2xl border border-gray-100 mb-5">
              <View className="flex-row items-center justify-between px-4 py-4">
                <View className="flex-row items-center flex-1">
                  <View className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center mr-3">
                    <Ionicons
                      name="notifications-outline"
                      size={17}
                      color="#042F40"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-primary">
                      <T>Push Notifications</T>
                    </Text>
                    <Text className="text-[11px] text-gray-400 mt-0.5">
                      <T>In-app alerts and badges</T>
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.push_notifications_enabled}
                  onValueChange={(v) =>
                    toggleMaster("push_notifications_enabled", v)
                  }
                  trackColor={{ false: "#E5E7EB", true: "#042F40" }}
                  thumbColor="#FFFFFF"
                  disabled={saving}
                />
              </View>
              <View className="h-px bg-gray-200 mx-4" />
              <View className="flex-row items-center justify-between px-4 py-4">
                <View className="flex-row items-center flex-1">
                  <View className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center mr-3">
                    <Ionicons name="mail-outline" size={17} color="#042F40" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-primary">
                      <T>Email Notifications</T>
                    </Text>
                    <Text className="text-[11px] text-gray-400 mt-0.5">
                      <T>Updates sent to your email</T>
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.email_notifications_enabled}
                  onValueChange={(v) =>
                    toggleMaster("email_notifications_enabled", v)
                  }
                  trackColor={{ false: "#E5E7EB", true: "#042F40" }}
                  thumbColor="#FFFFFF"
                  disabled={saving}
                />
              </View>
            </View>
          </FadeIn>

          {/* Per-preference Toggles */}
          <FadeIn delay={200}>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              <T>Categories</T>
            </Text>
            <View className="bg-gray-50 rounded-2xl border border-gray-100">
              {Object.entries(settings.notification_preferences || {}).map(
                ([key, value], idx, arr) => {
                  const pref = prefLabels[key];
                  if (!pref) return null;
                  return (
                    <View key={key}>
                      <View className="flex-row items-center justify-between px-4 py-4">
                        <View className="flex-row items-center flex-1">
                          <View className="w-9 h-9 rounded-full bg-primary/5 items-center justify-center mr-3">
                            <Ionicons
                              name={pref.icon}
                              size={17}
                              color="#042F40"
                            />
                          </View>
                          <Text className="text-sm font-medium text-primary">
                            {translatedPrefLabels[key] || pref.label}
                          </Text>
                        </View>
                        <Switch
                          value={value as boolean}
                          onValueChange={(v) => togglePref(key, v)}
                          trackColor={{ false: "#E5E7EB", true: "#042F40" }}
                          thumbColor="#FFFFFF"
                          disabled={saving}
                        />
                      </View>
                      {idx < arr.length - 1 && (
                        <View className="h-px bg-gray-200 mx-4" />
                      )}
                    </View>
                  );
                },
              )}
            </View>
          </FadeIn>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}
