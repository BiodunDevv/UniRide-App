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
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AuthInput from "@/components/auth/AuthInput";
import { useAuthStore } from "@/store/useAuthStore";
import { T, useTranslation } from "@/hooks/use-translation";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgotPassword, isLoading } = useAuthStore();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const tEmailRequired = useTranslation("Email is required");
  const tEnterValidEmail = useTranslation("Enter a valid email");
  const tError = useTranslation("Error");
  const tSomethingWentWrong = useTranslation("Something went wrong");
  const tEmailLabel = useTranslation("Email");
  const tEmailPlaceholder = useTranslation("your@university.edu");

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError(tEmailRequired);
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(tEnterValidEmail);
      return;
    }
    setError("");
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err: any) {
      Alert.alert(tError, err.message || tSomethingWentWrong);
    }
  };

  if (sent) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
        <View className="flex-1 px-6 justify-center items-center">
          <Animated.View
            entering={FadeIn.duration(400)}
            className="w-16 h-16 rounded-full bg-success/10 items-center justify-center mb-4"
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={32}
              color="#16A34A"
            />
          </Animated.View>
          <Animated.Text
            entering={FadeInDown.delay(120).duration(400)}
            className="text-primary text-2xl font-bold mb-2 text-center"
          >
            <T>Check your email</T>
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(200).duration(400)}
            className="text-gray-400 text-sm text-center leading-5 max-w-[280px] mb-8"
          >
            <T>If an account exists for </T>
            {email}
            <T>, you'll receive a password reset code shortly.</T>
          </Animated.Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/auth/reset-password",
                params: { email: email.trim().toLowerCase() },
              })
            }
            className="bg-primary rounded-full py-4 px-12 items-center shadow-lg active:opacity-90"
          >
            <Text className="text-white text-base font-bold">
              <T>Enter Reset Code</T>
            </Text>
          </Pressable>
          <Pressable onPress={() => router.back()} className="mt-4">
            <Text className="text-gray-400 text-sm">
              <T>Back to login</T>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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
              className="w-16 h-16 rounded-full bg-accent/10 items-center justify-center mb-4"
            >
              <Ionicons name="key-outline" size={28} color="#D4A017" />
            </Animated.View>
            <Animated.Text
              entering={FadeInDown.delay(150).duration(400)}
              className="text-primary text-2xl font-bold mb-2"
            >
              <T>Forgot password?</T>
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(220).duration(400)}
              className="text-gray-400 text-sm text-center leading-5 max-w-[280px]"
            >
              <T>
                Enter your email and we'll send you a code to reset your
                password.
              </T>
            </Animated.Text>
          </View>

          {/* Form */}
          <Animated.View entering={FadeInDown.delay(280).duration(400)}>
            <AuthInput
              label={tEmailLabel}
              placeholder={tEmailPlaceholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              icon="mail-outline"
              error={error}
            />

            <Pressable
              onPress={handleSubmit}
              disabled={isLoading}
              className={`bg-primary rounded-full py-4 items-center shadow-lg mt-2 ${
                isLoading ? "opacity-60" : "active:opacity-90"
              }`}
            >
              <Text className="text-white text-base font-bold">
                {isLoading ? <T>Sending...</T> : <T>Send Reset Code</T>}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
