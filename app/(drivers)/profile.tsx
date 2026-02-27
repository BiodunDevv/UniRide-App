import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { driverApi } from "@/lib/driverApi";
import ProfileRow from "@/components/profile/ProfileRow";
import ProfileSkeleton from "@/components/ui/ProfileSkeleton";
import { FadeIn, ImagePreviewModal } from "@/components/ui/animations";

export default function DriverProfileScreen() {
  const router = useRouter();
  const { user, isLoading, fetchMe, logout } = useAuthStore();
  const { language, availableLanguages } = useTranslatorStore();
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // ─── Translated strings ─────────────────────────────────────────────
  const signOutText = useTranslation("Sign Out");
  const signOutConfirmText = useTranslation(
    "Are you sure you want to sign out?",
  );
  const cancelText = useTranslation("Cancel");
  const editProfileText = useTranslation("Edit Profile");
  const editProfileDescText = useTranslation("Phone, bank, vehicle details");
  const changePwText = useTranslation("Change Password");
  const changePwDescText = useTranslation("Update your password");
  const securitySectionText = useTranslation("Security");
  const devicesText = useTranslation("Your Devices");
  const notifSettingsText = useTranslation("Notification Settings");
  const notifDescText = useTranslation("Manage push & email alerts");
  const aboutText = useTranslation("About UniRide");
  const termsText = useTranslation("Terms & Privacy");
  const supportText = useTranslation("Help & Support");
  const languageLabelText = useTranslation("Language");
  const biometricPinText = useTranslation("Biometric & PIN enabled");
  const biometricOnlyText = useTranslation("Biometric enabled");
  const pinOnlyText = useTranslation("PIN enabled");
  const setupSecurityText = useTranslation("Set up biometric or PIN");
  const tReview = useTranslation("review");
  const tReviews = useTranslation("reviews");
  const tError = useTranslation("Error");
  const tFailedToggle = useTranslation("Failed to toggle availability");

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

  const handleToggleStatus = async () => {
    setToggling(true);
    try {
      await driverApi.toggleStatus();
      await fetchMe();
    } catch (err: any) {
      Alert.alert(tError, err.message || tFailedToggle);
    } finally {
      setToggling(false);
    }
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
        <ProfileSkeleton isDriver />
      </SafeAreaView>
    );
  }

  const driver = user?.driver;
  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "D";

  const isAvailable = driver?.status === "active";
  const approvalStatus = driver?.application_status || "pending";

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
          <View className="items-center pt-6 pb-5 px-6">
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
              {user?.name || "Driver"}
            </Text>
            <Text className="text-gray-400 text-sm mt-1">
              {user?.email || ""}
            </Text>
            <View className="flex-row mt-3 gap-2 flex-wrap justify-center">
              <View className="bg-[#D4A017]/10 px-3 py-1 rounded-full flex-row items-center gap-1">
                <Ionicons name="car-sport" size={12} color="#D4A017" />
                <Text className="text-[#D4A017] text-xs font-semibold">
                  <T>Driver</T>
                </Text>
              </View>
              <View
                className={`px-3 py-1 rounded-full ${
                  approvalStatus === "approved"
                    ? "bg-green-50"
                    : approvalStatus === "rejected"
                      ? "bg-red-50"
                      : "bg-amber-50"
                }`}
              >
                <Text
                  className={`text-xs font-semibold capitalize ${
                    approvalStatus === "approved"
                      ? "text-green-600"
                      : approvalStatus === "rejected"
                        ? "text-red-500"
                        : "text-amber-600"
                  }`}
                >
                  <T>{approvalStatus}</T>
                </Text>
              </View>
              {user?.email_verified && (
                <View className="bg-green-50 px-3 py-1 rounded-full flex-row items-center gap-1">
                  <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                  <Text className="text-green-600 text-xs font-semibold">
                    <T>Verified</T>
                  </Text>
                </View>
              )}
            </View>
          </View>
        </FadeIn>

        {/* Availability Toggle */}
        {approvalStatus === "approved" && (
          <FadeIn delay={60}>
            <View className="mx-4 mb-6">
              <Pressable
                onPress={handleToggleStatus}
                disabled={toggling}
                className={`flex-row items-center justify-between p-4 rounded-2xl ${
                  isAvailable
                    ? "bg-green-50 border border-green-200"
                    : "bg-gray-50 border border-gray-200"
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                      isAvailable ? "bg-green-100" : "bg-gray-200"
                    }`}
                  >
                    <Ionicons
                      name={
                        isAvailable ? "radio-button-on" : "radio-button-off"
                      }
                      size={20}
                      color={isAvailable ? "#16A34A" : "#9CA3AF"}
                    />
                  </View>
                  <View>
                    <Text
                      className={`text-sm font-bold ${isAvailable ? "text-green-700" : "text-gray-500"}`}
                    >
                      {isAvailable ? (
                        <T>You're Online</T>
                      ) : (
                        <T>You're Offline</T>
                      )}
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {isAvailable ? (
                        <T>Accepting ride requests</T>
                      ) : (
                        <T>Tap to go online</T>
                      )}
                    </Text>
                  </View>
                </View>
                {toggling ? (
                  <ActivityIndicator
                    size="small"
                    color={isAvailable ? "#16A34A" : "#9CA3AF"}
                  />
                ) : (
                  <View
                    className={`px-4 py-2 rounded-full ${isAvailable ? "bg-green-600" : "bg-primary"}`}
                  >
                    <Text className="text-white text-xs font-semibold">
                      {isAvailable ? <T>Go Offline</T> : <T>Go Online</T>}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </FadeIn>
        )}

        {/* Vehicle Image */}
        {driver?.vehicle_image && (
          <FadeIn delay={160}>
            <View className="mx-4 mb-6">
              <Text className="px-2 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <T>Vehicle Photo</T>
              </Text>
              <Pressable
                onPress={() => setPreviewImage(driver.vehicle_image!)}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
              >
                <Image
                  source={{ uri: driver.vehicle_image }}
                  className="w-full"
                  style={{ height: 180 }}
                  resizeMode="cover"
                />
              </Pressable>
            </View>
          </FadeIn>
        )}

        {/* Vehicle Info */}
        {driver && (
          <FadeIn delay={120}>
            <View className="mx-4 mb-6 bg-primary/5 rounded-2xl p-4">
              {/* Vehicle header row */}
              <View className="flex-row items-center mb-4">
                <View className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center mr-3">
                  <Ionicons name="car-sport" size={18} color="#042F40" />
                </View>
                <View className="flex-1">
                  <Text className="text-primary text-sm font-bold">
                    {driver.vehicle_model || "Vehicle"}
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    {driver.vehicle_color ? `${driver.vehicle_color} · ` : ""}
                    {driver.plate_number || ""}
                  </Text>
                </View>
              </View>

              {/* Rating display */}
              <View className="bg-white rounded-xl p-3.5 mb-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="flex-row items-center mr-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={
                            (driver.total_ratings ?? 0) > 0
                              ? star <= Math.round(driver.rating ?? 0)
                                ? "star"
                                : star - 0.5 <= (driver.rating ?? 0)
                                  ? "star-half"
                                  : "star-outline"
                              : "star-outline"
                          }
                          size={16}
                          color={
                            (driver.total_ratings ?? 0) > 0
                              ? "#F59E0B"
                              : "#D1D5DB"
                          }
                          style={{ marginRight: 1 }}
                        />
                      ))}
                    </View>
                    <Text className="text-primary text-base font-bold">
                      {(driver.total_ratings ?? 0) > 0
                        ? (driver.rating ?? 0).toFixed(1)
                        : "—"}
                    </Text>
                  </View>
                  <Text className="text-gray-400 text-xs">
                    {(driver.total_ratings ?? 0) > 0 ? (
                      `${driver.total_ratings} ${driver.total_ratings === 1 ? tReview : tReviews}`
                    ) : (
                      <T>No reviews yet</T>
                    )}
                  </Text>
                </View>
              </View>

              {/* Stats row */}
              <View className="flex-row gap-3">
                <View className="flex-1 bg-white rounded-xl p-3 items-center">
                  <Text className="text-primary text-sm font-bold">
                    {driver.available_seats ?? 0}
                  </Text>
                  <Text className="text-gray-400 text-[10px] mt-0.5">
                    <T>Seats</T>
                  </Text>
                </View>
                <View className="flex-1 bg-white rounded-xl p-3 items-center">
                  <Text className="text-primary text-sm font-bold">
                    {driver.total_ratings ?? 0}
                  </Text>
                  <Text className="text-gray-400 text-[10px] mt-0.5">
                    <T>Reviews</T>
                  </Text>
                </View>
                <View className="flex-1 bg-white rounded-xl p-3 items-center">
                  <Text className="text-primary text-sm font-bold font-mono">
                    {driver.plate_number || "N/A"}
                  </Text>
                  <Text className="text-gray-400 text-[10px] mt-0.5">
                    <T>Plate</T>
                  </Text>
                </View>
              </View>
            </View>
          </FadeIn>
        )}

        {/* Bank Details */}
        {driver?.bank_name && (
          <FadeIn delay={200}>
            <View className="mb-6">
              <Text className="px-6 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <T>Bank Details</T>
              </Text>
              <View className="bg-white mx-4 rounded-2xl border border-gray-100 p-4">
                <View className="flex-row items-center mb-3">
                  <View className="w-9 h-9 rounded-full bg-green-50 items-center justify-center mr-3">
                    <Ionicons name="card-outline" size={18} color="#16A34A" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-primary text-sm font-bold">
                      {driver.bank_name}
                    </Text>
                    <Text className="text-gray-400 text-xs mt-0.5 font-mono">
                      {driver.bank_account_number || <T>Not set</T>}
                    </Text>
                  </View>
                </View>
                {driver.bank_account_name ? (
                  <View className="bg-green-50/50 rounded-xl px-3 py-2">
                    <Text className="text-green-700 text-xs font-medium">
                      {driver.bank_account_name}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </FadeIn>
        )}

        {/* Account */}
        <FadeIn delay={240}>
          <View className="mb-6">
            <Text className="px-6 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <T>Account</T>
            </Text>
            <View className="bg-white mx-4 rounded-2xl border border-gray-100">
              <ProfileRow
                icon="create-outline"
                label={editProfileText}
                value={editProfileDescText}
                onPress={() => router.push("/settings/edit-driver-profile")}
                accent
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
        <FadeIn delay={280}>
          <View className="mb-6">
            <Text className="px-6 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {securitySectionText}
            </Text>
            <View className="bg-white mx-4 rounded-2xl border border-gray-100">
              <ProfileRow
                icon="shield-checkmark-outline"
                label={securitySectionText}
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
        <FadeIn delay={320}>
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
        <FadeIn delay={360}>
          <View className="mb-6">
            <Text className="px-6 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <T>App</T>
            </Text>
            <View className="bg-white mx-4 rounded-2xl border border-gray-100">
              <ProfileRow
                icon="globe-outline"
                label={languageLabelText}
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
        <FadeIn delay={400}>
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
