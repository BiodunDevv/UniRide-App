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
import ProfileRow from "@/components/profile/ProfileRow";
import ProfileSkeleton from "@/components/ui/ProfileSkeleton";
import { FadeIn, ImagePreviewModal } from "@/components/ui/animations";

export default function UserProfileScreen() {
  const router = useRouter();
  const { user, isLoading, fetchMe, logout } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    fetchMe().finally(() => setInitialLoad(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMe();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
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
                    Verified
                  </Text>
                </View>
              ) : (
                <View className="bg-amber-50 px-3 py-1 rounded-full">
                  <Text className="text-amber-600 text-xs font-semibold">
                    Unverified
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
              Account
            </Text>
            <View className="bg-white mx-4 rounded-2xl border border-gray-100">
              <ProfileRow
                icon="person-outline"
                label="Edit Profile"
                value="Update your name and details"
                onPress={() => router.push("/settings/edit-profile")}
              />
              <View className="h-px bg-gray-100 mx-4" />
              <ProfileRow
                icon="lock-closed-outline"
                label="Change Password"
                value="Update your password"
                onPress={() => router.push("/settings/change-password")}
              />
            </View>
          </View>
        </FadeIn>

        {/* Security */}
        <FadeIn delay={140}>
          <View className="mb-6">
            <Text className="px-6 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Security
            </Text>
            <View className="bg-white mx-4 rounded-2xl border border-gray-100">
              <ProfileRow
                icon="shield-checkmark-outline"
                label="Security"
                value={
                  user?.biometric_enabled && user?.pin_enabled
                    ? "Biometric & PIN enabled"
                    : user?.biometric_enabled
                      ? "Biometric enabled"
                      : user?.pin_enabled
                        ? "PIN enabled"
                        : "Set up biometric or PIN"
                }
                onPress={() => router.push("/settings/security")}
              />
              <View className="h-px bg-gray-100 mx-4" />
              <ProfileRow
                icon="phone-portrait-outline"
                label="Your Devices"
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
              Notifications
            </Text>
            <View className="bg-white mx-4 rounded-2xl border border-gray-100">
              <ProfileRow
                icon="notifications-outline"
                label="Notification Settings"
                value="Manage push & email alerts"
                onPress={() => router.push("/settings/notification-settings")}
              />
            </View>
          </View>
        </FadeIn>

        {/* App */}
        <FadeIn delay={260}>
          <View className="mb-6">
            <Text className="px-6 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              App
            </Text>
            <View className="bg-white mx-4 rounded-2xl border border-gray-100">
              <ProfileRow
                icon="information-circle-outline"
                label="About UniRide"
                value="Version 1.0.0"
              />
              <View className="h-px bg-gray-100 mx-4" />
              <ProfileRow
                icon="document-text-outline"
                label="Terms & Privacy"
                onPress={() => router.push("/auth/terms")}
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
                label="Sign Out"
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
