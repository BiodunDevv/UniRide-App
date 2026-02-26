import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useAuthStore } from "@/store/useAuthStore";
import { FadeIn } from "@/components/ui/animations";

export default function BiometricScreen() {
  const router = useRouter();
  const { user, enableBiometric, disableBiometric, fetchMe } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [toggling, setToggling] = useState(false);

  const isEnabled = user?.biometric_enabled || false;
  const isIOS = Platform.OS === "ios";
  const biometricName = isIOS ? "Face ID" : "Fingerprint";
  const biometricIcon: React.ComponentProps<typeof Ionicons>["name"] = isIOS
    ? "scan-outline"
    : "finger-print";

  useEffect(() => {
    checkCapability();
  }, []);

  const checkCapability = async () => {
    setChecking(true);
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setAvailable(compatible);
      setEnrolled(isEnrolled);
    } catch {
      setAvailable(false);
    } finally {
      setChecking(false);
    }
  };

  const handleEnable = async () => {
    setToggling(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate to enable ${biometricName}`,
        fallbackLabel: "Use passcode",
        disableDeviceFallback: false,
      });

      if (result.success) {
        await enableBiometric();
        await fetchMe();
        Alert.alert("Enabled", `${biometricName} login has been enabled.`);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || `Failed to enable ${biometricName}`);
    } finally {
      setToggling(false);
    }
  };

  const handleDisable = async () => {
    Alert.alert(
      `Disable ${biometricName}`,
      `Are you sure you want to disable ${biometricName} login? You'll need to enter your password to sign in.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disable",
          style: "destructive",
          onPress: async () => {
            setToggling(true);
            try {
              await disableBiometric();
              await fetchMe();
              Alert.alert(
                "Disabled",
                `${biometricName} login has been disabled.`,
              );
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.message || `Failed to disable ${biometricName}`,
              );
            } finally {
              setToggling(false);
            }
          },
        },
      ],
    );
  };

  if (checking) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#042F40" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-6">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
        >
          <Ionicons name="close" size={20} color="#042F40" />
        </Pressable>
        <Text className="text-primary text-lg font-bold">{biometricName}</Text>
        <View className="w-10" />
      </View>

      <View className="flex-1 px-6">
        {/* Illustration */}
        <FadeIn delay={0}>
          <View className="items-center mt-8 mb-10">
            <View
              className={`w-32 h-32 rounded-full items-center justify-center mb-6 ${
                isEnabled ? "bg-green-50" : "bg-primary/5"
              }`}
            >
              <Ionicons
                name={biometricIcon}
                size={64}
                color={isEnabled ? "#16A34A" : "#042F40"}
              />
            </View>
            <Text className="text-primary text-xl font-bold mb-2">
              {isEnabled
                ? `${biometricName} Enabled`
                : `Enable ${biometricName}`}
            </Text>
            <Text className="text-gray-400 text-sm text-center px-8 leading-5">
              {isEnabled
                ? `You can sign in to UniRide using ${biometricName}. This is faster and more secure than entering your password.`
                : `Sign in quickly and securely with ${biometricName}. No need to type your password every time.`}
            </Text>
          </View>
        </FadeIn>

        {/* Status Card */}
        <FadeIn delay={100}>
          <View
            className={`rounded-2xl p-4 mb-6 ${
              isEnabled
                ? "bg-green-50 border border-green-200"
                : "bg-gray-50 border border-gray-100"
            }`}
          >
            <View className="flex-row items-center">
              <View
                className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                  isEnabled ? "bg-green-100" : "bg-gray-200"
                }`}
              >
                <Ionicons
                  name={isEnabled ? "checkmark-circle" : "close-circle-outline"}
                  size={20}
                  color={isEnabled ? "#16A34A" : "#9CA3AF"}
                />
              </View>
              <View className="flex-1">
                <Text
                  className={`text-sm font-bold ${isEnabled ? "text-green-700" : "text-gray-500"}`}
                >
                  {isEnabled ? "Active" : "Inactive"}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {isEnabled
                    ? `${biometricName} is being used for sign-in`
                    : `${biometricName} is not enabled`}
                </Text>
              </View>
            </View>
          </View>
        </FadeIn>

        {/* Hardware Info */}
        {!available && (
          <View className="bg-amber-50 rounded-2xl p-4 mb-6 border border-amber-200">
            <View className="flex-row items-center">
              <Ionicons name="warning-outline" size={20} color="#D97706" />
              <Text className="text-amber-700 text-sm font-medium ml-2 flex-1">
                {biometricName} hardware not available on this device.
              </Text>
            </View>
          </View>
        )}

        {available && !enrolled && (
          <View className="bg-amber-50 rounded-2xl p-4 mb-6 border border-amber-200">
            <View className="flex-row items-center">
              <Ionicons name="warning-outline" size={20} color="#D97706" />
              <Text className="text-amber-700 text-sm font-medium ml-2 flex-1">
                No {biometricName} is enrolled. Set up {biometricName} in your
                device settings first.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Button */}
      <View className="px-6 pb-6">
        {isEnabled ? (
          <Pressable
            onPress={handleDisable}
            disabled={toggling}
            className="w-full py-4 rounded-2xl items-center border-2 border-red-200 bg-red-50 active:bg-red-100"
          >
            {toggling ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Text className="text-red-500 text-base font-bold">
                Disable {biometricName}
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={handleEnable}
            disabled={toggling || !available || !enrolled}
            className={`w-full py-4 rounded-2xl items-center ${
              !available || !enrolled ? "bg-gray-200" : "bg-primary"
            }`}
          >
            {toggling ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                className={`text-base font-bold ${
                  !available || !enrolled ? "text-gray-400" : "text-white"
                }`}
              >
                Enable {biometricName}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
