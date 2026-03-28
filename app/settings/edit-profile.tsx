import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/store/useAuthStore";
import { authApi } from "@/lib/api";
import { T, useTranslation } from "@/hooks/use-translation";
import { pickAndUploadImage } from "@/lib/cloudinary";
import { FadeIn } from "@/components/ui/animations";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, fetchMe } = useAuthStore();

  // String values for Alert.alert() args
  const tSuccess = useTranslation("Success");
  const tProfilePictureUpdated = useTranslation("Profile picture updated");
  const tError = useTranslation("Error");
  const tFailedUploadPhoto = useTranslation("Failed to upload photo");
  const tProfileUpdatedSuccessfully = useTranslation(
    "Profile updated successfully",
  );
  const tFailedUpdateProfile = useTranslation("Failed to update profile");
  const tInvalidPhone = useTranslation("Please enter a valid phone number");

  // String value for TextInput placeholder
  const tEnterYourFullName = useTranslation("Enter your full name");
  const tEnterPhoneNumber = useTranslation("Enter your phone number");
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUri, setPreviewUri] = useState(user?.profile_picture || "");

  const handlePickImage = async () => {
    setUploading(true);
    try {
      const result = await pickAndUploadImage("uniride/profiles");
      if (result) {
        setPreviewUri(result.secure_url);
        await authApi.updateProfile({ profile_picture: result.secure_url });
        await fetchMe();
        Alert.alert(tSuccess, tProfilePictureUpdated);
      }
    } catch (err: any) {
      Alert.alert(tError, err.message || tFailedUploadPhoto);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const normalizedPhone = phone.trim();
    if (
      normalizedPhone &&
      !/^\+?[0-9()\-\s]{7,20}$/.test(normalizedPhone)
    ) {
      Alert.alert(tError, tInvalidPhone);
      return;
    }
    setSaving(true);
    try {
      await authApi.updateProfile({
        name: name.trim(),
        phone: normalizedPhone || null,
      });
      await fetchMe();
      Alert.alert(tSuccess, tProfileUpdatedSuccessfully);
      router.back();
    } catch (err: any) {
      Alert.alert(tError, err.message || tFailedUpdateProfile);
    } finally {
      setSaving(false);
    }
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView className="flex-1 bg-slate-50">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {/* Header */}
          <View className="px-6 pb-5 pt-4">
            <View className="flex-row items-center justify-between">
              <Pressable
                onPress={() => router.back()}
                className="h-11 w-11 rounded-2xl bg-white items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#042F40" />
              </Pressable>
              <View className="items-center">
                <Text className="text-primary text-lg font-bold">
                  <T>Edit Profile</T>
                </Text>
                <Text className="mt-1 text-xs text-slate-500">
                  <T>Keep your account details up to date</T>
                </Text>
              </View>
              <View className="w-11" />
            </View>
          </View>

          <View className="flex-1 px-6">
            {/* Avatar with upload */}
            <FadeIn delay={0} duration={400}>
              <View className="items-center mb-8">
                <Pressable onPress={handlePickImage} disabled={uploading}>
                  <View className="relative">
                    {previewUri ? (
                      <Image
                        source={{ uri: previewUri }}
                        className="w-24 h-24 rounded-full"
                      />
                    ) : (
                      <View className="w-24 h-24 rounded-full bg-primary items-center justify-center">
                        <Text className="text-white text-3xl font-bold">
                          {initials}
                        </Text>
                      </View>
                    )}
                    <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#D4A017] items-center justify-center border-2 border-white">
                      {uploading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="camera" size={14} color="#fff" />
                      )}
                    </View>
                  </View>
                </Pressable>
                <Text className="text-gray-400 text-xs mt-3">
                  <T>Tap to change photo</T>
                </Text>
              </View>
            </FadeIn>

            {/* Form */}
            <FadeIn delay={100} duration={400}>
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                <T>Personal Information</T>
              </Text>
              <View className="bg-white rounded-[26px] border border-slate-200 p-4 mb-4">
                <Text className="text-xs font-medium text-gray-400 mb-1.5">
                  <T>Full Name</T>
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-sm text-black"
                  placeholder={tEnterYourFullName}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View className="bg-white rounded-[26px] border border-slate-200 p-4 mb-6">
                <Text className="text-xs font-medium text-gray-400 mb-1.5">
                  <T>Phone Number</T>
                </Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-sm text-black"
                  placeholder={tEnterPhoneNumber}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
                <Text className="text-[10px] text-gray-300 mt-1.5 px-1">
                  <T>Drivers can call you about pickup after you book a ride</T>
                </Text>
              </View>

              <View className="bg-white rounded-[26px] border border-slate-200 p-4 mb-6">
                <Text className="text-xs font-medium text-gray-400 mb-1.5">
                  <T>Email Address</T>
                </Text>
                <View className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex-row items-center">
                  <Text className="text-sm text-gray-400 flex-1">
                    {user?.email || ""}
                  </Text>
                  <Ionicons name="lock-closed" size={14} color="#D1D5DB" />
                </View>
                <Text className="text-[10px] text-gray-300 mt-1.5 px-1">
                  <T>Email cannot be changed</T>
                </Text>
              </View>
            </FadeIn>
          </View>

          {/* Save Button */}
          <View className="px-6 pb-6">
            <Pressable
              onPress={handleSave}
              disabled={!name.trim() || saving}
              className={`w-full py-4 rounded-2xl items-center ${
                !name.trim() ? "bg-gray-200" : "bg-primary"
              }`}
            >
              <Text
                className={`text-base font-bold ${
                  !name.trim() ? "text-gray-400" : "text-white"
                }`}
              >
                {saving ? <T>Saving...</T> : <T>Save Changes</T>}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}
