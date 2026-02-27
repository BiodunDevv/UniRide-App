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
import { useTranslations } from "@/hooks/use-translation";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { resetPassword, isLoading } = useAuthStore();

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [
    tResetCodeRequired,
    tNewPasswordRequired,
    tPasswordMinChars,
    tPasswordsNoMatch,
    tPasswordResetTitle,
    tPasswordResetMsg,
    tOK,
    tError,
    tFailedReset,
    tResetPassword,
    tSubtitle,
    tResetCodeLabel,
    tResetCodePlaceholder,
    tNewPasswordLabel,
    tNewPasswordPlaceholder,
    tConfirmPasswordLabel,
    tConfirmPasswordPlaceholder,
    tResetting,
    tResetPasswordBtn,
  ] = useTranslations([
    "Reset code is required",
    "New password is required",
    "Password must be at least 6 characters",
    "Passwords do not match",
    "Password Reset",
    "Your password has been reset. You can now sign in.",
    "OK",
    "Error",
    "Failed to reset password",
    "Reset password",
    "Enter the code sent to your email and choose a new password.",
    "Reset Code",
    "6-digit code",
    "New Password",
    "Min 6 characters",
    "Confirm Password",
    "Re-enter new password",
    "Resetting...",
    "Reset Password",
  ]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = tResetCodeRequired;
    if (!newPassword) e.newPassword = tNewPasswordRequired;
    else if (newPassword.length < 6) e.newPassword = tPasswordMinChars;
    if (newPassword !== confirmPassword) e.confirmPassword = tPasswordsNoMatch;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleReset = async () => {
    if (!validate() || isLoading) return;
    try {
      await resetPassword(email || "", code.trim(), newPassword);
      Alert.alert(tPasswordResetTitle, tPasswordResetMsg, [
        { text: tOK, onPress: () => router.replace("/auth/login") },
      ]);
    } catch (err: any) {
      Alert.alert(tError, err.message || tFailedReset);
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
              {tResetPassword}
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(220).duration(400)}
              className="text-gray-400 text-sm text-center leading-5 max-w-[280px]"
            >
              {tSubtitle}
            </Animated.Text>
          </View>

          {/* Form */}
          <Animated.View entering={FadeInDown.delay(280).duration(400)}>
            <AuthInput
              label={tResetCodeLabel}
              placeholder={tResetCodePlaceholder}
              value={code}
              onChangeText={setCode}
              keyboardType="numeric"
              icon="keypad-outline"
              error={errors.code}
            />
            <AuthInput
              label={tNewPasswordLabel}
              placeholder={tNewPasswordPlaceholder}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              icon="lock-closed-outline"
              error={errors.newPassword}
            />
            <AuthInput
              label={tConfirmPasswordLabel}
              placeholder={tConfirmPasswordPlaceholder}
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
                {isLoading ? tResetting : tResetPasswordBtn}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
