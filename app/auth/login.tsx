import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import Logo from "@/components/Logo";
import AuthInput from "@/components/auth/AuthInput";
import { useAuthStore } from "@/store/useAuthStore";

const LOGIN_COUNT_KEY = "@uniride_login_count";
const BIOMETRIC_PROMPTED_KEY = "@uniride_biometric_prompted";

export default function LoginScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { login, enableBiometric, isLoading } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 6)
      e.password = "Password must be at least 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate() || isLoading) return;
    try {
      const res = await login(
        email.trim().toLowerCase(),
        password,
        role || "user",
      );
      // Navigate to role-based tab group
      const userRole = res.data?.user?.role;
      const destination = userRole === "driver" ? "/(drivers)" : "/(users)";

      // Track login count for biometric prompt timing
      const countStr = await AsyncStorage.getItem(LOGIN_COUNT_KEY);
      const count = (parseInt(countStr || "0", 10) || 0) + 1;
      await AsyncStorage.setItem(LOGIN_COUNT_KEY, String(count));

      // Only offer biometric after 5 logins and if not already prompted
      if (!res.data?.user?.biometric_enabled && count >= 5) {
        const alreadyPrompted = await AsyncStorage.getItem(
          BIOMETRIC_PROMPTED_KEY,
        );
        if (alreadyPrompted !== "true") {
          const compatible = await LocalAuthentication.hasHardwareAsync();
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          if (compatible && enrolled) {
            const biometricLabel =
              Platform.OS === "ios" ? "Face ID" : "Fingerprint";
            await AsyncStorage.setItem(BIOMETRIC_PROMPTED_KEY, "true");
            Alert.alert(
              `Enable ${biometricLabel}?`,
              `Sign in faster next time using ${biometricLabel}.`,
              [
                {
                  text: "Not Now",
                  style: "cancel",
                  onPress: () => router.replace(destination as any),
                },
                {
                  text: "Enable",
                  onPress: async () => {
                    try {
                      const authResult =
                        await LocalAuthentication.authenticateAsync({
                          promptMessage: `Authenticate to enable ${biometricLabel}`,
                        });
                      if (authResult.success) {
                        await enableBiometric();
                      }
                    } catch {
                      // Ignore biometric setup errors
                    }
                    router.replace(destination as any);
                  },
                },
              ],
            );
            return;
          }
        }
      }
      router.replace(destination as any);
    } catch (err: any) {
      if (err.data?.email_verification_required) {
        router.push({
          pathname: "/auth/verify-email",
          params: { email: email.trim().toLowerCase() },
        });
      } else if (err.data?.platform_restricted) {
        Alert.alert(
          "Access Denied",
          "This account cannot sign in on the mobile app. Please use the web portal.",
        );
      } else if (err.data?.is_flagged) {
        Alert.alert(
          "Account Suspended",
          "Your account has been flagged. Please contact support for assistance.",
        );
      } else if (err.data?.role_mismatch) {
        const expected =
          err.data.expected_role === "driver" ? "Driver" : "Rider";
        Alert.alert(
          "Wrong Account Type",
          err.message ||
            `This account is a ${expected} account. Please select the correct role.`,
        );
      } else {
        Alert.alert("Login Failed", err.message || "Something went wrong");
      }
    }
  };

  const isDriver = role === "driver";

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top row: Back + Role badge */}
          <Animated.View
            entering={FadeIn.duration(350)}
            className="flex-row items-center justify-between mt-2 mb-6"
          >
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
            >
              <Ionicons name="arrow-back" size={20} color="#042F40" />
            </Pressable>

            <View
              className={`flex-row items-center px-3 py-1.5 rounded-full ${
                isDriver
                  ? "bg-amber-50 border border-amber-200"
                  : "bg-primary/5 border border-primary/10"
              }`}
            >
              <Ionicons
                name={isDriver ? "car-sport" : "person"}
                size={14}
                color={isDriver ? "#D4A017" : "#042F40"}
              />
              <Text
                className={`text-xs font-semibold ml-1.5 ${
                  isDriver ? "text-amber-700" : "text-primary"
                }`}
              >
                {isDriver ? "Driver" : "Rider"}
              </Text>
            </View>
          </Animated.View>

          {/* Header */}
          <View className="items-center mb-8">
            <Animated.View
              entering={FadeIn.delay(80).duration(400)}
              className="w-14 h-14 rounded-full bg-primary/5 items-center justify-center mb-4"
            >
              <Logo width={28} height={17} color="#042F40" />
            </Animated.View>
            <Animated.Text
              entering={FadeInDown.delay(150).duration(400)}
              className="text-primary text-2xl font-bold mb-1"
            >
              Welcome back
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(220).duration(400)}
              className="text-gray-400 text-sm"
            >
              Sign in to your{isDriver ? " driver" : ""} account
            </Animated.Text>
          </View>

          {/* Form */}
          <Animated.View entering={FadeInDown.delay(280).duration(400)}>
            <AuthInput
              label="Email"
              placeholder="your@university.edu"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              icon="mail-outline"
              error={errors.email}
            />
            <AuthInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon="lock-closed-outline"
              error={errors.password}
            />
          </Animated.View>

          {/* Forgot password */}
          <Pressable
            onPress={() => router.push("/auth/forgot-password")}
            className="self-end mb-6"
          >
            <Text className="text-primary text-sm font-semibold">
              Forgot password?
            </Text>
          </Pressable>

          {/* Login button */}
          <Animated.View entering={FadeInUp.delay(350).duration(400)}>
            <Pressable
              onPress={handleLogin}
              disabled={isLoading}
              className={`bg-primary rounded-full py-4 items-center shadow-lg ${
                isLoading ? "opacity-60" : "active:opacity-90"
              }`}
            >
              <Text className="text-white text-base font-bold">
                {isLoading ? "Signing in..." : "Sign In"}
              </Text>
            </Pressable>

            {/* Register link */}
            <View className="flex-row justify-center mt-6">
              <Text className="text-gray-400 text-sm">
                Don't have an account?{" "}
              </Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/auth/register",
                    params: { role: role || "user" },
                  })
                }
              >
                <Text className="text-primary text-sm font-bold">Sign Up</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
