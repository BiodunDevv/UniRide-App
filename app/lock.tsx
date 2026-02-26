import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import Logo from "@/components/Logo";
import { useAuthStore } from "@/store/useAuthStore";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ── PIN Dot Indicator ─────────────────────────────────────── */
function PinDots({ length, filled }: { length: number; filled: number }) {
  return (
    <View className="flex-row items-center justify-center gap-4 my-6">
      {Array.from({ length }).map((_, i) => {
        const isActive = i < filled;
        const isCurrent = i === filled;
        return (
          <Animated.View key={i} entering={FadeIn.delay(i * 50).duration(300)}>
            <View
              className={`w-[52px] h-[52px] rounded-2xl items-center justify-center border-2 ${
                isActive
                  ? "bg-primary border-primary"
                  : isCurrent
                    ? "bg-white border-primary"
                    : "bg-gray-50 border-gray-200"
              }`}
            >
              {isActive ? (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  className="w-3 h-3 rounded-full bg-white"
                />
              ) : null}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

/* ── Code Dot Indicator (6-digit) ──────────────────────────── */
function CodeDots({ length, value }: { length: number; value: string }) {
  return (
    <View className="flex-row items-center justify-center gap-2.5 my-5">
      {Array.from({ length }).map((_, i) => (
        <Animated.View
          key={i}
          entering={FadeInDown.delay(i * 40).duration(300)}
        >
          <View
            className={`w-11 h-12 rounded-xl items-center justify-center border-2 ${
              i < value.length
                ? "bg-primary/5 border-primary"
                : i === value.length
                  ? "bg-white border-primary"
                  : "bg-gray-50 border-gray-200"
            }`}
          >
            <Text
              className={`text-lg font-bold ${
                i < value.length ? "text-primary" : "text-transparent"
              }`}
            >
              {value[i] || "0"}
            </Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

export default function CurrentUserScreen() {
  const router = useRouter();
  const { user, biometricLogin, pinLogin, forgotPin, resetPin, logout } =
    useAuthStore();
  const [authenticating, setAuthenticating] = useState(false);

  // PIN state
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const pinRef = useRef<TextInput>(null);

  // PIN reset state
  const [showPinReset, setShowPinReset] = useState(false);
  const [resetStep, setResetStep] = useState<"code" | "newpin">("code");
  const [resetCode, setResetCode] = useState("");
  const [newResetPin, setNewResetPin] = useState("");
  const [confirmResetPin, setConfirmResetPin] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const codeRef = useRef<TextInput>(null);
  const newPinRef = useRef<TextInput>(null);

  const isIOS = Platform.OS === "ios";
  const biometricLabel = isIOS ? "Face ID" : "Fingerprint";
  const biometricIcon: IoniconsName = isIOS ? "scan-outline" : "finger-print";
  const hasBiometric = user?.biometric_enabled || false;
  const hasPin = user?.pin_enabled || false;
  const hasSecureLogin = hasBiometric || hasPin;

  // Animated values for entrance
  const cardProgress = useSharedValue(0);

  useEffect(() => {
    const u = useAuthStore.getState().user;
    const t = useAuthStore.getState().token;
    if (!t || !u) {
      router.replace("/auth/role-select");
      return;
    }
    // Kick off entrance animation
    cardProgress.value = withDelay(
      200,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    // Auto-trigger biometric
    if (u.biometric_enabled) handleBiometric();
  }, []);

  const avatarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cardProgress.value, [0, 0.5, 1], [0, 0.5, 1]),
    transform: [
      { scale: interpolate(cardProgress.value, [0, 1], [0.6, 1]) },
      {
        translateY: interpolate(cardProgress.value, [0, 1], [20, 0]),
      },
    ],
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cardProgress.value, [0, 0.4, 1], [0, 0, 1]),
    transform: [
      {
        translateY: interpolate(cardProgress.value, [0.4, 1], [12, 0]),
      },
    ],
  }));

  const cardsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cardProgress.value, [0, 0.6, 1], [0, 0, 1]),
    transform: [
      {
        translateY: interpolate(cardProgress.value, [0.6, 1], [30, 0]),
      },
    ],
  }));

  // ── Handlers ──────────────────────────────────────────────────────────

  const navigateHome = () => {
    const u = useAuthStore.getState().user;
    router.replace(u?.role === "driver" ? "/(drivers)" : "/(users)");
  };

  const handleBiometric = async () => {
    setAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: isIOS
          ? "Sign in with Face ID"
          : "Sign in with Fingerprint",
        fallbackLabel: "Use passcode",
        disableDeviceFallback: false,
      });
      if (result.success) {
        await biometricLogin();
        navigateHome();
      }
    } catch (err: any) {
      Alert.alert(
        "Authentication Failed",
        err.message || "Biometric login failed.",
      );
    } finally {
      setAuthenticating(false);
    }
  };

  const handlePinLogin = async () => {
    if (!/^\d{4}$/.test(pinValue)) return;
    setPinLoading(true);
    try {
      await pinLogin(pinValue);
      navigateHome();
    } catch (err: any) {
      Alert.alert("Failed", err.message || "Invalid PIN.");
      setPinValue("");
      pinRef.current?.focus();
    } finally {
      setPinLoading(false);
    }
  };

  const handlePinLoginDirect = async (pin: string) => {
    setPinLoading(true);
    try {
      await pinLogin(pin);
      navigateHome();
    } catch (err: any) {
      Alert.alert("Failed", err.message || "Invalid PIN.");
      setPinValue("");
      pinRef.current?.focus();
    } finally {
      setPinLoading(false);
    }
  };

  const handleForgotPin = async () => {
    setResetLoading(true);
    try {
      await forgotPin();
      setShowPinReset(true);
      setShowPinInput(false);
      setResetStep("code");
      setResetCode("");
      Alert.alert(
        "Code Sent",
        "A 6-digit reset code has been sent to your email.",
      );
      setTimeout(() => codeRef.current?.focus(), 400);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send reset code.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (resetCode.length !== 6) {
      Alert.alert("Invalid Code", "Enter the 6-digit code from your email.");
      return;
    }
    if (!/^\d{4}$/.test(newResetPin)) {
      Alert.alert("Invalid PIN", "New PIN must be exactly 4 digits.");
      return;
    }
    if (newResetPin !== confirmResetPin) {
      Alert.alert("Mismatch", "PINs don't match. Try again.");
      setConfirmResetPin("");
      return;
    }
    setResetLoading(true);
    try {
      await resetPin(resetCode, newResetPin);
      Alert.alert("Success", "PIN reset! Sign in with your new PIN.");
      cancelReset();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to reset PIN.");
    } finally {
      setResetLoading(false);
    }
  };

  const cancelReset = () => {
    setShowPinReset(false);
    setResetStep("code");
    setResetCode("");
    setNewResetPin("");
    setConfirmResetPin("");
  };

  if (!user) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator size="large" color="#F0F1F3" />
      </View>
    );
  }

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";
  const firstName = user?.name?.split(" ")[0] || "User";

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View className="flex-1 bg-white">
        <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            <View className="flex-1">
              {/* ── Top Bar: Logo left · Role right ────────────── */}
              <Animated.View
                entering={FadeIn.duration(350)}
                className="flex-row items-center justify-between px-6 pt-3 pb-2"
              >
                <View className="flex-row items-center gap-2.5">
                  <View className="w-9 h-9 rounded-xl bg-primary items-center justify-center">
                    <Logo width={18} height={11} color="#FFFFFF" />
                  </View>
                  <Text className="text-primary text-base font-bold tracking-tight">
                    UniRide
                  </Text>
                </View>
                <View
                  className={`px-3 py-1 rounded-full ${
                    user?.role === "driver" ? "bg-[#D4A017]/10" : "bg-primary/5"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold capitalize ${
                      user?.role === "driver"
                        ? "text-[#D4A017]"
                        : "text-primary"
                    }`}
                  >
                    {user?.role === "driver" ? "Driver" : "Rider"}
                  </Text>
                </View>
              </Animated.View>

              <ScrollView
                className="flex-1"
                contentContainerStyle={{ flexGrow: 1 }}
                bounces={false}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* ── User Identity Section ─────────────────────── */}
                <View className="items-center pt-6 pb-4 px-8">
                  <Animated.View
                    style={avatarStyle}
                    className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-4 shadow-lg"
                  >
                    <Text className="text-white text-2xl font-bold">
                      {initials}
                    </Text>
                  </Animated.View>
                  <Animated.View style={nameStyle} className="items-center">
                    <Text className="text-gray-400 text-xs font-medium tracking-wide uppercase">
                      Welcome back
                    </Text>
                    <Text className="text-primary text-xl font-bold mt-1">
                      {firstName}
                    </Text>
                    <Text className="text-gray-300 text-xs mt-0.5">
                      {user?.email}
                    </Text>
                  </Animated.View>
                </View>

                {/* ── Auth Content ──────────────────────────────── */}
                <Animated.View style={cardsStyle} className="flex-1 px-6">
                  {showPinReset ? (
                    /* ── PIN Reset Flow ───────────────────────────── */
                    <Animated.View
                      entering={FadeInDown.duration(350)}
                      className="flex-1"
                    >
                      <View className="items-center mb-2 mt-2">
                        <View className="w-14 h-14 rounded-2xl bg-primary/5 items-center justify-center mb-3">
                          <Ionicons
                            name="key-outline"
                            size={26}
                            color="#042F40"
                          />
                        </View>
                        <Text className="text-primary text-lg font-bold">
                          Reset Your PIN
                        </Text>
                        <Text className="text-gray-400 text-xs mt-1 text-center px-4">
                          {resetStep === "code"
                            ? "Enter the 6-digit code sent to your email"
                            : "Choose a new 4-digit PIN"}
                        </Text>
                      </View>

                      {resetStep === "code" ? (
                        <Animated.View
                          entering={FadeInDown.delay(100).duration(350)}
                        >
                          <CodeDots length={6} value={resetCode} />
                          <TextInput
                            ref={codeRef}
                            value={resetCode}
                            onChangeText={(t) => {
                              const v = t.replace(/\D/g, "").slice(0, 6);
                              setResetCode(v);
                              if (v.length === 6) {
                                Keyboard.dismiss();
                                setResetStep("newpin");
                                setTimeout(
                                  () => newPinRef.current?.focus(),
                                  300,
                                );
                              }
                            }}
                            keyboardType="number-pad"
                            maxLength={6}
                            autoFocus
                            style={{
                              position: "absolute",
                              opacity: 0,
                              height: 0,
                            }}
                          />
                          <Pressable
                            onPress={() => codeRef.current?.focus()}
                            className="bg-gray-50 rounded-2xl py-4 items-center mb-3 border border-gray-100 active:bg-gray-100"
                          >
                            <Text className="text-primary text-sm font-semibold">
                              Tap to enter code
                            </Text>
                          </Pressable>
                        </Animated.View>
                      ) : (
                        <Animated.View
                          entering={FadeInDown.delay(100).duration(350)}
                        >
                          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1 mt-2">
                            New PIN
                          </Text>
                          <PinDots length={4} filled={newResetPin.length} />
                          <TextInput
                            ref={newPinRef}
                            value={newResetPin}
                            onChangeText={(t) =>
                              setNewResetPin(t.replace(/\D/g, "").slice(0, 4))
                            }
                            keyboardType="number-pad"
                            maxLength={4}
                            autoFocus
                            style={{
                              position: "absolute",
                              opacity: 0,
                              height: 0,
                            }}
                          />

                          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
                            Confirm PIN
                          </Text>
                          <PinDots length={4} filled={confirmResetPin.length} />
                          <TextInput
                            value={confirmResetPin}
                            onChangeText={(t) =>
                              setConfirmResetPin(
                                t.replace(/\D/g, "").slice(0, 4),
                              )
                            }
                            keyboardType="number-pad"
                            maxLength={4}
                            style={{
                              position: "absolute",
                              opacity: 0,
                              height: 0,
                            }}
                          />

                          <Pressable
                            onPress={handleResetPin}
                            disabled={
                              resetLoading ||
                              newResetPin.length < 4 ||
                              confirmResetPin.length < 4
                            }
                            className={`rounded-full py-4 items-center mt-2 mb-3 active:opacity-90 ${
                              newResetPin.length === 4 &&
                              confirmResetPin.length === 4
                                ? "bg-primary"
                                : "bg-gray-200"
                            }`}
                          >
                            {resetLoading ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text
                                className={`text-base font-bold ${
                                  newResetPin.length === 4 &&
                                  confirmResetPin.length === 4
                                    ? "text-white"
                                    : "text-gray-400"
                                }`}
                              >
                                Reset PIN
                              </Text>
                            )}
                          </Pressable>
                        </Animated.View>
                      )}

                      <Pressable
                        onPress={cancelReset}
                        className="py-3 items-center"
                      >
                        <Text className="text-gray-400 text-sm font-medium">
                          Cancel
                        </Text>
                      </Pressable>
                    </Animated.View>
                  ) : showPinInput ? (
                    /* ── PIN Entry ────────────────────────────────── */
                    <Animated.View
                      entering={FadeInDown.duration(350)}
                      className="flex-1"
                    >
                      <View className="items-center mt-2 mb-1">
                        <Animated.View
                          entering={FadeIn.delay(80).duration(350)}
                          className="w-14 h-14 rounded-2xl bg-primary/5 items-center justify-center mb-3"
                        >
                          <Ionicons
                            name="keypad-outline"
                            size={26}
                            color="#042F40"
                          />
                        </Animated.View>
                        <Text className="text-primary text-lg font-bold">
                          Enter PIN
                        </Text>
                        <Text className="text-gray-400 text-xs mt-1">
                          Type your 4-digit PIN to sign in
                        </Text>
                      </View>

                      <PinDots length={4} filled={pinValue.length} />

                      {/* Hidden input */}
                      <TextInput
                        ref={pinRef}
                        value={pinValue}
                        onChangeText={(t) => {
                          const v = t.replace(/\D/g, "").slice(0, 4);
                          setPinValue(v);
                          if (v.length === 4) {
                            Keyboard.dismiss();
                            setTimeout(() => {
                              handlePinLoginDirect(v);
                            }, 200);
                          }
                        }}
                        keyboardType="number-pad"
                        maxLength={4}
                        autoFocus
                        style={{
                          position: "absolute",
                          opacity: 0,
                          height: 0,
                        }}
                      />

                      {/* Tap to focus */}
                      <Pressable
                        onPress={() => pinRef.current?.focus()}
                        className="bg-gray-50 rounded-2xl py-4 items-center mb-3 border border-gray-100 active:bg-gray-100"
                      >
                        <Text className="text-primary text-sm font-semibold">
                          {pinValue.length > 0
                            ? `${pinValue.length} of 4 digits entered`
                            : "Tap to enter PIN"}
                        </Text>
                      </Pressable>

                      {pinLoading && (
                        <Animated.View
                          entering={FadeIn.duration(200)}
                          className="items-center py-3"
                        >
                          <ActivityIndicator size="small" color="#042F40" />
                          <Text className="text-gray-400 text-xs mt-2">
                            Verifying...
                          </Text>
                        </Animated.View>
                      )}

                      <View className="flex-row items-center justify-center gap-8 mt-2">
                        <Pressable
                          onPress={() => {
                            setShowPinInput(false);
                            setPinValue("");
                          }}
                          className="py-2"
                        >
                          <Text className="text-gray-400 text-xs font-semibold">
                            Cancel
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={handleForgotPin}
                          disabled={resetLoading}
                          className="py-2"
                        >
                          <Text className="text-primary text-xs font-semibold">
                            {resetLoading ? "Sending..." : "Forgot PIN?"}
                          </Text>
                        </Pressable>
                      </View>
                    </Animated.View>
                  ) : (
                    /* ── Main Actions ─────────────────────────────── */
                    <View className="flex-1 pt-4">
                      {/* Biometric Card */}
                      {hasBiometric && (
                        <AnimatedPressable
                          entering={FadeInDown.delay(80).duration(400)}
                          onPress={handleBiometric}
                          disabled={authenticating}
                          className="bg-primary rounded-2xl p-5 mb-3 active:opacity-90 shadow-sm"
                        >
                          <View className="flex-row items-center">
                            <View className="w-12 h-12 rounded-xl bg-white/10 items-center justify-center mr-4">
                              <Ionicons
                                name={biometricIcon}
                                size={26}
                                color="#FFFFFF"
                              />
                            </View>
                            <View className="flex-1">
                              <Text className="text-white text-base font-bold">
                                {biometricLabel}
                              </Text>
                              <Text className="text-white/50 text-xs mt-0.5">
                                Quick & secure sign-in
                              </Text>
                            </View>
                            {authenticating ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Ionicons
                                name="chevron-forward"
                                size={20}
                                color="rgba(255,255,255,0.5)"
                              />
                            )}
                          </View>
                        </AnimatedPressable>
                      )}

                      {/* PIN Card */}
                      {hasPin && (
                        <AnimatedPressable
                          entering={FadeInDown.delay(
                            hasBiometric ? 160 : 80,
                          ).duration(400)}
                          onPress={() => {
                            setShowPinInput(true);
                            setTimeout(() => pinRef.current?.focus(), 300);
                          }}
                          className={`rounded-2xl p-5 mb-3 active:opacity-90 border-2 ${
                            hasBiometric
                              ? "bg-white border-gray-100"
                              : "bg-primary border-primary shadow-sm"
                          }`}
                        >
                          <View className="flex-row items-center">
                            <View
                              className={`w-12 h-12 rounded-xl items-center justify-center mr-4 ${
                                hasBiometric ? "bg-primary/5" : "bg-white/10"
                              }`}
                            >
                              <Ionicons
                                name="keypad-outline"
                                size={22}
                                color={hasBiometric ? "#042F40" : "#FFFFFF"}
                              />
                            </View>
                            <View className="flex-1">
                              <Text
                                className={`text-base font-bold ${
                                  hasBiometric ? "text-primary" : "text-white"
                                }`}
                              >
                                PIN Code
                              </Text>
                              <Text
                                className={`text-xs mt-0.5 ${
                                  hasBiometric
                                    ? "text-gray-400"
                                    : "text-white/50"
                                }`}
                              >
                                Enter 4-digit PIN
                              </Text>
                            </View>
                            <Ionicons
                              name="chevron-forward"
                              size={20}
                              color={
                                hasBiometric
                                  ? "#D1D5DB"
                                  : "rgba(255,255,255,0.5)"
                              }
                            />
                          </View>
                        </AnimatedPressable>
                      )}

                      {/* Continue — only when NO secure login */}
                      {!hasSecureLogin && (
                        <AnimatedPressable
                          entering={FadeInDown.delay(80).duration(400)}
                          onPress={navigateHome}
                          className="bg-primary rounded-2xl p-5 mb-3 active:opacity-90 shadow-sm"
                        >
                          <View className="flex-row items-center">
                            <View className="w-12 h-12 rounded-xl bg-white/10 items-center justify-center mr-4">
                              <Ionicons
                                name="arrow-forward"
                                size={22}
                                color="#FFFFFF"
                              />
                            </View>
                            <View className="flex-1">
                              <Text className="text-white text-base font-bold">
                                Continue
                              </Text>
                              <Text className="text-white/50 text-xs mt-0.5">
                                Go to your dashboard
                              </Text>
                            </View>
                            <Ionicons
                              name="chevron-forward"
                              size={20}
                              color="rgba(255,255,255,0.5)"
                            />
                          </View>
                        </AnimatedPressable>
                      )}
                    </View>
                  )}
                </Animated.View>
              </ScrollView>

              {/* ── Bottom Bar ──────────────────────────────────── */}
              {!showPinInput && !showPinReset && (
                <Animated.View
                  entering={FadeInUp.delay(600).duration(400)}
                  className="px-6 pb-4 pt-2"
                >
                  <Pressable
                    onPress={async () => {
                      await logout();
                      router.replace("/auth/role-select");
                    }}
                    className="flex-row items-center justify-center py-3 rounded-full bg-gray-50 active:bg-gray-100"
                  >
                    <Ionicons
                      name="swap-horizontal-outline"
                      size={16}
                      color="#9CA3AF"
                    />
                    <Text className="text-gray-400 text-sm font-medium ml-1.5">
                      Use another account
                    </Text>
                  </Pressable>
                </Animated.View>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
}
