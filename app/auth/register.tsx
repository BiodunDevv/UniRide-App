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
import Logo from "@/components/Logo";
import AuthInput from "@/components/auth/AuthInput";
import { useAuthStore } from "@/store/useAuthStore";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function RegisterScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { register, isLoading } = useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Full name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 6)
      e.password = "Password must be at least 6 characters";
    if (password !== confirmPassword)
      e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate() || isLoading) return;
    try {
      await register(
        name.trim(),
        email.trim().toLowerCase(),
        password,
        role || "user",
      );
      router.push({
        pathname: "/auth/verify-email",
        params: { email: email.trim().toLowerCase() },
      });
    } catch (err: any) {
      Alert.alert("Registration Failed", err.message || "Something went wrong");
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
              Create account
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(220).duration(400)}
              className="text-gray-400 text-sm"
            >
              {isDriver
                ? "Register as a campus driver"
                : "Join the UniRide community"}
            </Animated.Text>
          </View>

          {/* Form */}
          <Animated.View entering={FadeInDown.delay(280).duration(400)}>
            <AuthInput
              label="Full Name"
              placeholder="John Doe"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              icon="person-outline"
              error={errors.name}
            />
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
              placeholder="Min 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon="lock-closed-outline"
              error={errors.password}
            />
            <AuthInput
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              icon="lock-closed-outline"
              error={errors.confirmPassword}
            />
          </Animated.View>

          {/* Register button */}
          <Animated.View entering={FadeInUp.delay(350).duration(400)}>
            <Pressable
              onPress={handleRegister}
              disabled={isLoading}
              className={`bg-primary rounded-full py-4 items-center shadow-lg mt-2 ${
                isLoading ? "opacity-60" : "active:opacity-90"
              }`}
            >
              <Text className="text-white text-base font-bold">
                {isLoading ? "Creating account..." : "Create Account"}
              </Text>
            </Pressable>

            {/* Login link */}
            <View className="flex-row justify-center mt-6">
              <Text className="text-gray-400 text-sm">
                Already have an account?{" "}
              </Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/auth/login",
                    params: { role: role || "user" },
                  })
                }
              >
                <Text className="text-primary text-sm font-bold">Sign In</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
