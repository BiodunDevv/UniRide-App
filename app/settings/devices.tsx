import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { authApi } from "@/lib/api";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export default function DevicesScreen() {
  const router = useRouter();
  const [devices, setDevices] = useState<any[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  useEffect(() => {
    loadCurrentDeviceId();
    loadDevices();
  }, []);

  const loadCurrentDeviceId = async () => {
    const id = await SecureStore.getItemAsync("device_id");
    setCurrentDeviceId(id);
  };

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authApi.getDevices();
      const all = res.data?.devices || [];
      // Sort: current device first
      const id = await SecureStore.getItemAsync("device_id");
      all.sort((a: any, b: any) => {
        if (a.device_id === id) return -1;
        if (b.device_id === id) return 1;
        return 0;
      });
      setDevices(all);
    } catch {
      Alert.alert("Error", "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRemove = (deviceId: string, deviceName: string) => {
    Alert.alert(
      "Remove Device",
      `Remove "${deviceName}" from your account? They will be logged out.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemoving(deviceId);
            try {
              await authApi.removeDevice(deviceId);
              setDevices((d) => d.filter((dev) => dev.device_id !== deviceId));
            } catch {
              Alert.alert("Error", "Failed to remove device");
            } finally {
              setRemoving(null);
            }
          },
        },
      ],
    );
  };

  const handleLogoutAll = () => {
    Alert.alert(
      "Logout All Devices",
      "This will sign out all other devices. You'll stay signed in on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout All",
          style: "destructive",
          onPress: async () => {
            setLoggingOutAll(true);
            try {
              await authApi.logoutAllDevices();
              Alert.alert("Success", "All other devices have been logged out.");
              loadDevices();
            } catch {
              Alert.alert("Error", "Failed to logout devices");
            } finally {
              setLoggingOutAll(false);
            }
          },
        },
      ],
    );
  };

  const getDeviceIcon = (type: string): IoniconsName => {
    if (type === "mobile") return "phone-portrait-outline";
    if (type === "tablet") return "tablet-portrait-outline";
    return "desktop-outline";
  };

  const formatLastActive = (date: string | undefined) => {
    if (!date) return "Never";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  };

  const isCurrentDevice = (deviceId: string) => deviceId === currentDeviceId;
  const otherDeviceCount = devices.filter(
    (d) => !isCurrentDevice(d.device_id),
  ).length;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(300)}
        className="flex-row items-center justify-between px-6 pt-4 pb-4"
      >
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
        >
          <Ionicons name="close" size={20} color="#042F40" />
        </Pressable>
        <Text className="text-primary text-lg font-bold">Your Devices</Text>
        <View className="w-10" />
      </Animated.View>

      {/* Info Bar */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(350)}
        className="mx-6 mb-4 bg-primary/5 rounded-2xl p-4 flex-row items-center"
      >
        <Ionicons name="shield-checkmark-outline" size={18} color="#042F40" />
        <Text className="text-primary/70 text-xs ml-2 flex-1">
          {devices.length} device{devices.length !== 1 ? "s" : ""} signed in
          {otherDeviceCount > 0 && ` · ${otherDeviceCount} other`}
        </Text>
      </Animated.View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#042F40" />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-24"
        >
          {devices.map((device, idx) => {
            const isCurrent = isCurrentDevice(device.device_id);
            return (
              <Animated.View
                key={device.device_id}
                entering={FadeInDown.delay(150 + idx * 60).duration(350)}
                className={`rounded-2xl p-4 mb-3 ${
                  isCurrent
                    ? "bg-primary/5 border border-primary/10"
                    : "bg-gray-50 border border-gray-100"
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-11 h-11 rounded-xl items-center justify-center mr-3 ${
                      isCurrent ? "bg-primary" : "bg-white"
                    }`}
                  >
                    <Ionicons
                      name={getDeviceIcon(device.device_type)}
                      size={20}
                      color={isCurrent ? "#FFFFFF" : "#042F40"}
                    />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text
                        className="text-sm font-semibold text-primary flex-shrink"
                        numberOfLines={1}
                      >
                        {device.device_name || "Unknown Device"}
                      </Text>
                      {isCurrent && (
                        <View className="bg-primary px-2 py-0.5 rounded-full">
                          <Text className="text-[9px] font-bold text-white uppercase tracking-wider">
                            This device
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {isCurrent
                        ? "Currently active"
                        : `Last active ${formatLastActive(device.last_login)}`}
                    </Text>
                  </View>
                  {!isCurrent &&
                    (removing === device.device_id ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Pressable
                        onPress={() =>
                          handleRemove(
                            device.device_id,
                            device.device_name || "Device",
                          )
                        }
                        className="w-9 h-9 rounded-full bg-red-50 items-center justify-center"
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="#EF4444"
                        />
                      </Pressable>
                    ))}
                </View>
              </Animated.View>
            );
          })}

          {devices.length === 0 && (
            <View className="py-16 items-center">
              <Ionicons
                name="phone-portrait-outline"
                size={48}
                color="#D1D5DB"
              />
              <Text className="text-gray-400 text-sm mt-4 font-medium">
                No devices found
              </Text>
            </View>
          )}

          {/* Logout All Button */}
          {otherDeviceCount > 0 && (
            <Animated.View
              entering={FadeInDown.delay(150 + devices.length * 60).duration(
                350,
              )}
              className="mt-3"
            >
              <Pressable
                onPress={handleLogoutAll}
                disabled={loggingOutAll}
                className="w-full py-3.5 rounded-2xl items-center border-2 border-red-200 bg-red-50 active:bg-red-100"
              >
                {loggingOutAll ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Text className="text-red-500 text-sm font-bold">
                    Logout All Other Devices
                  </Text>
                )}
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
