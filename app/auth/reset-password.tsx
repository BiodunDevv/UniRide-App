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
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AuthInput from "@/components/auth/AuthInput";
import { useAuthStore } from "@/store/useAuthStore";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { resetPassword, isLoading } = useAuthStore();

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = "Reset code is required";
    if (!newPassword) e.newPassword = "New password is required";
    else if (newPassword.length < 6)
      e.newPassword = "Password must be at least 6 characters";
    if (newPassword !== confirmPassword)
      e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleReset = async () => {
    if (!validate() || isLoading) return;
    try {
      await resetPassword(email || "", code.trim(), newPassword);
      Alert.alert(
        "Password Reset",
        "Your password has been reset. You can now sign in.",
        [{ text: "OK", onPress: () => router.replace("/auth/login") }],
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to reset password");
    }
  };

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
          {/* Back */}
          <Pressable
            onPress={() => router.back()}
            className="mt-2 mb-6 w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color="#042F40" />
          </Pressable>

          {/* Header */}
          <View className="items-center mb-8">
            <Animated.View
              entering={FadeIn.delay(80).duration(400)}
              className="w-16 h-16 rounded-full bg-success/10 items-center justify-center mb-4"
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={28}
                color="#16A34A"
              />
            </Animated.View>
            <Animated.Text
              entering={FadeInDown.delay(150).duration(400)}
              className="text-primary text-2xl font-bold mb-2"
            >
              Reset password
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(220).duration(400)}
              className="text-gray-400 text-sm text-center leading-5 max-w-[280px]"
            >
              Enter the code sent to your email and choose a new password.
            </Animated.Text>
          </View>

          {/* Form */}
          <Animated.View entering={FadeInDown.delay(280).duration(400)}>
            <AuthInput
              label="Reset Code"
              placeholder="6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="numeric"
              icon="keypad-outline"
              error={errors.code}
            />
            <AuthInput
              label="New Password"
              placeholder="Min 6 characters"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              icon="lock-closed-outline"
              error={errors.newPassword}
            />
            <AuthInput
              label="Confirm Password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              icon="lock-closed-outline"
              error={errors.confirmPassword}
            />

            <Pressable
              onPress={handleReset}
              disabled={isLoading}
              className={`bg-primary rounded-full py-4 items-center shadow-lg mt-2 ${
                isLoading ? "opacity-60" : "active:opacity-90"
              }`}
            >
              <Text className="text-white text-base font-bold">
                {isLoading ? "Resetting..." : "Reset Password"}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
