import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/store/useAuthStore";
import { useTranslations } from "@/hooks/use-translation";
import { FadeIn } from "@/components/ui/animations";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { changePassword } = useAuthStore();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [
    tSuccess,
    tPasswordChanged,
    tOK,
    tError,
    tFailedToChange,
    tChangePassword,
    tStrongPassword,
    tCurrentPassword,
    tEnterCurrentPassword,
    tNewPassword,
    tEnterNewPassword,
    tConfirmNewPassword,
    tConfirmNewPasswordPlaceholder,
    tPasswordsNoMatch,
    tUpdatePassword,
  ] = useTranslations([
    "Success",
    "Password changed successfully",
    "OK",
    "Error",
    "Failed to change password",
    "Change Password",
    "Choose a strong password with at least 6 characters",
    "Current Password",
    "Enter current password",
    "New Password",
    "Enter new password",
    "Confirm New Password",
    "Confirm new password",
    "Passwords do not match",
    "Update Password",
  ]);

  const valid =
    currentPw.length >= 6 && newPw.length >= 6 && newPw === confirmPw;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await changePassword(currentPw, newPw);
      Alert.alert(tSuccess, tPasswordChanged, [
        { text: tOK, onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert(tError, err.message || tFailedToChange);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView className="flex-1 bg-white">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-4 pb-6">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#042F40" />
            </Pressable>
            <Text className="text-primary text-lg font-bold">
              {tChangePassword}
            </Text>
            <View className="w-10" />
          </View>

          <View className="flex-1 px-6">
            {/* Icon */}
            <FadeIn delay={0} duration={400}>
              <View className="items-center mb-8">
                <View className="w-20 h-20 rounded-full bg-primary/5 items-center justify-center">
                  <Ionicons name="shield-checkmark" size={36} color="#042F40" />
                </View>
                <Text className="text-gray-400 text-xs mt-3 text-center px-8">
                  {tStrongPassword}
                </Text>
              </View>
            </FadeIn>

            {/* Fields */}
            <FadeIn delay={100} duration={400}>
              <View className="mb-4">
                <Text className="text-xs font-medium text-gray-400 mb-1.5 px-1">
                  {tCurrentPassword}
                </Text>
                <View className="flex-row items-center bg-gray-50 rounded-xl border border-gray-200">
                  <TextInput
                    value={currentPw}
                    onChangeText={setCurrentPw}
                    className="flex-1 px-4 py-3.5 text-sm text-black"
                    placeholder={tEnterCurrentPassword}
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showCurrent}
                  />
                  <Pressable
                    onPress={() => setShowCurrent(!showCurrent)}
                    className="px-4"
                  >
                    <Ionicons
                      name={showCurrent ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color="#9CA3AF"
                    />
                  </Pressable>
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-xs font-medium text-gray-400 mb-1.5 px-1">
                  {tNewPassword}
                </Text>
                <View className="flex-row items-center bg-gray-50 rounded-xl border border-gray-200">
                  <TextInput
                    value={newPw}
                    onChangeText={setNewPw}
                    className="flex-1 px-4 py-3.5 text-sm text-black"
                    placeholder={tEnterNewPassword}
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showNew}
                  />
                  <Pressable
                    onPress={() => setShowNew(!showNew)}
                    className="px-4"
                  >
                    <Ionicons
                      name={showNew ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color="#9CA3AF"
                    />
                  </Pressable>
                </View>
              </View>

              <View className="mb-2">
                <Text className="text-xs font-medium text-gray-400 mb-1.5 px-1">
                  {tConfirmNewPassword}
                </Text>
                <View className="flex-row items-center bg-gray-50 rounded-xl border border-gray-200">
                  <TextInput
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                    className="flex-1 px-4 py-3.5 text-sm text-black"
                    placeholder={tConfirmNewPasswordPlaceholder}
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showConfirm}
                  />
                  <Pressable
                    onPress={() => setShowConfirm(!showConfirm)}
                    className="px-4"
                  >
                    <Ionicons
                      name={showConfirm ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color="#9CA3AF"
                    />
                  </Pressable>
                </View>
              </View>

              {newPw && confirmPw && newPw !== confirmPw ? (
                <Text className="text-red-500 text-xs px-1 mb-4">
                  {tPasswordsNoMatch}
                </Text>
              ) : (
                <View className="mb-4" />
              )}
            </FadeIn>
          </View>

          {/* Save Button */}
          <View className="px-6 pb-6">
            <Pressable
              onPress={handleSave}
              disabled={!valid || saving}
              className={`w-full py-4 rounded-2xl items-center ${
                !valid ? "bg-gray-200" : "bg-primary"
              }`}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  className={`text-base font-bold ${
                    !valid ? "text-gray-400" : "text-white"
                  }`}
                >
                  {tUpdatePassword}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}
