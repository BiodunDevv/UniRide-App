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
import { useTranslations } from "@/hooks/use-translation";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function RegisterScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { register, isLoading } = useAuthStore();

  const [
    tFullNameRequired,
    tEmailRequired,
    tValidEmail,
    tPasswordRequired,
    tPasswordMinChars,
    tPasswordsNoMatch,
    tRegFailed,
    tSomethingWrong,
    tDriver,
    tRider,
    tCreateAccountHeading,
    tJoinCommunity,
    tFullName,
    tJohnDoe,
    tEmail,
    tYourEmail,
    tPassword,
    tMinChars,
    tConfirmPassword,
    tReenterPassword,
    tCreatingAccount,
    tCreateAccountBtn,
    tAlreadyHaveAccount,
    tSignIn,
  ] = useTranslations([
    "Full name is required",
    "Email is required",
    "Enter a valid email",
    "Password is required",
    "Password must be at least 6 characters",
    "Passwords do not match",
    "Registration Failed",
    "Something went wrong",
    "Driver",
    "Rider",
    "Create account",
    "Join the UniRide community",
    "Full Name",
    "John Doe",
    "Email",
    "your@university.edu",
    "Password",
    "Min 6 characters",
    "Confirm Password",
    "Re-enter your password",
    "Creating account...",
    "Create Account",
    "Already have an account? ",
    "Sign In",
  ]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = tFullNameRequired;
    if (!email.trim()) e.email = tEmailRequired;
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = tValidEmail;
    if (!password) e.password = tPasswordRequired;
    else if (password.length < 6) e.password = tPasswordMinChars;
    if (password !== confirmPassword) e.confirmPassword = tPasswordsNoMatch;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate() || isLoading) return;
    try {
      await register(name.trim(), email.trim().toLowerCase(), password, "user");
      router.push({
        pathname: "/auth/verify-email",
        params: { email: email.trim().toLowerCase(), role: "user" },
      });
    } catch (err: any) {
      Alert.alert(tRegFailed, err.message || tSomethingWrong);
    }
  };

  const isDriver = false;

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
                {isDriver ? tDriver : tRider}
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
              {tCreateAccountHeading}
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(220).duration(400)}
              className="text-gray-400 text-sm"
            >
              {tJoinCommunity}
            </Animated.Text>
          </View>

          {/* Form */}
          <Animated.View entering={FadeInDown.delay(280).duration(400)}>
            <AuthInput
              label={tFullName}
              placeholder={tJohnDoe}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              icon="person-outline"
              error={errors.name}
            />
            <AuthInput
              label={tEmail}
              placeholder={tYourEmail}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              icon="mail-outline"
              error={errors.email}
            />
            <AuthInput
              label={tPassword}
              placeholder={tMinChars}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon="lock-closed-outline"
              error={errors.password}
            />
            <AuthInput
              label={tConfirmPassword}
              placeholder={tReenterPassword}
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
                {isLoading ? tCreatingAccount : tCreateAccountBtn}
              </Text>
            </Pressable>

            {/* Login link */}
            <View className="flex-row justify-center mt-6">
              <Text className="text-gray-400 text-sm">
                {tAlreadyHaveAccount}
              </Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/auth/login",
                    params: { role: role || "user" },
                  })
                }
              >
                <Text className="text-primary text-sm font-bold">
                  {tSignIn}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
