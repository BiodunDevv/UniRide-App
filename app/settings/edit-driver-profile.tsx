import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { useAuthStore } from "@/store/useAuthStore";
import { authApi } from "@/lib/api";
import { driverApi } from "@/lib/driverApi";
import { pickAndUploadImage } from "@/lib/cloudinary";
import { eventBus } from "@/lib/eventBus";
import { ImagePreviewModal } from "@/components/ui/animations";
import { T, useTranslation } from "@/hooks/use-translation";

/* ─── Card shadow style ───────────────────────────────────────────────────── */
const cardShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 4,
};

/* ─── Main Screen ──────────────────────────────────────────────────────────── */
export default function EditDriverProfileScreen() {
  const router = useRouter();
  const { user, fetchMe } = useAuthStore();
  const driver = user?.driver;

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Profile picture
  const [previewUri, setPreviewUri] = useState(user?.profile_picture || "");

  // Contact
  const [phone, setPhone] = useState(driver?.phone || "");

  // Bank
  const [bankName, setBankName] = useState(driver?.bank_name || "");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState(
    driver?.bank_account_number || "",
  );
  const [accountHolder, setAccountHolder] = useState(
    driver?.bank_account_name || "",
  );
  const [verified, setVerified] = useState(!!driver?.bank_account_name);

  // Vehicle
  const [vehicleColor, setVehicleColor] = useState(driver?.vehicle_color || "");
  const [vehicleDescription, setVehicleDescription] = useState(
    driver?.vehicle_description || "",
  );
  const [availableSeats, setAvailableSeats] = useState(
    String(driver?.available_seats || 4),
  );

  // Alert strings
  const tError = useTranslation("Error");
  const tFailedUploadPhoto = useTranslation("Failed to upload photo");
  const tFailedUploadVehicleImage = useTranslation(
    "Failed to upload vehicle image",
  );
  const tFailedUpdateLicense = useTranslation("Failed to update license");
  const tInvalidDetails = useTranslation("Invalid Details");
  const tInvalidBankMsg = useTranslation(
    "Please select a bank and enter a valid 10-digit account number.",
  );
  const tPleaseWait = useTranslation("Please Wait");
  const tRateLimitMsg = useTranslation(
    "The verification service is temporarily busy. Please wait a moment and try again.",
  );
  const tVerificationFailed = useTranslation("Verification Failed");
  const tVerifyFailedMsg = useTranslation(
    "Could not verify this account. Please check the details.",
  );
  const tMissingInfo = useTranslation("Missing Info");
  const tPhoneRequired = useTranslation("Phone number is required.");
  const tSuccess = useTranslation("Success");
  const tProfileUpdated = useTranslation("Profile updated successfully");
  const tFailedUpdateProfile = useTranslation("Failed to update profile");

  // Load initial bank code if bank name is already set
  useEffect(() => {
    if (driver?.bank_name) {
      (async () => {
        try {
          const res = await driverApi.getBankList();
          const found = (res.data || []).find(
            (b: { name: string; code: string }) =>
              b.name.toLowerCase() === driver.bank_name?.toLowerCase(),
          );
          if (found) setBankCode(found.code);
        } catch {
          // silent
        }
      })();
    }
  }, []);

  const handlePickProfilePicture = async () => {
    setUploading("profile");
    try {
      const result = await pickAndUploadImage("uniride/profiles");
      if (result) {
        setPreviewUri(result.secure_url);
        await authApi.updateProfile({ profile_picture: result.secure_url });
        await fetchMe();
      }
    } catch (err: any) {
      Alert.alert(tError, err.message || tFailedUploadPhoto);
    } finally {
      setUploading(null);
    }
  };

  const handlePickVehicleImage = async () => {
    setUploading("vehicle");
    try {
      const result = await pickAndUploadImage("uniride/vehicles");
      if (result) {
        await driverApi.updateVehicleImage({
          vehicle_image: result.secure_url,
        });
        await fetchMe();
      }
    } catch (err: any) {
      Alert.alert(tError, err.message || tFailedUploadVehicleImage);
    } finally {
      setUploading(null);
    }
  };

  const handlePickLicense = async () => {
    setUploading("license");
    try {
      const result = await pickAndUploadImage("uniride/licenses");
      if (result) {
        await driverApi.updateLicense({ drivers_license: result.secure_url });
        await fetchMe();
      }
    } catch (err: any) {
      Alert.alert(tError, err.message || tFailedUpdateLicense);
    } finally {
      setUploading(null);
    }
  };

  const handleVerifyAccount = async () => {
    if (accountNumber.length !== 10 || !bankCode) {
      Alert.alert(tInvalidDetails, tInvalidBankMsg);
      return;
    }
    setVerifying(true);
    try {
      const res = await driverApi.verifyBankAccount({
        account_number: accountNumber,
        bank_code: bankCode,
      });
      setAccountHolder(res.data.account_name);
      setVerified(true);
    } catch (err: any) {
      const isRateLimit =
        err.status === 429 || err.data?.code === "RATE_LIMITED";
      Alert.alert(
        isRateLimit ? tPleaseWait : tVerificationFailed,
        isRateLimit ? tRateLimitMsg : err.message || tVerifyFailedMsg,
      );
      setVerified(false);
      setAccountHolder("");
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!phone.trim()) {
      Alert.alert(tMissingInfo, tPhoneRequired);
      return;
    }
    setSaving(true);
    try {
      await driverApi.updateProfile({
        phone: phone.trim(),
        bank_name: bankName,
        bank_account_number: accountNumber,
        bank_account_name: accountHolder,
        available_seats: parseInt(availableSeats) || 4,
        vehicle_color: vehicleColor.trim(),
        vehicle_description: vehicleDescription.trim(),
      });
      await fetchMe();
      Alert.alert(tSuccess, tProfileUpdated);
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
      .slice(0, 2) || "D";

  const openBankPicker = useCallback(() => {
    router.push({
      pathname: "/settings/bank-picker",
      params: { selected: bankName },
    });
  }, [router, bankName]);

  // Listen for bank selection from bank-picker page
  useEffect(() => {
    const off = eventBus.on(
      "bank-selected",
      (bank: { name: string; code: string }) => {
        setBankName(bank.name);
        setBankCode(bank.code);
        setVerified(false);
        setAccountHolder("");
      },
    );
    return () => {
      off();
    };
  }, []);

  return (
    <View className="flex-1 bg-gray-50">
      <SafeAreaView edges={["top"]} className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {/* ── Header ───────────────────────────────────────────────── */}
          <Animated.View
            entering={FadeInUp.duration(300)}
            className="px-5 pt-3 pb-4 bg-white border-b border-gray-100"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => router.back()}
                  className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
                >
                  <Ionicons name="arrow-back" size={20} color="#042F40" />
                </TouchableOpacity>
                <View>
                  <Text className="text-xl font-bold text-gray-900">
                    <T>Edit Profile</T>
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    <T>Manage your driver details</T>
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                className="bg-primary rounded-full px-4 py-2"
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white text-xs font-bold">
                    <T>Save</T>
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Profile Picture ─────────────────────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(100).duration(400)}
              className="items-center mt-5 mb-5"
            >
              <TouchableOpacity
                onPress={handlePickProfilePicture}
                disabled={uploading === "profile"}
                activeOpacity={0.8}
              >
                <View className="relative">
                  {previewUri ? (
                    <Image
                      source={{ uri: previewUri }}
                      className="w-24 h-24 rounded-full border-4 border-white"
                      style={{
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                      }}
                    />
                  ) : (
                    <View
                      className="w-24 h-24 rounded-full bg-primary items-center justify-center border-4 border-white"
                      style={{
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                      }}
                    >
                      <Text className="text-white text-2xl font-bold">
                        {initials}
                      </Text>
                    </View>
                  )}
                  <View className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent items-center justify-center border-[3px] border-gray-50">
                    {uploading === "profile" ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="camera" size={13} color="#fff" />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
              <Text className="text-base font-bold text-gray-900 mt-3">
                {user?.name}
              </Text>
              <Text className="text-xs text-gray-400">{user?.email}</Text>
            </Animated.View>

            {/* ── Contact Info ────────────────────────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(200).duration(400)}
              className="mx-5 mt-2"
            >
              <View className="flex-row items-center gap-2 mb-3 px-1">
                <View className="w-6 h-6 rounded-lg bg-primary/10 items-center justify-center">
                  <Ionicons name="call" size={12} color="#042F40" />
                </View>
                <Text className="text-xs font-bold text-primary uppercase tracking-wider">
                  <T>Contact</T>
                </Text>
              </View>

              <View
                className="bg-white rounded-2xl border border-gray-100 p-4"
                style={cardShadow}
              >
                <View>
                  <Text className="text-[11px] font-semibold text-gray-400 mb-1.5 ml-1">
                    <T>Phone Number</T>
                  </Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+234 800 000 0000"
                    placeholderTextColor="#BCBFC4"
                    keyboardType="phone-pad"
                    className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-sm text-black"
                  />
                </View>
              </View>
            </Animated.View>

            {/* ── Bank Details ────────────────────────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(300).duration(400)}
              className="mx-5 mt-6"
            >
              <View className="flex-row items-center gap-2 mb-3 px-1">
                <View className="w-6 h-6 rounded-lg bg-accent/10 items-center justify-center">
                  <Ionicons name="card" size={12} color="#D4A017" />
                </View>
                <Text className="text-xs font-bold text-accent uppercase tracking-wider">
                  <T>Bank Details</T>
                </Text>
              </View>

              <View
                className="bg-white rounded-2xl border border-gray-100 p-4"
                style={cardShadow}
              >
                {/* Bank selector */}
                <View className="mb-4">
                  <Text className="text-[11px] font-semibold text-gray-400 mb-1.5 ml-1">
                    <T>Select Bank</T>
                  </Text>
                  <TouchableOpacity
                    onPress={openBankPicker}
                    activeOpacity={0.7}
                    className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center flex-1">
                      <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center mr-3">
                        <Ionicons
                          name="business-outline"
                          size={15}
                          color="#042F40"
                        />
                      </View>
                      <Text
                        className={`text-sm flex-1 ${bankName ? "text-black font-medium" : "text-gray-400"}`}
                        numberOfLines={1}
                      >
                        {bankName || "Choose your bank"}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>

                {/* Account number + verify */}
                <View className="mb-4">
                  <Text className="text-[11px] font-semibold text-gray-400 mb-1.5 ml-1">
                    <T>Account Number</T>
                  </Text>
                  <View className="flex-row gap-2.5">
                    <TextInput
                      value={accountNumber}
                      onChangeText={(t) => {
                        setAccountNumber(t.replace(/\D/g, ""));
                        setVerified(false);
                        setAccountHolder("");
                      }}
                      className="flex-1 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-sm text-black tracking-wider"
                      placeholder="0123456789"
                      placeholderTextColor="#BCBFC4"
                      keyboardType="numeric"
                      maxLength={10}
                    />
                    <TouchableOpacity
                      onPress={handleVerifyAccount}
                      disabled={
                        verifying || accountNumber.length !== 10 || !bankCode
                      }
                      activeOpacity={0.7}
                      className={`px-5 rounded-xl items-center justify-center ${
                        accountNumber.length === 10 && bankCode
                          ? "bg-accent"
                          : "bg-gray-100"
                      }`}
                    >
                      {verifying ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <View className="flex-row items-center gap-1">
                          <Ionicons
                            name="shield-checkmark"
                            size={13}
                            color={
                              accountNumber.length === 10 && bankCode
                                ? "#fff"
                                : "#9CA3AF"
                            }
                          />
                          <Text
                            className={`text-xs font-bold ${
                              accountNumber.length === 10 && bankCode
                                ? "text-white"
                                : "text-gray-400"
                            }`}
                          >
                            <T>Verify</T>
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Verified result */}
                {accountHolder ? (
                  <View
                    className={`rounded-xl px-4 py-3 flex-row items-center ${
                      verified
                        ? "bg-green-50 border border-green-100"
                        : "bg-gray-50 border border-gray-100"
                    }`}
                  >
                    {verified && (
                      <View className="w-6 h-6 rounded-full bg-green-100 items-center justify-center mr-2.5">
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color="#16A34A"
                        />
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-[10px] text-gray-400 font-medium">
                        <T>Account Name</T>
                      </Text>
                      <Text
                        className={`text-sm font-semibold mt-0.5 ${
                          verified ? "text-green-700" : "text-gray-600"
                        }`}
                      >
                        {accountHolder}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </Animated.View>

            {/* ── Vehicle Details ─────────────────────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(400).duration(400)}
              className="mx-5 mt-6"
            >
              <View className="flex-row items-center gap-2 mb-3 px-1">
                <View className="w-6 h-6 rounded-lg bg-primary/10 items-center justify-center">
                  <Ionicons name="car-sport" size={12} color="#042F40" />
                </View>
                <Text className="text-xs font-bold text-primary uppercase tracking-wider">
                  <T>Vehicle Details</T>
                </Text>
              </View>

              <View
                className="bg-white rounded-2xl border border-gray-100 p-4"
                style={cardShadow}
              >
                {/* Vehicle Color */}
                <View className="mb-4">
                  <Text className="text-[11px] font-semibold text-gray-400 mb-1.5 ml-1">
                    <T>Vehicle Color</T>
                  </Text>
                  <TextInput
                    value={vehicleColor}
                    onChangeText={setVehicleColor}
                    placeholder="e.g. Silver, White, Black"
                    placeholderTextColor="#BCBFC4"
                    className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-sm text-black"
                  />
                </View>

                {/* Available Seats */}
                <View className="mb-4">
                  <Text className="text-[11px] font-semibold text-gray-400 mb-1.5 ml-1">
                    <T>Available Seats</T>
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                      onPress={() => {
                        const n = Math.max(1, parseInt(availableSeats) - 1);
                        setAvailableSeats(String(n));
                      }}
                      className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center"
                    >
                      <Ionicons name="remove" size={20} color="#042F40" />
                    </TouchableOpacity>
                    <View className="flex-1 bg-gray-50 rounded-xl border border-gray-200 items-center py-3">
                      <Text className="text-lg font-bold text-gray-900">
                        {availableSeats}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        const n = Math.min(8, parseInt(availableSeats) + 1);
                        setAvailableSeats(String(n));
                      }}
                      className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center"
                    >
                      <Ionicons name="add" size={20} color="#042F40" />
                    </TouchableOpacity>
                  </View>
                  <Text className="text-[10px] text-gray-400 mt-1 ml-1">
                    <T>Maximum number of passengers your vehicle can take</T>
                  </Text>
                </View>

                {/* Vehicle Description */}
                <View>
                  <Text className="text-[11px] font-semibold text-gray-400 mb-1.5 ml-1">
                    <T>Description</T>
                  </Text>
                  <TextInput
                    value={vehicleDescription}
                    onChangeText={setVehicleDescription}
                    placeholder="Brief vehicle description..."
                    placeholderTextColor="#BCBFC4"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    maxLength={500}
                    className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-sm text-black min-h-[80px]"
                  />
                  <Text className="text-[10px] text-gray-400 text-right mt-1 mr-1">
                    {vehicleDescription.length}/500
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* ── Vehicle Photo ───────────────────────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(500).duration(400)}
              className="mx-5 mt-6"
            >
              <View className="flex-row items-center gap-2 mb-3 px-1">
                <View className="w-6 h-6 rounded-lg bg-accent/10 items-center justify-center">
                  <Ionicons name="image" size={12} color="#D4A017" />
                </View>
                <Text className="text-xs font-bold text-accent uppercase tracking-wider">
                  <T>Vehicle Photo</T>
                </Text>
              </View>

              <TouchableOpacity
                onPress={handlePickVehicleImage}
                disabled={uploading === "vehicle"}
                activeOpacity={0.8}
                className="rounded-2xl overflow-hidden bg-white border border-gray-100"
                style={cardShadow}
              >
                {driver?.vehicle_image ? (
                  <View>
                    <TouchableOpacity
                      onPress={() => setPreviewImage(driver.vehicle_image!)}
                      activeOpacity={0.9}
                    >
                      <Image
                        source={{ uri: driver.vehicle_image }}
                        className="w-full h-48"
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handlePickVehicleImage}
                      disabled={uploading === "vehicle"}
                      className="flex-row items-center justify-center gap-2 py-3 border-t border-gray-100"
                    >
                      {uploading === "vehicle" ? (
                        <ActivityIndicator size="small" color="#042F40" />
                      ) : (
                        <>
                          <Ionicons
                            name="camera-outline"
                            size={14}
                            color="#042F40"
                          />
                          <Text className="text-primary text-xs font-semibold">
                            <T>Change Photo</T>
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="h-48 items-center justify-center bg-gray-50">
                    {uploading === "vehicle" ? (
                      <ActivityIndicator size="large" color="#042F40" />
                    ) : (
                      <>
                        <View className="w-14 h-14 rounded-full bg-primary/10 items-center justify-center mb-3">
                          <Ionicons
                            name="car-sport"
                            size={24}
                            color="#042F40"
                          />
                        </View>
                        <Text className="text-sm font-semibold text-gray-600">
                          <T>Add Vehicle Photo</T>
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1">
                          <T>Tap to upload a photo of your vehicle</T>
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* ── Driver's License ────────────────────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(600).duration(400)}
              className="mx-5 mt-6"
            >
              <View className="flex-row items-center gap-2 mb-3 px-1">
                <View className="w-6 h-6 rounded-lg bg-gray-100 items-center justify-center">
                  <Ionicons name="document-text" size={12} color="#6B7280" />
                </View>
                <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <T>Driver's License</T>
                </Text>
              </View>

              <TouchableOpacity
                onPress={handlePickLicense}
                disabled={uploading === "license"}
                activeOpacity={0.8}
                className="rounded-2xl overflow-hidden bg-white border border-gray-100"
                style={cardShadow}
              >
                {driver?.drivers_license ? (
                  <View>
                    <TouchableOpacity
                      onPress={() => setPreviewImage(driver.drivers_license!)}
                      activeOpacity={0.9}
                    >
                      <Image
                        source={{ uri: driver.drivers_license }}
                        className="w-full h-40"
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handlePickLicense}
                      disabled={uploading === "license"}
                      className="flex-row items-center justify-center gap-2 py-3 border-t border-gray-100"
                    >
                      {uploading === "license" ? (
                        <ActivityIndicator size="small" color="#042F40" />
                      ) : (
                        <>
                          <Ionicons
                            name="document-outline"
                            size={14}
                            color="#042F40"
                          />
                          <Text className="text-primary text-xs font-semibold">
                            <T>Update License</T>
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="h-28 items-center justify-center bg-gray-50">
                    {uploading === "license" ? (
                      <ActivityIndicator size="large" color="#042F40" />
                    ) : (
                      <>
                        <View className="w-14 h-14 rounded-full bg-gray-50 items-center justify-center mb-3">
                          <Ionicons
                            name="document-text-outline"
                            size={24}
                            color="#D1D5DB"
                          />
                        </View>
                        <Text className="text-sm font-semibold text-gray-600">
                          <T>Upload License</T>
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1">
                          <T>Tap to select from gallery</T>
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </TouchableOpacity>
              {driver?.license_last_updated && (
                <View className="flex-row items-center gap-1.5 mt-2 ml-1">
                  <Ionicons name="time-outline" size={11} color="#9CA3AF" />
                  <Text className="text-[10px] text-gray-400">
                    <T>Last updated</T>{" "}
                    {new Date(driver.license_last_updated).toLocaleDateString(
                      "en-NG",
                      { day: "numeric", month: "long", year: "numeric" },
                    )}
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* ── Save Button (bottom) ───────────────────────────────── */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(300)}
              className="mx-5 mt-6"
            >
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
                className="bg-primary rounded-2xl py-4 items-center flex-row justify-center"
                style={{
                  shadowColor: "#042F40",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text className="text-white font-bold text-sm ml-2">
                      <T>Save Changes</T>
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── Image Preview Modal ─────────────────────────────────────── */}
      {previewImage && (
        <ImagePreviewModal
          visible={!!previewImage}
          uri={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </View>
  );
}
