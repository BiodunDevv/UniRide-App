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
import { pickAndUploadImage } from "@/lib/cloudinary";
import { FadeIn } from "@/components/ui/animations";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, fetchMe } = useAuthStore();
  const [name, setName] = useState(user?.name || "");
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
        Alert.alert("Success", "Profile picture updated");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await authApi.updateProfile({ name: name.trim() });
      await fetchMe();
      Alert.alert("Success", "Profile updated successfully");
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update profile");
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
            <Text className="text-primary text-lg font-bold">Edit Profile</Text>
            <View className="w-10" />
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
                  Tap to change photo
                </Text>
              </View>
            </FadeIn>

            {/* Form */}
            <FadeIn delay={100} duration={400}>
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                Personal Information
              </Text>
              <View className="bg-gray-50 rounded-2xl border border-gray-100 p-4 mb-4">
                <Text className="text-xs font-medium text-gray-400 mb-1.5">
                  Full Name
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-sm text-black"
                  placeholder="Enter your full name"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View className="bg-gray-50 rounded-2xl border border-gray-100 p-4 mb-6">
                <Text className="text-xs font-medium text-gray-400 mb-1.5">
                  Email Address
                </Text>
                <View className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex-row items-center">
                  <Text className="text-sm text-gray-400 flex-1">
                    {user?.email || ""}
                  </Text>
                  <Ionicons name="lock-closed" size={14} color="#D1D5DB" />
                </View>
                <Text className="text-[10px] text-gray-300 mt-1.5 px-1">
                  Email cannot be changed
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
                {saving ? "Saving..." : "Save Changes"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}
