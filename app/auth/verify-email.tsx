import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
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
import { useTranslations } from "@/hooks/use-translation";

const CODE_LENGTH = 6;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email, role } = useLocalSearchParams<{
    email: string;
    role?: string;
  }>();
  const { verifyEmail, resendVerification, isLoading } = useAuthStore();

  const [
    tVerificationFailed,
    tInvalidCode,
    tSent,
    tNewCodeSent,
    tError,
    tFailedResend,
    tEmailVerified,
    tRedirecting,
    tVerifyYourEmail,
    tWeSentCode,
    tPasteHint,
    tVerifying,
    tVerifyEmail,
    tDidntReceive,
    tSending,
    tResend,
  ] = useTranslations([
    "Verification Failed",
    "Invalid code",
    "Sent",
    "A new verification code has been sent to your email.",
    "Error",
    "Failed to resend code",
    "Email Verified!",
    "Redirecting you to sign in...",
    "Verify your email",
    "We sent a 6-digit code to",
    "Tip: Long-press any box to paste your code",
    "Verifying...",
    "Verify Email",
    "Didn't receive a code?",
    "Sending...",
    "Resend",
  ]);

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);
  const submittedRef = useRef(false);

  // Auto-submit when all 6 digits are filled (e.g. after paste)
  useEffect(() => {
    const fullCode = code.join("");
    if (
      fullCode.length === CODE_LENGTH &&
      /^\d{6}$/.test(fullCode) &&
      !submittedRef.current &&
      !isLoading &&
      !verified
    ) {
      submittedRef.current = true;
      Keyboard.dismiss();
      handleVerify(fullCode);
    }
  }, [code]);

  const handleChange = (text: string, index: number) => {
    // Filter to digits only
    const digits = text.replace(/\D/g, "");

    if (!digits) {
      const newCode = [...code];
      newCode[index] = "";
      setCode(newCode);
      submittedRef.current = false;
      return;
    }

    const newCode = [...code];

    // Paste: multiple digits
    if (digits.length > 1) {
      // If pasting a full code, always start from box 0
      const startIdx = digits.length >= CODE_LENGTH ? 0 : index;
      digits
        .slice(0, CODE_LENGTH - startIdx)
        .split("")
        .forEach((c, i) => {
          if (startIdx + i < CODE_LENGTH) newCode[startIdx + i] = c;
        });
      setCode(newCode);
      const nextIdx = Math.min(startIdx + digits.length, CODE_LENGTH - 1);
      inputs.current[nextIdx]?.focus();
      return;
    }

    // Single digit
    newCode[index] = digits;
    setCode(newCode);
    if (index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = "";
      setCode(newCode);
      inputs.current[index - 1]?.focus();
      submittedRef.current = false;
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const codeStr = fullCode || code.join("");
    if (codeStr.length < CODE_LENGTH || isLoading || verified) return;
    try {
      await verifyEmail(email, codeStr);
      setVerified(true);
      // Brief success animation, then navigate to login with correct role
      setTimeout(() => {
        router.replace({
          pathname: "/auth/login",
          params: { role: role || "user" },
        } as any);
      }, 1500);
    } catch (err: any) {
      submittedRef.current = false;
      Alert.alert(tVerificationFailed, err.message || tInvalidCode);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await resendVerification(email);
      setCode(Array(CODE_LENGTH).fill(""));
      submittedRef.current = false;
      inputs.current[0]?.focus();
      Alert.alert(tSent, tNewCodeSent);
    } catch (err: any) {
      Alert.alert(tError, err.message || tFailedResend);
    } finally {
      setResending(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (verified) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center px-6">
          <Animated.View
            entering={FadeIn.duration(300)}
            className="w-20 h-20 rounded-full bg-emerald-50 items-center justify-center mb-5"
          >
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
          </Animated.View>
          <Animated.Text
            entering={FadeInDown.delay(100).duration(300)}
            className="text-primary text-2xl font-bold mb-2"
          >
            {tEmailVerified}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(200).duration(300)}
            className="text-gray-400 text-sm text-center"
          >
            {tRedirecting}
          </Animated.Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
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
              {tVerifyYourEmail}
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(220).duration(400)}
              className="text-gray-400 text-sm text-center leading-5"
            >
              {tWeSentCode}
              {"\n"}
              <Text className="text-primary font-semibold">{email}</Text>
            </Animated.Text>
          </View>

          {/* Code inputs — no maxLength so paste distributes across all boxes */}
          <Animated.View
            entering={FadeInDown.delay(280).duration(400)}
            className="flex-row justify-center gap-3 mb-2"
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
                selectTextOnFocus
                autoComplete="one-time-code"
              />
            ))}
          </Animated.View>

          {/* Paste hint */}
          <Animated.Text
            entering={FadeInDown.delay(320).duration(400)}
            className="text-gray-300 text-xs text-center mb-8"
          >
            {tPasteHint}
          </Animated.Text>

          {/* Verify button */}
          <Animated.View entering={FadeInUp.delay(350).duration(400)}>
            <Pressable
              onPress={() => handleVerify()}
              disabled={isLoading || code.join("").length < CODE_LENGTH}
              className={`bg-primary rounded-full py-4 items-center shadow-lg ${
                isLoading || code.join("").length < CODE_LENGTH
                  ? "opacity-60"
                  : "active:opacity-90"
              }`}
            >
              <Text className="text-white text-base font-bold">
                {isLoading ? tVerifying : tVerifyEmail}
              </Text>
            </Pressable>

            {/* Resend */}
            <View className="flex-row justify-center mt-6">
              <Text className="text-gray-400 text-sm">{tDidntReceive} </Text>
              <Pressable onPress={handleResend} disabled={resending}>
                <Text className="text-primary text-sm font-bold">
                  {resending ? tSending : tResend}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
