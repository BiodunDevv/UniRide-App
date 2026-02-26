import { useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useAuthStore } from "@/store/useAuthStore";
import { FadeIn } from "@/components/ui/animations";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export default function SecurityScreen() {
  const router = useRouter();
  const {
    user,
    enableBiometric,
    disableBiometric,
    setupPin,
    updatePin,
    removePin,
    fetchMe,
  } = useAuthStore();

  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [toggling, setToggling] = useState(false);

  // PIN state
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showPinUpdate, setShowPinUpdate] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [password, setPassword] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  const isIOS = Platform.OS === "ios";
  const biometricName = isIOS ? "Face ID" : "Fingerprint";
  const biometricIcon: IoniconsName = isIOS ? "scan-outline" : "finger-print";
  const biometricEnabled = user?.biometric_enabled || false;
  const pinEnabled = user?.pin_enabled || false;

  useEffect(() => {
    checkCapability();
  }, []);

  const checkCapability = async () => {
    setChecking(true);
    try {
      const c = await LocalAuthentication.hasHardwareAsync();
      const e = await LocalAuthentication.isEnrolledAsync();
      setAvailable(c);
      setEnrolled(e);
    } catch {
      setAvailable(false);
    } finally {
      setChecking(false);
    }
  };

  // ── Biometric ─────────────────────────────────────────────────────────────

  const handleToggleBiometric = async () => {
    if (biometricEnabled) {
      Alert.alert(
        `Disable ${biometricName}`,
        `Are you sure you want to disable ${biometricName} login?`,
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
              } catch (err: any) {
                Alert.alert("Error", err.message || "Failed");
              } finally {
                setToggling(false);
              }
            },
          },
        ],
      );
    } else {
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
          Alert.alert("Enabled", `${biometricName} login enabled.`);
        }
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed");
      } finally {
        setToggling(false);
      }
    }
  };

  // ── PIN ───────────────────────────────────────────────────────────────────

  const handleSetupPin = async () => {
    if (!/^\d{4}$/.test(pin)) {
      Alert.alert("Invalid PIN", "PIN must be exactly 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert("Mismatch", "PINs don't match.");
      return;
    }
    if (!password) {
      Alert.alert("Required", "Enter your current password to verify.");
      return;
    }
    setPinLoading(true);
    try {
      await setupPin(pin, password);
      await fetchMe();
      Alert.alert("Success", "PIN login has been enabled.");
      resetPinForm();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to set up PIN.");
    } finally {
      setPinLoading(false);
    }
  };

  const handleUpdatePin = async () => {
    if (!/^\d{4}$/.test(newPin)) {
      Alert.alert("Invalid PIN", "New PIN must be exactly 4 digits.");
      return;
    }
    if (!currentPin) {
      Alert.alert("Required", "Enter your current PIN.");
      return;
    }
    setPinLoading(true);
    try {
      await updatePin(currentPin, newPin);
      Alert.alert("Success", "PIN updated successfully.");
      resetPinForm();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update PIN.");
    } finally {
      setPinLoading(false);
    }
  };

  const handleRemovePin = () => {
    Alert.prompt(
      "Remove PIN",
      "Enter your password to remove PIN login.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async (pw: string | undefined) => {
            if (!pw) return;
            setPinLoading(true);
            try {
              await removePin(pw);
              await fetchMe();
              Alert.alert("Removed", "PIN login has been disabled.");
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed");
            } finally {
              setPinLoading(false);
            }
          },
        },
      ],
      "secure-text",
    );
  };

  const resetPinForm = () => {
    setPin("");
    setConfirmPin("");
    setPassword("");
    setCurrentPin("");
    setNewPin("");
    setShowPinSetup(false);
    setShowPinUpdate(false);
  };

  if (checking) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#042F40" />
      </SafeAreaView>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView className="flex-1 bg-white">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-4 pb-4">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#042F40" />
            </Pressable>
            <Text className="text-primary text-lg font-bold">Security</Text>
            <View className="w-10" />
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="px-6 pb-12"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Biometric Section ─────────────────────────────────────── */}
            <FadeIn delay={0} duration={400}>
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-2">
                Biometric
              </Text>
              <View className="bg-white rounded-2xl border border-gray-100 mb-6">
                <Pressable
                  onPress={handleToggleBiometric}
                  disabled={toggling || !available || !enrolled}
                  className="flex-row items-center p-4 active:bg-gray-50"
                >
                  <View
                    className={`w-11 h-11 rounded-full items-center justify-center mr-3 ${
                      biometricEnabled ? "bg-green-50" : "bg-primary/5"
                    }`}
                  >
                    <Ionicons
                      name={biometricIcon}
                      size={24}
                      color={biometricEnabled ? "#16A34A" : "#042F40"}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-primary">
                      {biometricName} Login
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {biometricEnabled
                        ? "Enabled — tap to disable"
                        : !available
                          ? "Hardware not available"
                          : !enrolled
                            ? `Set up ${biometricName} in device settings`
                            : "Tap to enable quick sign-in"}
                    </Text>
                  </View>
                  {toggling ? (
                    <ActivityIndicator size="small" color="#042F40" />
                  ) : (
                    <View
                      className={`w-12 h-7 rounded-full items-center justify-center ${
                        biometricEnabled ? "bg-green-500" : "bg-gray-200"
                      }`}
                    >
                      <View
                        className={`w-5 h-5 rounded-full bg-white shadow-sm ${
                          biometricEnabled ? "ml-5" : "mr-5"
                        }`}
                      />
                    </View>
                  )}
                </Pressable>
              </View>
            </FadeIn>

            {/* ── PIN Section ───────────────────────────────────────────── */}
            <FadeIn delay={100} duration={400}>
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                4-Digit PIN
              </Text>
              <View className="bg-white rounded-2xl border border-gray-100 mb-6">
                {/* PIN Status */}
                <View className="flex-row items-center p-4">
                  <View
                    className={`w-11 h-11 rounded-full items-center justify-center mr-3 ${
                      pinEnabled ? "bg-green-50" : "bg-primary/5"
                    }`}
                  >
                    <Ionicons
                      name="keypad-outline"
                      size={22}
                      color={pinEnabled ? "#16A34A" : "#042F40"}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-primary">
                      PIN Login
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {pinEnabled
                        ? "Enabled — sign in with 4-digit PIN"
                        : "Set up a quick 4-digit PIN for sign-in"}
                    </Text>
                  </View>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      pinEnabled ? "bg-green-50" : "bg-gray-100"
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        pinEnabled ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      {pinEnabled ? "ON" : "OFF"}
                    </Text>
                  </View>
                </View>

                <View className="h-px bg-gray-100 mx-4" />

                {/* Actions */}
                {!pinEnabled && !showPinSetup && (
                  <Pressable
                    onPress={() => setShowPinSetup(true)}
                    className="flex-row items-center p-4 active:bg-gray-50"
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={20}
                      color="#042F40"
                    />
                    <Text className="text-sm font-semibold text-primary ml-3">
                      Set Up PIN
                    </Text>
                  </Pressable>
                )}

                {pinEnabled && !showPinUpdate && (
                  <>
                    <Pressable
                      onPress={() => setShowPinUpdate(true)}
                      className="flex-row items-center p-4 active:bg-gray-50"
                    >
                      <Ionicons
                        name="create-outline"
                        size={20}
                        color="#042F40"
                      />
                      <Text className="text-sm font-semibold text-primary ml-3">
                        Change PIN
                      </Text>
                    </Pressable>
                    <View className="h-px bg-gray-100 mx-4" />
                    <Pressable
                      onPress={handleRemovePin}
                      disabled={pinLoading}
                      className="flex-row items-center p-4 active:bg-gray-50"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color="#EF4444"
                      />
                      <Text className="text-sm font-semibold text-red-500 ml-3">
                        Remove PIN
                      </Text>
                    </Pressable>
                  </>
                )}

                {/* Setup Form */}
                {showPinSetup && (
                  <View className="p-4 pt-2">
                    <TextInput
                      placeholder="Enter 4-digit PIN"
                      placeholderTextColor="#9CA3AF"
                      value={pin}
                      onChangeText={(t) =>
                        setPin(t.replace(/\D/g, "").slice(0, 4))
                      }
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={4}
                      className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-primary mb-3"
                    />
                    <TextInput
                      placeholder="Confirm PIN"
                      placeholderTextColor="#9CA3AF"
                      value={confirmPin}
                      onChangeText={(t) =>
                        setConfirmPin(t.replace(/\D/g, "").slice(0, 4))
                      }
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={4}
                      className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-primary mb-3"
                    />
                    <TextInput
                      placeholder="Current password (for verification)"
                      placeholderTextColor="#9CA3AF"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-primary mb-4"
                    />
                    <View className="flex-row gap-3">
                      <Pressable
                        onPress={resetPinForm}
                        className="flex-1 py-3 rounded-xl items-center border border-gray-200"
                      >
                        <Text className="text-gray-500 text-sm font-semibold">
                          Cancel
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={handleSetupPin}
                        disabled={pinLoading}
                        className="flex-1 py-3 rounded-xl items-center bg-primary"
                      >
                        {pinLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text className="text-white text-sm font-bold">
                            Enable PIN
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Update Form */}
                {showPinUpdate && (
                  <View className="p-4 pt-2">
                    <TextInput
                      placeholder="Current PIN"
                      placeholderTextColor="#9CA3AF"
                      value={currentPin}
                      onChangeText={(t) =>
                        setCurrentPin(t.replace(/\D/g, "").slice(0, 4))
                      }
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={4}
                      className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-primary mb-3"
                    />
                    <TextInput
                      placeholder="New 4-digit PIN"
                      placeholderTextColor="#9CA3AF"
                      value={newPin}
                      onChangeText={(t) =>
                        setNewPin(t.replace(/\D/g, "").slice(0, 4))
                      }
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={4}
                      className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-primary mb-4"
                    />
                    <View className="flex-row gap-3">
                      <Pressable
                        onPress={resetPinForm}
                        className="flex-1 py-3 rounded-xl items-center border border-gray-200"
                      >
                        <Text className="text-gray-500 text-sm font-semibold">
                          Cancel
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={handleUpdatePin}
                        disabled={pinLoading}
                        className="flex-1 py-3 rounded-xl items-center bg-primary"
                      >
                        {pinLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text className="text-white text-sm font-bold">
                            Update PIN
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </FadeIn>

            {/* ── Info Card ─────────────────────────────────────────────── */}
            <FadeIn delay={200} duration={400}>
              <View className="bg-primary/[0.03] rounded-2xl p-4 mb-6">
                <View className="flex-row items-center mb-2">
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color="#042F40"
                  />
                  <Text className="text-primary text-sm font-bold ml-2">
                    Security Tips
                  </Text>
                </View>
                <Text className="text-gray-400 text-xs leading-5">
                  • Use {biometricName} for the fastest, most secure sign-in
                  {"\n"}• PIN provides a quick alternative when {biometricName}{" "}
                  isn't available{"\n"}• Both options keep your password safe
                  and secure
                </Text>
              </View>
            </FadeIn>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}
