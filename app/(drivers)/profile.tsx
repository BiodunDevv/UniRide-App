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
import { driverApi } from "@/lib/driverApi";
import ProfileRow from "@/components/profile/ProfileRow";
import ProfileSkeleton from "@/components/ui/ProfileSkeleton";
import { FadeIn, ImagePreviewModal } from "@/components/ui/animations";

export default function DriverProfileScreen() {
  const router = useRouter();
  const { user, isLoading, fetchMe, logout } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
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

  const handleToggleStatus = async () => {
    setToggling(true);
    try {
      await driverApi.toggleStatus();
      await fetchMe();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to toggle availability");
    } finally {
      setToggling(false);
    }
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
                  Driver
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
                  {approvalStatus}
                </Text>
              </View>
              {user?.email_verified && (
                <View className="bg-green-50 px-3 py-1 rounded-full flex-row items-center gap-1">
                  <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                  <Text className="text-green-600 text-xs font-semibold">
                    Verified
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
                      {isAvailable ? "You're Online" : "You're Offline"}
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {isAvailable
                        ? "Accepting ride requests"
                        : "Tap to go online"}
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
                      {isAvailable ? "Go Offline" : "Go Online"}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </FadeIn>
        )}

        {/* Vehicle Info */}
        {driver && (
          <FadeIn delay={120}>
            <View className="mx-4 mb-6 bg-primary/5 rounded-2xl p-4">
              <View className="flex-row items-center mb-3">
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
                {driver.rating > 0 && (
                  <View className="flex-row items-center bg-white px-2.5 py-1 rounded-full">
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text className="text-primary text-xs font-bold ml-1">
                      {driver.rating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 bg-white rounded-xl p-3 items-center">
                  <Text className="text-primary text-xs font-semibold">
                    {driver.available_seats ?? 0}
                  </Text>
                  <Text className="text-gray-400 text-[10px] mt-0.5">
                    Seats
                  </Text>
                </View>
                <View className="flex-1 bg-white rounded-xl p-3 items-center">
                  <Text className="text-primary text-xs font-semibold">
                    {driver.total_ratings ?? 0}
                  </Text>
                  <Text className="text-gray-400 text-[10px] mt-0.5">
                    Ratings
                  </Text>
                </View>
                <View className="flex-1 bg-white rounded-xl p-3 items-center">
                  <Text className="text-primary text-xs font-semibold font-mono">
                    {driver.plate_number || "N/A"}
                  </Text>
                  <Text className="text-gray-400 text-[10px] mt-0.5">
                    Plate
                  </Text>
                </View>
              </View>
              {driver.vehicle_description ? (
                <Text className="text-gray-500 text-xs mt-3 leading-4">
                  {driver.vehicle_description}
                </Text>
              ) : null}
            </View>
          </FadeIn>
        )}

        {/* Vehicle Image */}
        {driver?.vehicle_image && (
          <FadeIn delay={160}>
            <View className="mx-4 mb-6">
              <Text className="px-2 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Vehicle Photo
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

        {/* Bank Details */}
        {driver?.bank_name && (
          <FadeIn delay={200}>
            <View className="mb-6">
              <Text className="px-6 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Bank Details
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
                      {driver.bank_account_number || "Not set"}
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
              Account
            </Text>
            <View className="bg-white mx-4 rounded-2xl border border-gray-100">
              <ProfileRow
                icon="create-outline"
                label="Edit Profile"
                value="Phone, bank, vehicle details"
                onPress={() => router.push("/settings/edit-driver-profile")}
                accent
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
        <FadeIn delay={280}>
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
        <FadeIn delay={320}>
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
        <FadeIn delay={360}>
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
        <FadeIn delay={400}>
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
