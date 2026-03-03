import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import * as WebBrowser from "expo-web-browser";

import { useAuthStore } from "@/store/useAuthStore";
import { driverApi } from "@/lib/driverApi";
import { pickAndUploadImage } from "@/lib/cloudinary";
import { T } from "@/hooks/use-translation";

export default function VehicleInfoScreen() {
  const router = useRouter();
  const { user, fetchMe } = useAuthStore();
  const driver = user?.driver;

  const [vehicleModel] = useState(driver?.vehicle_model || "");
  const [plateNumber] = useState(driver?.plate_number || "");
  const [vehicleColor, setVehicleColor] = useState(driver?.vehicle_color || "");
  const [vehicleDescription, setVehicleDescription] = useState(
    driver?.vehicle_description || "",
  );
  const [vehicleImage, setVehicleImage] = useState(driver?.vehicle_image || "");
  const [availableSeats, setAvailableSeats] = useState(
    String(driver?.available_seats || 4),
  );
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const hasChanges =
    vehicleColor !== (driver?.vehicle_color || "") ||
    vehicleDescription !== (driver?.vehicle_description || "") ||
    vehicleImage !== (driver?.vehicle_image || "") ||
    availableSeats !== String(driver?.available_seats || 4);

  const handlePickImage = useCallback(async () => {
    try {
      setUploadingImage(true);
      const result = await pickAndUploadImage("uniride/vehicles");
      if (result) {
        setVehicleImage(result.secure_url);
        // Also update the vehicle image on the backend immediately
        await driverApi.updateVehicleImage({
          vehicle_image: result.secure_url,
        });
      }
    } catch (err: any) {
      Alert.alert("Upload Failed", err?.message || "Could not upload image");
    } finally {
      setUploadingImage(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;

    const seats = parseInt(availableSeats, 10);
    if (isNaN(seats) || seats < 1 || seats > 8) {
      Alert.alert("Invalid", "Available seats must be between 1 and 8");
      return;
    }

    setSaving(true);
    try {
      await driverApi.updateProfile({
        vehicle_color: vehicleColor.trim(),
        vehicle_description: vehicleDescription.trim(),
        available_seats: seats,
        ...(vehicleImage !== (driver?.vehicle_image || "")
          ? { vehicle_image: vehicleImage }
          : {}),
      });
      await fetchMe();
      Alert.alert("Success", "Vehicle info updated successfully");
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to update vehicle info");
    } finally {
      setSaving(false);
    }
  }, [
    vehicleColor,
    vehicleDescription,
    availableSeats,
    vehicleImage,
    hasChanges,
    driver,
    fetchMe,
    router,
  ]);

  return (
    <View className="flex-1 bg-gray-50">
      <SafeAreaView edges={["top"]} className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {/* Header */}
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
                    <T>Vehicle Info</T>
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    <T>Manage your vehicle details</T>
                  </Text>
                </View>
              </View>
              {hasChanges && (
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
              )}
            </View>
          </Animated.View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Vehicle Image Section */}
            <Animated.View
              entering={FadeInUp.delay(100).duration(400)}
              className="mx-5 mt-5"
            >
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={uploadingImage}
                activeOpacity={0.8}
                className="rounded-2xl overflow-hidden bg-white border border-gray-200"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                }}
              >
                {vehicleImage ? (
                  <View>
                    <Image
                      source={{ uri: vehicleImage }}
                      className="w-full h-48"
                      resizeMode="cover"
                    />
                    <View className="absolute inset-0 bg-black/20 items-center justify-center">
                      {uploadingImage ? (
                        <ActivityIndicator size="large" color="#fff" />
                      ) : (
                        <View className="bg-white/90 rounded-full px-4 py-2 flex-row items-center">
                          <Ionicons
                            name="camera-outline"
                            size={16}
                            color="#042F40"
                          />
                          <Text className="text-xs font-semibold text-primary ml-1.5">
                            <T>Change Photo</T>
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <View className="h-48 items-center justify-center bg-gray-50">
                    {uploadingImage ? (
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

            {/* Read-Only Info (Vehicle Model & Plate) */}
            <Animated.View
              entering={FadeInUp.delay(200).duration(400)}
              className="mx-5 mt-5"
            >
              <View className="flex-row items-center gap-2 mb-3 px-1">
                <View className="w-6 h-6 rounded-lg bg-primary/10 items-center justify-center">
                  <Ionicons name="car" size={12} color="#042F40" />
                </View>
                <Text className="text-xs font-bold text-primary uppercase tracking-wider">
                  <T>Vehicle Details</T>
                </Text>
              </View>

              <View
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                }}
              >
                {/* Vehicle Model */}
                <View className="px-4 py-3.5 border-b border-gray-50">
                  <Text className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    <T>Model</T>
                  </Text>
                  <View className="flex-row items-center">
                    <Ionicons
                      name="car-sport-outline"
                      size={16}
                      color="#6B7280"
                    />
                    <Text className="text-sm font-medium text-gray-900 ml-2">
                      {vehicleModel || "Not set"}
                    </Text>
                  </View>
                </View>

                {/* Plate Number */}
                <View className="px-4 py-3.5 border-b border-gray-50">
                  <Text className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    <T>Plate Number</T>
                  </Text>
                  <View className="flex-row items-center">
                    <Ionicons name="card-outline" size={16} color="#6B7280" />
                    <Text className="text-sm font-bold text-gray-900 ml-2 tracking-widest">
                      {plateNumber || "Not set"}
                    </Text>
                  </View>
                </View>

                {/* Rating */}
                <View className="px-4 py-3.5">
                  <Text className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    <T>Rating</T>
                  </Text>
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={16} color="#D4A017" />
                    <Text className="text-sm font-medium text-gray-900 ml-2">
                      {driver?.rating?.toFixed(1) || "0.0"}
                    </Text>
                    <Text className="text-xs text-gray-400 ml-1">
                      ({driver?.total_ratings || 0}{" "}
                      {(driver?.total_ratings || 0) === 1
                        ? "rating"
                        : "ratings"}
                      )
                    </Text>
                  </View>
                </View>
              </View>

              <Text className="text-[10px] text-gray-400 mt-2 ml-1">
                <T>Vehicle model and plate number can only be changed by</T>{" "}
                <Text
                  className="text-primary font-semibold underline"
                  onPress={() =>
                    WebBrowser.openBrowserAsync(
                      `${process.env.EXPO_PUBLIC_WEB_URL || "http://localhost:3000"}/support`,
                      {
                        presentationStyle:
                          WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                        controlsColor: "#042F40",
                        toolbarColor: "#FFFFFF",
                      },
                    )
                  }
                >
                  <T>contacting support</T>
                </Text>
                .
              </Text>
            </Animated.View>

            {/* Editable Fields */}
            <Animated.View
              entering={FadeInUp.delay(300).duration(400)}
              className="mx-5 mt-6"
            >
              <View className="flex-row items-center gap-2 mb-3 px-1">
                <View className="w-6 h-6 rounded-lg bg-accent/10 items-center justify-center">
                  <Ionicons name="create" size={12} color="#D4A017" />
                </View>
                <Text className="text-xs font-bold text-accent uppercase tracking-wider">
                  <T>Editable Info</T>
                </Text>
              </View>

              <View
                className="bg-white rounded-2xl border border-gray-100 p-4"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                }}
              >
                {/* Vehicle Color */}
                <View className="mb-4">
                  <Text className="text-[11px] font-semibold text-gray-400 mb-1.5 ml-1">
                    <T>Vehicle Color</T>
                  </Text>
                  <TextInput
                    value={vehicleColor}
                    onChangeText={setVehicleColor}
                    placeholder="e.g. White, Black, Silver"
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
                    placeholder="Describe your vehicle (e.g. A/C available, clean interior...)"
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

            {/* Driver's License */}
            <Animated.View
              entering={FadeInUp.delay(400).duration(400)}
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

              <View
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                }}
              >
                {driver?.drivers_license ? (
                  <Image
                    source={{ uri: driver.drivers_license }}
                    className="w-full h-40"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-28 items-center justify-center bg-gray-50">
                    <Ionicons
                      name="document-text-outline"
                      size={28}
                      color="#D1D5DB"
                    />
                    <Text className="text-xs text-gray-400 mt-2">
                      <T>No license uploaded</T>
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-[10px] text-gray-400 mt-2 ml-1">
                <T>To update your driver's license, please</T>{" "}
                <Text
                  className="text-primary font-semibold underline"
                  onPress={() =>
                    WebBrowser.openBrowserAsync(
                      `${process.env.EXPO_PUBLIC_WEB_URL || "http://localhost:3000"}/support`,
                      {
                        presentationStyle:
                          WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                        controlsColor: "#042F40",
                        toolbarColor: "#FFFFFF",
                      },
                    )
                  }
                >
                  <T>contact support</T>
                </Text>
                .
              </Text>
            </Animated.View>

            {/* Save Button (also at bottom for easy access) */}
            {hasChanges && (
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
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#fff"
                      />
                      <Text className="text-white font-bold text-sm ml-2">
                        <T>Save Changes</T>
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
