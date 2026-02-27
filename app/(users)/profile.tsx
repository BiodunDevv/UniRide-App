import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/store/useAuthStore";
import useTranslatorStore from "@/store/useTranslatorStore";
import { T, useTranslation } from "@/hooks/use-translation";
import * as WebBrowser from "expo-web-browser";
import ProfileRow from "@/components/profile/ProfileRow";
import ProfileSkeleton from "@/components/ui/ProfileSkeleton";
import { FadeIn, ImagePreviewModal } from "@/components/ui/animations";

export default function UserProfileScreen() {
  const router = useRouter();
  const { user, isLoading, fetchMe, logout } = useAuthStore();
  const { language, availableLanguages } = useTranslatorStore();
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // ─── Translated strings ─────────────────────────────────────────────
  const signOutText = useTranslation("Sign Out");
  const signOutConfirmText = useTranslation(
    "Are you sure you want to sign out?",
  );
  const cancelText = useTranslation("Cancel");
  const editProfileText = useTranslation("Edit Profile");
  const editProfileDescText = useTranslation("Update your name and details");
  const changePwText = useTranslation("Change Password");
  const changePwDescText = useTranslation("Update your password");
  const securityText = useTranslation("Security");
  const devicesText = useTranslation("Your Devices");
  const notifSettingsText = useTranslation("Notification Settings");
  const notifDescText = useTranslation("Manage push & email alerts");
  const aboutText = useTranslation("About UniRide");
  const termsText = useTranslation("Terms & Privacy");
  const supportText = useTranslation("Help & Support");

  const languageText = useTranslation("Language");
  const biometricPinText = useTranslation("Biometric & PIN enabled");
  const biometricOnlyText = useTranslation("Biometric enabled");
  const pinOnlyText = useTranslation("PIN enabled");
  const setupSecurityText = useTranslation("Set up biometric or PIN");

  const currentLang = availableLanguages.find((l) => l.code === language);
  const langDisplayName = currentLang
    ? `${currentLang.name}${currentLang.native_name && currentLang.native_name !== currentLang.name ? ` (${currentLang.native_name})` : ""}`
    : language.toUpperCase();

  useEffect(() => {
    fetchMe().finally(() => setInitialLoad(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMe();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(signOutText, signOutConfirmText, [
      { text: cancelText, style: "cancel" },
      {
        text: signOutText,
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/auth/role-select");
        },
      },
    ]);
  };

  if (initialLoad && isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-24"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#042F40"
          />
        }
      >
        {/* Header */}
        <FadeIn>
          <View className="items-center pt-6 pb-8 px-6">
            {user?.profile_picture ? (
              <Pressable onPress={() => setPreviewImage(user.profile_picture!)}>
                <Image
                  source={{ uri: user.profile_picture }}
                  className="w-20 h-20 rounded-full mb-4 border-2 border-white"
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 6,
                  }}
                />
              </Pressable>
            ) : (
              <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-4">
                <Text className="text-white text-2xl font-bold">
                  {initials}
                </Text>
              </View>
            )}
            <Text className="text-primary text-xl font-bold">
              {user?.name || "User"}
            </Text>
            <Text className="text-gray-400 text-sm mt-1">
              {user?.email || ""}
            </Text>
            <View className="flex-row mt-3 gap-2">
              <View className="bg-primary/10 px-3 py-1 rounded-full">
                <Text className="text-primary text-xs font-semibold capitalize">
                  {user?.role || "user"}
                </Text>
              </View>
              {user?.email_verified ? (
                <View className="bg-green-50 px-3 py-1 rounded-full flex-row items-center gap-1">
                  <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                  <Text className="text-green-600 text-xs font-semibold">
                    <T>Verified</T>
                  </Text>
                </View>
              ) : (
                <View className="bg-amber-50 px-3 py-1 rounded-full">
                  <Text className="text-amber-600 text-xs font-semibold">
                    <T>Unverified</T>
                  </Text>
                </View>
              )}
            </View>
          </View>
        </FadeIn>

        {/* Account */}
        <FadeIn delay={80}>
          <View className="mb-6">
            <Text className="px-6 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <T>Account</T>
            </Text>
            <View className="bg-white mx-4 rounded-2xl border border-gray-100">
              <ProfileRow
                icon="person-outline"
                label={editProfileText}
                value={editProfileDescText}
                onPress={() => router.push("/settings/edit-profile")}
              />
              <View className="h-px bg-gray-100 mx-4" />
              <ProfileRow
                icon="lock-closed-outline"
                label={changePwText}
                value={changePwDescText}
                onPress={() => router.push("/settings/change-password")}
              />
            </View>
          </View>
        </FadeIn>

        {/* Security */}
        <FadeIn delay={140}>
          <View className="mb-6">
            <Text className="px-6 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {securityText}
            </Text>
            <View className="bg-white mx-4 rounded-2xl border border-gray-100">
              <ProfileRow
                icon="shield-checkmark-outline"
                label={securityText}
                value={
                  user?.biometric_enabled && user?.pin_enabled
                    ? biometricPinText
                    : user?.biometric_enabled
                      ? biometricOnlyText
                      : user?.pin_enabled
                        ? pinOnlyText
                        : setupSecurityText
                }
                onPress={() => router.push("/settings/security")}
              />
              <View className="h-px bg-gray-100 mx-4" />
              <ProfileRow
                icon="phone-portrait-outline"
                label={devicesText}
                value={`${user?.devices?.length || 0} device(s) signed in`}
                onPress={() => router.push("/settings/devices")}
              />
            </View>
          </View>
        </FadeIn>

        {/* Notifications */}
        <FadeIn delay={200}>
          <View className="mb-6">
            <Text className="px-6 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <T>Notifications</T>
            </Text>
            <View className="bg-white mx-4 rounded-2xl border border-gray-100">
              <ProfileRow
                icon="notifications-outline"
                label={notifSettingsText}
                value={notifDescText}
                onPress={() => router.push("/settings/notification-settings")}
              />
            </View>
          </View>
        </FadeIn>

        {/* App */}
        <FadeIn delay={260}>
          <View className="mb-6">
            <Text className="px-6 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <T>App</T>
            </Text>
            <View className="bg-white mx-4 rounded-2xl border border-gray-100">
              <ProfileRow
                icon="globe-outline"
                label={languageText}
                value={langDisplayName}
                onPress={() => router.push("/language-picker")}
              />
              <View className="h-px bg-gray-100 mx-4" />
              <ProfileRow
                icon="information-circle-outline"
                label={aboutText}
                value="Version 1.0.0"
              />
              <View className="h-px bg-gray-100 mx-4" />
              <ProfileRow
                icon="document-text-outline"
                label={termsText}
                onPress={() => router.push("/auth/terms")}
              />
              <View className="h-px bg-gray-100 mx-4" />
              <ProfileRow
                icon="help-circle-outline"
                label={supportText}
                onPress={() =>
                  WebBrowser.openBrowserAsync(
                    `${process.env.EXPO_PUBLIC_WEB_URL || "http://172.20.10.4:3000"}/support`,
                    {
                      presentationStyle:
                        WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                      controlsColor: "#042F40",
                      toolbarColor: "#FFFFFF",
                    },
                  )
                }
              />
            </View>
          </View>
        </FadeIn>

        {/* Sign Out */}
        <FadeIn delay={320}>
          <View className="mx-4 mb-4">
            <View className="bg-white rounded-2xl border border-gray-100">
              <ProfileRow
                icon="log-out-outline"
                label={signOutText}
                onPress={handleLogout}
                danger
              />
            </View>
          </View>
        </FadeIn>
      </ScrollView>

      {/* Image Preview */}
      {previewImage && (
        <ImagePreviewModal
          visible={!!previewImage}
          uri={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </SafeAreaView>
  );
}
