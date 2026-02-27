import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useAuthStore } from "@/store/useAuthStore";
import { authApi } from "@/lib/api";
import { driverApi } from "@/lib/driverApi";
import { pickAndUploadImage } from "@/lib/cloudinary";
import { eventBus } from "@/lib/eventBus";
import { FadeIn, ImagePreviewModal } from "@/components/ui/animations";
import { useTranslations } from "@/hooks/use-translation";

/* ─── Section header ───────────────────────────────────────────────────────── */
function SectionTitle({
  icon,
  title,
  delay = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  delay?: number;
}) {
  return (
    <FadeIn delay={delay}>
      <View className="flex-row items-center gap-2 mb-2.5 px-1">
        <View className="w-6 h-6 rounded-lg bg-primary/10 items-center justify-center">
          <Ionicons name={icon} size={12} color="#042F40" />
        </View>
        <Text className="text-xs font-bold text-primary uppercase tracking-wider">
          {title}
        </Text>
      </View>
    </FadeIn>
  );
}

/* ─── Input field ──────────────────────────────────────────────────────────── */
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad";
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <View className="mb-3.5">
      <Text className="text-[11px] font-semibold text-gray-400 mb-1.5 ml-1">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-sm text-black"
        placeholder={placeholder}
        placeholderTextColor="#BCBFC4"
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? "top" : "center"}
        style={multiline ? { minHeight: 72 } : undefined}
      />
    </View>
  );
}

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

  const [
    tError,
    tFailedUploadPhoto,
    tFailedUploadVehicleImage,
    tFailedUpdateLicense,
    tInvalidDetails,
    tInvalidBankMsg,
    tPleaseWait,
    tRateLimitMsg,
    tVerificationFailed,
    tVerifyFailedMsg,
    tMissingInfo,
    tPhoneRequired,
    tSuccess,
    tProfileUpdated,
    tFailedUpdateProfile,
    tEditProfile,
    tContact,
    tPhoneNumber,
    tPhonePlaceholder,
    tBankDetails,
    tSelectBank,
    tChooseBank,
    tAccountNumber,
    tAccountPlaceholder,
    tVerify,
    tAccountName,
    tVehicleDetails,
    tColor,
    tColorPlaceholder,
    tSeats,
    tSeatsPlaceholder,
    tDescription,
    tDescriptionPlaceholder,
    tVehiclePhoto,
    tChangePhoto,
    tUploadVehiclePhoto,
    tTapToSelect,
    tDriversLicense,
    tUpdateLicense,
    tUploadLicense,
    tLastUpdated,
    tSaveChanges,
  ] = useTranslations([
    "Error",
    "Failed to upload photo",
    "Failed to upload vehicle image",
    "Failed to update license",
    "Invalid Details",
    "Please select a bank and enter a valid 10-digit account number.",
    "Please Wait",
    "The verification service is temporarily busy. Please wait a moment and try again.",
    "Verification Failed",
    "Could not verify this account. Please check the details.",
    "Missing Info",
    "Phone number is required.",
    "Success",
    "Profile updated successfully",
    "Failed to update profile",
    "Edit Profile",
    "Contact",
    "Phone Number",
    "+234 800 000 0000",
    "Bank Details",
    "Select Bank",
    "Choose your bank",
    "Account Number",
    "0123456789",
    "Verify",
    "Account Name",
    "Vehicle Details",
    "Color",
    "e.g. Silver",
    "Seats",
    "4",
    "Description",
    "Brief vehicle description...",
    "Vehicle Photo",
    "Change Photo",
    "Upload Vehicle Photo",
    "Tap to select from gallery",
    "Driver's License",
    "Update License",
    "Upload License",
    "Last updated",
    "Save Changes",
  ]);

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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView className="flex-1 bg-[#FAFBFC]">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {/* Header */}
          <FadeIn>
            <View className="flex-row items-center justify-between px-5 pt-3 pb-4 bg-white border-b border-gray-100">
              <Pressable
                onPress={() => router.back()}
                className="w-9 h-9 rounded-full bg-gray-50 items-center justify-center"
              >
                <Ionicons name="chevron-back" size={18} color="#042F40" />
              </Pressable>
              <Text className="text-primary text-[15px] font-bold">
                {tEditProfile}
              </Text>
              <View className="w-9" />
            </View>
          </FadeIn>

          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="px-5 pb-8"
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar */}
            <FadeIn delay={50}>
              <View className="items-center mt-5 mb-6">
                <Pressable
                  onPress={handlePickProfilePicture}
                  disabled={uploading === "profile"}
                >
                  <View className="relative">
                    {previewUri ? (
                      <Image
                        source={{ uri: previewUri }}
                        className="w-[88px] h-[88px] rounded-full border-[3px] border-white"
                        style={{
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.08,
                          shadowRadius: 8,
                        }}
                      />
                    ) : (
                      <View
                        className="w-[88px] h-[88px] rounded-full bg-primary items-center justify-center border-[3px] border-white"
                        style={{
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.08,
                          shadowRadius: 8,
                        }}
                      >
                        <Text className="text-white text-2xl font-bold">
                          {initials}
                        </Text>
                      </View>
                    )}
                    <View className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full bg-[#D4A017] items-center justify-center border-[2.5px] border-[#FAFBFC]">
                      {uploading === "profile" ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="camera" size={13} color="#fff" />
                      )}
                    </View>
                  </View>
                </Pressable>
                <Text className="text-primary text-base font-bold mt-3">
                  {user?.name}
                </Text>
                <Text className="text-gray-400 text-xs">{user?.email}</Text>
              </View>
            </FadeIn>

            {/* ── Contact ──────────────────────────────────────────────── */}
            <SectionTitle icon="call-outline" title={tContact} delay={100} />
            <FadeIn delay={120}>
              <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
                <Field
                  label={tPhoneNumber}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={tPhonePlaceholder}
                  keyboardType="phone-pad"
                />
              </View>
            </FadeIn>

            {/* ── Bank Details ─────────────────────────────────────────── */}
            <SectionTitle
              icon="card-outline"
              title={tBankDetails}
              delay={150}
            />
            <FadeIn delay={170}>
              <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
                {/* Bank selector — opens as page modal */}
                <Text className="text-[11px] font-semibold text-gray-400 mb-1.5 ml-1">
                  {tSelectBank}
                </Text>
                <Pressable
                  onPress={openBankPicker}
                  className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 mb-3.5 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center flex-1">
                    <View className="w-8 h-8 rounded-lg bg-primary/8 items-center justify-center mr-3">
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
                      {bankName || tChooseBank}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </Pressable>

                {/* Account number + verify */}
                <Text className="text-[11px] font-semibold text-gray-400 mb-1.5 ml-1">
                  {tAccountNumber}
                </Text>
                <View className="flex-row gap-2.5 mb-3">
                  <TextInput
                    value={accountNumber}
                    onChangeText={(t) => {
                      setAccountNumber(t.replace(/\D/g, ""));
                      setVerified(false);
                      setAccountHolder("");
                    }}
                    className="flex-1 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-sm text-black font-mono tracking-wider"
                    placeholder={tAccountPlaceholder}
                    placeholderTextColor="#BCBFC4"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  <Pressable
                    onPress={handleVerifyAccount}
                    disabled={
                      verifying || accountNumber.length !== 10 || !bankCode
                    }
                    className={`px-5 rounded-xl items-center justify-center ${
                      accountNumber.length === 10 && bankCode
                        ? "bg-[#D4A017]"
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
                          {tVerify}
                        </Text>
                      </View>
                    )}
                  </Pressable>
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
                        {tAccountName}
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
            </FadeIn>

            {/* ── Vehicle Details ──────────────────────────────────────── */}
            <SectionTitle
              icon="car-sport-outline"
              title={tVehicleDetails}
              delay={200}
            />
            <FadeIn delay={220}>
              <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Field
                      label={tColor}
                      value={vehicleColor}
                      onChangeText={setVehicleColor}
                      placeholder={tColorPlaceholder}
                    />
                  </View>
                  <View className="w-24">
                    <Field
                      label={tSeats}
                      value={availableSeats}
                      onChangeText={setAvailableSeats}
                      placeholder={tSeatsPlaceholder}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <Field
                  label={tDescription}
                  value={vehicleDescription}
                  onChangeText={setVehicleDescription}
                  placeholder={tDescriptionPlaceholder}
                  multiline
                />
              </View>
            </FadeIn>

            {/* ── Vehicle Photo ────────────────────────────────────────── */}
            <SectionTitle
              icon="image-outline"
              title={tVehiclePhoto}
              delay={250}
            />
            <FadeIn delay={270}>
              <Pressable
                onPress={handlePickVehicleImage}
                disabled={uploading === "vehicle"}
                className="mb-6"
              >
                {driver?.vehicle_image ? (
                  <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <Pressable
                      onPress={() => setPreviewImage(driver.vehicle_image!)}
                    >
                      <Image
                        source={{ uri: driver.vehicle_image }}
                        className="w-full"
                        style={{ height: 200 }}
                        resizeMode="cover"
                      />
                    </Pressable>
                    <Pressable
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
                            {tChangePhoto}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ) : (
                  <View className="bg-white rounded-2xl border-2 border-dashed border-gray-200 items-center justify-center py-10">
                    {uploading === "vehicle" ? (
                      <ActivityIndicator size="large" color="#042F40" />
                    ) : (
                      <>
                        <View className="w-14 h-14 rounded-full bg-gray-50 items-center justify-center mb-3">
                          <Ionicons
                            name="car-outline"
                            size={26}
                            color="#D1D5DB"
                          />
                        </View>
                        <Text className="text-gray-500 text-sm font-medium">
                          {tUploadVehiclePhoto}
                        </Text>
                        <Text className="text-gray-300 text-xs mt-1">
                          {tTapToSelect}
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </Pressable>
            </FadeIn>

            {/* ── Driver's License ─────────────────────────────────────── */}
            <SectionTitle
              icon="document-text-outline"
              title={tDriversLicense}
              delay={300}
            />
            <FadeIn delay={320}>
              <View className="mb-6">
                <Pressable
                  onPress={handlePickLicense}
                  disabled={uploading === "license"}
                >
                  {driver?.drivers_license ? (
                    <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <Pressable
                        onPress={() => setPreviewImage(driver.drivers_license!)}
                      >
                        <Image
                          source={{ uri: driver.drivers_license }}
                          className="w-full"
                          style={{ height: 200 }}
                          resizeMode="contain"
                        />
                      </Pressable>
                      <Pressable
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
                              {tUpdateLicense}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  ) : (
                    <View className="bg-white rounded-2xl border-2 border-dashed border-gray-200 items-center justify-center py-10">
                      {uploading === "license" ? (
                        <ActivityIndicator size="large" color="#042F40" />
                      ) : (
                        <>
                          <View className="w-14 h-14 rounded-full bg-gray-50 items-center justify-center mb-3">
                            <Ionicons
                              name="document-text-outline"
                              size={26}
                              color="#D1D5DB"
                            />
                          </View>
                          <Text className="text-gray-500 text-sm font-medium">
                            {tUploadLicense}
                          </Text>
                          <Text className="text-gray-300 text-xs mt-1">
                            {tTapToSelect}
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                </Pressable>
                {driver?.license_last_updated && (
                  <View className="flex-row items-center gap-1.5 mt-2 ml-1">
                    <Ionicons name="time-outline" size={11} color="#9CA3AF" />
                    <Text className="text-[10px] text-gray-400">
                      {tLastUpdated}{" "}
                      {new Date(driver.license_last_updated).toLocaleDateString(
                        "en-NG",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </Text>
                  </View>
                )}
              </View>
            </FadeIn>
          </ScrollView>

          {/* Save Button */}
          <FadeIn delay={350}>
            <View className="px-5 pb-5 pt-2 bg-[#FAFBFC] border-t border-gray-100">
              <Pressable
                onPress={handleSave}
                disabled={saving}
                className="w-full py-4 rounded-2xl items-center bg-primary active:opacity-90"
                style={{
                  shadowColor: "#042F40",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white text-[15px] font-bold">
                    {tSaveChanges}
                  </Text>
                )}
              </Pressable>
            </View>
          </FadeIn>
        </KeyboardAvoidingView>

        {/* ── Image Preview Modal ─────────────────────────────────────── */}
        {previewImage && (
          <ImagePreviewModal
            visible={!!previewImage}
            uri={previewImage}
            onClose={() => setPreviewImage(null)}
          />
        )}
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}
