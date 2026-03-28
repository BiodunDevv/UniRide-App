import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
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
import { useAuthStore } from "@/store/useAuthStore";
import { usePushDebugStore } from "@/store/usePushDebugStore";
import { getExpoPushRegistration } from "@/lib/pushNotifications";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

type NotificationSettingsPayload = {
  push_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  notification_preferences: Record<string, boolean>;
  updatedAt?: string;
  createdAt?: string;
};

type AppAudience = "user" | "driver";
type PreferenceMeta = {
  label: string;
  description: string;
  icon: IoniconsName;
  audiences: AppAudience[];
};

const PREFERENCE_CATALOG: Record<string, PreferenceMeta> = {
  ride_requests: {
    label: "Ride Requests",
    description: "Updates when a ride request needs your attention.",
    icon: "car-outline",
    audiences: ["user"],
  },
  ride_accepted: {
    label: "Ride Accepted",
    description: "Alerts when a driver accepts your booking.",
    icon: "checkmark-circle-outline",
    audiences: ["user"],
  },
  ride_started: {
    label: "Ride Started",
    description: "Lets you know when the trip has officially started.",
    icon: "play-circle-outline",
    audiences: ["user"],
  },
  ride_completed: {
    label: "Ride Completed",
    description: "Confirms the ride has ended successfully.",
    icon: "flag-outline",
    audiences: ["user"],
  },
  ride_cancelled: {
    label: "Ride Cancelled",
    description: "Important changes when a trip is cancelled.",
    icon: "close-circle-outline",
    audiences: ["user"],
  },
  driver_arriving: {
    label: "Driver Arriving",
    description: "Heads-up when your driver is getting close.",
    icon: "navigate-outline",
    audiences: ["user"],
  },
  payment_updates: {
    label: "Payment Updates",
    description: "Status changes for transfers and completed payments.",
    icon: "wallet-outline",
    audiences: ["user", "driver"],
  },
  new_ride_requests: {
    label: "New Ride Requests",
    description: "New demand coming in while you are available.",
    icon: "car-sport-outline",
    audiences: ["driver"],
  },
  booking_confirmations: {
    label: "Booking Confirmations",
    description: "Confirmed passenger bookings on your rides.",
    icon: "checkmark-done-outline",
    audiences: ["driver"],
  },
  rider_messages: {
    label: "Rider Messages",
    description: "Important passenger-side trip communication.",
    icon: "chatbubble-ellipses-outline",
    audiences: ["driver"],
  },
  earnings_updates: {
    label: "Earnings Updates",
    description: "Ride income and payout-related updates.",
    icon: "cash-outline",
    audiences: ["driver"],
  },
  application_updates: {
    label: "Application Updates",
    description: "Changes to your driver application or status.",
    icon: "document-text-outline",
    audiences: ["driver"],
  },
  promotional_messages: {
    label: "Promotions",
    description: "Offers, campaigns, and product announcements.",
    icon: "megaphone-outline",
    audiences: ["user", "driver"],
  },
  broadcast_messages: {
    label: "Broadcasts",
    description: "Platform-wide service notices and campus updates.",
    icon: "radio-outline",
    audiences: ["user", "driver"],
  },
};

type PreferenceKey = keyof typeof PREFERENCE_CATALOG;

function normalizeSettings(
  data?: Partial<NotificationSettingsPayload> | null,
): NotificationSettingsPayload {
  return {
    push_notifications_enabled: data?.push_notifications_enabled ?? true,
    email_notifications_enabled: data?.email_notifications_enabled ?? true,
    notification_preferences: data?.notification_preferences || {},
    updatedAt: data?.updatedAt,
    createdAt: data?.createdAt,
  };
}

async function inspectNativePushState() {
  return getExpoPushRegistration();
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [settings, setSettings] = useState<NotificationSettingsPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const {
    permissionStatus,
    nativePushAvailable,
    backendHealth,
    lastRegistrationAt,
    setBackendHealth,
    setCurrentPushToken,
    setCurrentDeviceId,
    setPermissionStatus,
    setNativePushAvailable,
  } = usePushDebugStore();

  const tError = useTranslation("Error");
  const tFailedLoadSettings = useTranslation(
    "Failed to load notification settings",
  );
  const tFailedUpdateSetting = useTranslation("Failed to update setting");
  const tFailedUpdatePreference = useTranslation("Failed to update preference");
  const tPassenger = useTranslation("Passenger");
  const tDriver = useTranslation("Driver");

  const translatedLabels: Record<string, string> = {
    ride_requests: useTranslation("Ride Requests"),
    ride_accepted: useTranslation("Ride Accepted"),
    ride_started: useTranslation("Ride Started"),
    ride_completed: useTranslation("Ride Completed"),
    ride_cancelled: useTranslation("Ride Cancelled"),
    driver_arriving: useTranslation("Driver Arriving"),
    payment_updates: useTranslation("Payment Updates"),
    new_ride_requests: useTranslation("New Ride Requests"),
    booking_confirmations: useTranslation("Booking Confirmations"),
    rider_messages: useTranslation("Rider Messages"),
    earnings_updates: useTranslation("Earnings Updates"),
    application_updates: useTranslation("Application Updates"),
    promotional_messages: useTranslation("Promotions"),
    broadcast_messages: useTranslation("Broadcasts"),
  };

  const translatedDescriptions: Record<string, string> = {
    ride_requests: useTranslation(
      "Updates when a ride request needs your attention.",
    ),
    ride_accepted: useTranslation(
      "Alerts when a driver accepts your booking.",
    ),
    ride_started: useTranslation(
      "Lets you know when the trip has officially started.",
    ),
    ride_completed: useTranslation(
      "Confirms the ride has ended successfully.",
    ),
    ride_cancelled: useTranslation(
      "Important changes when a trip is cancelled.",
    ),
    driver_arriving: useTranslation(
      "Heads-up when your driver is getting close.",
    ),
    payment_updates: useTranslation(
      "Status changes for transfers and completed payments.",
    ),
    new_ride_requests: useTranslation(
      "New demand coming in while you are available.",
    ),
    booking_confirmations: useTranslation(
      "Confirmed passenger bookings on your rides.",
    ),
    rider_messages: useTranslation(
      "Important passenger-side trip communication.",
    ),
    earnings_updates: useTranslation(
      "Ride income and payout-related updates.",
    ),
    application_updates: useTranslation(
      "Changes to your driver application or status.",
    ),
    promotional_messages: useTranslation(
      "Offers, campaigns, and product announcements.",
    ),
    broadcast_messages: useTranslation(
      "Platform-wide service notices and campus updates.",
    ),
  };

  const role = user?.role === "driver" ? "driver" : "user";

  const visiblePreferences = useMemo(() => {
    const preferences = settings?.notification_preferences || {};
    return Object.entries(preferences)
      .filter(([key]) => {
        const meta = PREFERENCE_CATALOG[key as PreferenceKey];
        return meta && meta.audiences.includes(role);
      })
      .map(([key, value]) => ({
        key,
        value,
        meta: PREFERENCE_CATALOG[key as PreferenceKey],
      }));
  }, [role, settings?.notification_preferences]);

  const enabledCount = useMemo(
    () => visiblePreferences.filter((item) => item.value).length,
    [visiblePreferences],
  );

  const loadSettings = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await settingsApi.getNotificationSettings();
      setSettings(normalizeSettings(res.data));
    } catch (error: any) {
      Alert.alert(tError, error?.message || tFailedLoadSettings);
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, [tError, tFailedLoadSettings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const refreshPushHealth = useCallback(async () => {
    try {
      const nativeState = await inspectNativePushState();
      setNativePushAvailable(nativeState.nativePushAvailable);
      setPermissionStatus(nativeState.permissionStatus);
      setCurrentDeviceId(nativeState.currentDeviceId);
      setCurrentPushToken(nativeState.currentPushToken);

      const res = await settingsApi.getPushHealth({
        push_token: nativeState.currentPushToken,
        device_id: nativeState.currentDeviceId,
      });
      setBackendHealth(res.data || null);
    } catch {
      setBackendHealth(null);
    }
  }, [
    setBackendHealth,
    setCurrentDeviceId,
    setCurrentPushToken,
    setNativePushAvailable,
    setPermissionStatus,
  ]);

  useEffect(() => {
    if (!settings) return;
    refreshPushHealth();
  }, [settings, refreshPushHealth]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSettings(false);
    await refreshPushHealth();
  }, [loadSettings]);

  const savePatch = useCallback(
    async (
      patch: Partial<NotificationSettingsPayload>,
      errorMessage: string,
      trackingKey: string,
    ) => {
      if (!settings) return;

      const previous = settings;
      const nextSettings = normalizeSettings({
        ...settings,
        ...patch,
        notification_preferences: {
          ...settings.notification_preferences,
          ...(patch.notification_preferences || {}),
        },
      });

      setPendingKey(trackingKey);
      setSettings(nextSettings);

      try {
        const res = await settingsApi.updateNotificationSettings(patch);
        setSettings(normalizeSettings(res.data));
        await refreshPushHealth();
      } catch (error: any) {
        setSettings(previous);
        Alert.alert(tError, error?.message || errorMessage);
      } finally {
        setPendingKey(null);
      }
    },
    [settings, tError],
  );

  const pushReady =
    nativePushAvailable &&
    permissionStatus === "granted" &&
    Boolean(backendHealth?.push_notifications_enabled) &&
    Boolean(backendHealth?.current_push_token_registered);

  const toggleMaster = (key: "push_notifications_enabled" | "email_notifications_enabled", value: boolean) => {
    savePatch({ [key]: value }, tFailedUpdateSetting, key);
  };

  const togglePreference = (key: string, value: boolean) => {
    savePatch(
      {
        notification_preferences: {
          [key]: value,
        },
      },
      tFailedUpdatePreference,
      key,
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="px-5 pb-3 pt-3">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-white"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            }}
          >
            <Ionicons name="arrow-back" size={18} color="#042F40" />
          </Pressable>
          <View>
            <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {role === "driver" ? tDriver : tPassenger}
            </Text>
            <Text className="mt-1 text-lg font-bold text-slate-900">
              <T>Notification Settings</T>
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#042F40" />
        </View>
      ) : settings ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-10"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#042F40"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <FadeIn delay={0}>
            <View className="rounded-[28px] bg-[#031E29] px-5 py-5">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4A017]">
                    Delivery Summary
                  </Text>
                  <Text className="mt-2 text-2xl font-bold text-white">
                    {enabledCount} category{enabledCount === 1 ? "" : "ies"} active
                  </Text>
                  <Text className="mt-2 text-sm leading-6 text-slate-300">
                    <T>
                      Control how UniRide reaches you across push alerts, email
                      updates, and operational categories.
                    </T>
                  </Text>
                </View>
                <View className="rounded-2xl bg-white/10 px-3 py-2">
                  <Text className="text-[10px] uppercase tracking-[0.16em] text-slate-300">
                    <T>Audience</T>
                  </Text>
                  <Text className="mt-1 text-sm font-bold text-white">
                    {role === "driver" ? tDriver : tPassenger}
                  </Text>
                </View>
              </View>
              <View className="mt-5 flex-row flex-wrap gap-3">
                <View className="min-w-[47%] flex-1 rounded-2xl bg-white/10 px-4 py-3">
                  <Text className="text-xs text-slate-300">
                    <T>Push</T>
                  </Text>
                  <Text className="mt-1 text-base font-bold text-white">
                    {settings.push_notifications_enabled ? (
                      <T>Enabled</T>
                    ) : (
                      <T>Muted</T>
                    )}
                  </Text>
                </View>
                <View className="min-w-[47%] flex-1 rounded-2xl bg-white/10 px-4 py-3">
                  <Text className="text-xs text-slate-300">
                    <T>Email</T>
                  </Text>
                  <Text className="mt-1 text-base font-bold text-white">
                    {settings.email_notifications_enabled ? (
                      <T>Enabled</T>
                    ) : (
                      <T>Muted</T>
                    )}
                  </Text>
                </View>
              </View>
            </View>
          </FadeIn>

          <FadeIn delay={40}>
            <View className="mt-4 rounded-[28px] border border-slate-200 bg-white px-4 py-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Push Status
                  </Text>
                  <Text className="mt-1 text-lg font-bold text-slate-900">
                    {pushReady
                      ? "Push token saved on this device"
                      : "Push token not saved yet"}
                  </Text>
                  <Text className="mt-1 text-xs leading-5 text-slate-500">
                    {pushReady
                      ? "UniRide can deliver alerts to this signed-in device."
                      : "Open the app from a signed-in session and refresh to save this device for push alerts."}
                  </Text>
                </View>
                <Pressable
                  onPress={refreshPushHealth}
                  className="h-10 w-10 items-center justify-center rounded-2xl bg-slate-100"
                >
                  <Ionicons name="refresh-outline" size={18} color="#042F40" />
                </Pressable>
              </View>

              <View className="mt-4 flex-row flex-wrap gap-3">
                <View className="min-w-[47%] flex-1 rounded-2xl bg-slate-50 px-4 py-3">
                  <Text className="text-xs text-slate-500">Device push</Text>
                  <Text className="mt-1 text-sm font-bold text-slate-900">
                    {backendHealth?.current_push_token_registered
                      ? "Saved"
                      : "Not saved"}
                  </Text>
                </View>
                <View className="min-w-[47%] flex-1 rounded-2xl bg-slate-50 px-4 py-3">
                  <Text className="text-xs text-slate-500">Permission</Text>
                  <Text className="mt-1 text-sm font-bold text-slate-900">
                    {permissionStatus || "Unknown"}
                  </Text>
                </View>
                <View className="min-w-[47%] flex-1 rounded-2xl bg-slate-50 px-4 py-3">
                  <Text className="text-xs text-slate-500">Linked devices</Text>
                  <Text className="mt-1 text-sm font-bold text-slate-900">
                    {backendHealth?.linked_device_count ??
                      backendHealth?.registered_token_count ??
                      0}
                  </Text>
                </View>
                <View className="min-w-[47%] flex-1 rounded-2xl bg-slate-50 px-4 py-3">
                  <Text className="text-xs text-slate-500">Channel</Text>
                  <Text className="mt-1 text-sm font-bold text-slate-900">
                    {nativePushAvailable ? "Ready" : "Unavailable"}
                  </Text>
                </View>
              </View>

              {lastRegistrationAt ? (
                <Text className="mt-3 text-[11px] text-slate-400">
                  Push synced {new Date(lastRegistrationAt).toLocaleTimeString()}
                </Text>
              ) : null}
            </View>
          </FadeIn>

          {!settings.push_notifications_enabled ||
          !settings.email_notifications_enabled ? (
            <FadeIn delay={80}>
              <View className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
                <View className="flex-row items-start">
                  <Ionicons
                    name="warning-outline"
                    size={18}
                    color="#B45309"
                    style={{ marginTop: 2 }}
                  />
                  <Text className="ml-2 flex-1 text-sm leading-6 text-amber-900">
                    <T>
                      One or more delivery channels are off. Category switches
                      stay saved, but muted channels will not send alerts until
                      you turn them back on.
                    </T>
                  </Text>
                </View>
              </View>
            </FadeIn>
          ) : null}

          <FadeIn delay={120}>
            <View className="mt-4 rounded-[28px] border border-slate-200 bg-white">
              <View className="border-b border-slate-100 px-4 py-4">
                <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <T>Channels</T>
                </Text>
              </View>

              {[
                {
                  key: "push_notifications_enabled" as const,
                  title: "Push Notifications",
                  description: "In-app alerts, badges, and device banners.",
                  icon: "notifications-outline" as IoniconsName,
                },
                {
                  key: "email_notifications_enabled" as const,
                  title: "Email Notifications",
                  description: "Messages sent to your account email.",
                  icon: "mail-outline" as IoniconsName,
                },
              ].map((channel, index) => (
                <View
                  key={channel.key}
                  className={`flex-row items-center justify-between px-4 py-4 ${index === 0 ? "border-b border-slate-100" : ""}`}
                >
                  <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-[#042F40]/6">
                    <Ionicons
                      name={channel.icon}
                      size={18}
                      color="#042F40"
                    />
                  </View>
                  <View className="flex-1 pr-4">
                    <Text className="text-sm font-semibold text-slate-900">
                      {channel.title}
                    </Text>
                    <Text className="mt-1 text-xs leading-5 text-slate-500">
                      {channel.description}
                    </Text>
                  </View>
                  {pendingKey === channel.key ? (
                    <ActivityIndicator size="small" color="#042F40" />
                  ) : (
                    <Switch
                      value={settings[channel.key]}
                      onValueChange={(value) => toggleMaster(channel.key, value)}
                      trackColor={{ false: "#E2E8F0", true: "#042F40" }}
                      thumbColor="#FFFFFF"
                    />
                  )}
                </View>
              ))}
            </View>
          </FadeIn>

          <FadeIn delay={180}>
            <View className="mt-4 rounded-[28px] border border-slate-200 bg-white">
              <View className="border-b border-slate-100 px-4 py-4">
                <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <T>Categories</T>
                </Text>
              </View>

              {visiblePreferences.map((item, index) => (
                <View
                  key={item.key}
                  className={`flex-row items-center justify-between px-4 py-4 ${index < visiblePreferences.length - 1 ? "border-b border-slate-100" : ""}`}
                >
                  <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
                    <Ionicons
                      name={item.meta.icon}
                      size={18}
                      color="#042F40"
                    />
                  </View>
                  <View className="flex-1 pr-4">
                    <Text className="text-sm font-semibold text-slate-900">
                      {translatedLabels[item.key] || item.meta.label}
                    </Text>
                    <Text className="mt-1 text-xs leading-5 text-slate-500">
                      {translatedDescriptions[item.key] || item.meta.description}
                    </Text>
                  </View>
                  {pendingKey === item.key ? (
                    <ActivityIndicator size="small" color="#042F40" />
                  ) : (
                    <Switch
                      value={item.value}
                      onValueChange={(value) =>
                        togglePreference(item.key, value)
                      }
                      trackColor={{ false: "#E2E8F0", true: "#042F40" }}
                      thumbColor="#FFFFFF"
                    />
                  )}
                </View>
              ))}
            </View>
          </FadeIn>

          <FadeIn delay={240}>
            <View className="mt-4 rounded-[24px] bg-white px-4 py-4">
              <Text className="text-sm font-semibold text-slate-900">
                <T>How this works</T>
              </Text>
              <Text className="mt-2 text-sm leading-6 text-slate-500">
                <T>
                  Channel switches control where messages are delivered. Category
                  switches control which events UniRide is allowed to send you.
                </T>
              </Text>
            </View>
          </FadeIn>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-slate-500">
            <T>We could not load your notification settings right now.</T>
          </Text>
          <Pressable
            onPress={() => loadSettings()}
            className="mt-4 rounded-2xl bg-[#042F40] px-5 py-3"
          >
            <Text className="font-semibold text-white">
              <T>Try Again</T>
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
