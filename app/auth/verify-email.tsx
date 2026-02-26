import { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
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
import { useAuthStore } from "@/store/useAuthStore";

const CODE_LENGTH = 6;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyEmail, resendVerification, isLoading } = useAuthStore();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [resending, setResending] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleChange = (text: string, index: number) => {
    const newCode = [...code];
    // Handle paste
    if (text.length > 1) {
      const chars = text.slice(0, CODE_LENGTH).split("");
      chars.forEach((c, i) => {
        if (i + index < CODE_LENGTH) newCode[i + index] = c;
      });
      setCode(newCode);
      const nextIndex = Math.min(index + chars.length, CODE_LENGTH - 1);
      inputs.current[nextIndex]?.focus();
      return;
    }
    newCode[index] = text;
    setCode(newCode);
    if (text && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = "";
      setCode(newCode);
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join("");
    if (fullCode.length < CODE_LENGTH || isLoading) return;
    try {
      await verifyEmail(email, fullCode);
      Alert.alert("Success", "Email verified! You can now sign in.", [
        { text: "OK", onPress: () => router.replace("/auth/login") },
      ]);
    } catch (err: any) {
      Alert.alert("Verification Failed", err.message || "Invalid code");
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await resendVerification(email);
      Alert.alert(
        "Sent",
        "A new verification code has been sent to your email.",
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 px-6">
          {/* Back */}
          <Pressable
            onPress={() => router.back()}
            className="mt-2 mb-6 w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color="#042F40" />
          </Pressable>

          {/* Header */}
          <View className="items-center mb-10">
            <Animated.View
              entering={FadeIn.delay(80).duration(400)}
              className="w-16 h-16 rounded-full bg-accent/10 items-center justify-center mb-4"
            >
              <Ionicons name="mail-outline" size={28} color="#D4A017" />
            </Animated.View>
            <Animated.Text
              entering={FadeInDown.delay(150).duration(400)}
              className="text-primary text-2xl font-bold mb-2"
            >
              Verify your email
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(220).duration(400)}
              className="text-gray-400 text-sm text-center leading-5"
            >
              We sent a 6-digit code to{"\n"}
              <Text className="text-primary font-semibold">{email}</Text>
            </Animated.Text>
          </View>

          {/* Code inputs */}
          <Animated.View
            entering={FadeInDown.delay(280).duration(400)}
            className="flex-row justify-center gap-3 mb-8"
          >
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputs.current[index] = ref;
                }}
                className={`w-12 h-14 border-2 rounded-xl text-center text-xl font-bold text-primary ${
                  digit
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 bg-gray-50"
                }`}
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, index)
                }
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </Animated.View>

          {/* Verify button */}
          <Animated.View entering={FadeInUp.delay(350).duration(400)}>
            <Pressable
              onPress={handleVerify}
              disabled={isLoading || code.join("").length < CODE_LENGTH}
              className={`bg-primary rounded-full py-4 items-center shadow-lg ${
                isLoading || code.join("").length < CODE_LENGTH
                  ? "opacity-60"
                  : "active:opacity-90"
              }`}
            >
              <Text className="text-white text-base font-bold">
                {isLoading ? "Verifying..." : "Verify Email"}
              </Text>
            </Pressable>

            {/* Resend */}
            <View className="flex-row justify-center mt-6">
              <Text className="text-gray-400 text-sm">
                Didn't receive a code?{" "}
              </Text>
              <Pressable onPress={handleResend} disabled={resending}>
                <Text className="text-primary text-sm font-bold">
                  {resending ? "Sending..." : "Resend"}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
