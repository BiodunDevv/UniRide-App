import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useRideStore } from "@/store/useRideStore";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { T } from "@/hooks/use-translation";

// ─────────────────────────────────────────────────────────────────────────────
export default function RequestRideScreen() {
  const router = useRouter();
  const { selectedPickup, selectedDestination, createRide, isCreatingRide } =
    useRideStore();
  const { settings } = usePlatformSettingsStore();

  const [seats, setSeats] = useState(1);
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("cash");
  const [departure, setDeparture] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 15);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const maxSeats = settings.max_seats_per_booking || 4;
  const farePolicy = settings.fare_policy;
  const farePerSeat = farePolicy?.minimum_fare ?? farePolicy?.base_fare ?? 0;
  const totalFare = settings.fare_per_seat ? farePerSeat * seats : farePerSeat;

  const canSubmit = !!(
    selectedPickup &&
    selectedDestination &&
    !isCreatingRide
  );

  // ── Submit ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedPickup || !selectedDestination) {
      Alert.alert("Missing Info", "Please select pickup and destination.");
      return;
    }
    try {
      const body: any = {
        pickup_location_id: selectedPickup._id,
        destination_id: selectedDestination._id,
        departure_time: departure.toISOString(),
        available_seats: maxSeats,
        seats_requested: seats,
        payment_method: payMethod,
      };
      // Fare is determined by admin fare policy on the backend
      const res = await createRide(body);
      Alert.alert(
        "Ride Requested!",
        "Your ride request has been created. A driver will pick it up soon.",
        [{ text: "OK", onPress: () => router.replace("/(users)/activity") }],
      );
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.response?.data?.message || e?.message || "Failed to create request",
      );
    }
  };

  // Guard: setting must be on
  if (!settings.allow_ride_without_driver) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Ionicons name="close-circle-outline" size={64} color="#9CA3AF" />
        <Text className="text-gray-400 text-center mt-4">
          <T>Ride requests are currently disabled.</T>
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-primary rounded-xl px-6 py-3"
        >
          <Text className="text-white font-semibold">
            <T>Go Back</T>
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Guard: pickup/destination must be set
  if (!selectedPickup || !selectedDestination) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Ionicons name="location-outline" size={64} color="#9CA3AF" />
        <Text className="text-gray-400 text-center mt-4">
          <T>Please select a pickup and destination first.</T>
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-primary rounded-xl px-6 py-3"
        >
          <Text className="text-white font-semibold">
            <T>Go Back</T>
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* ── Header ─────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="px-5 pt-3 pb-2 flex-row items-center"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
          >
            <Ionicons name="arrow-back" size={20} color="#042F40" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900 flex-1">
            <T>Request a Ride</T>
          </Text>
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 140 }}
          >
            {/* ── Route Card ──────────────────────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(100).duration(300)}
              className="mx-5 mt-3 bg-gray-50 rounded-2xl p-4"
            >
              <View className="flex-row items-start">
                <View className="items-center mr-3 mt-1">
                  <View className="w-3 h-3 rounded-full bg-green-500" />
                  <View className="w-0.5 h-10 bg-gray-300 my-1" />
                  <View className="w-3 h-3 rounded-full bg-red-500" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-800">
                    {selectedPickup.short_name || selectedPickup.name}
                  </Text>
                  <Text className="text-xs text-gray-400 mb-5">
                    {selectedPickup.address}
                  </Text>
                  <Text className="text-sm font-semibold text-gray-800">
                    {selectedDestination.short_name || selectedDestination.name}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {selectedDestination.address}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* ── Fare Display (admin-set) ───────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(120).duration(300)}
              className="mx-5 mt-3 bg-gray-50 rounded-2xl p-4"
            >
              <Text className="text-xs font-semibold text-gray-400 uppercase mb-3">
                {settings.fare_per_seat ? (
                  <T>Fare per Seat</T>
                ) : (
                  <T>Ride Fare</T>
                )}
              </Text>
              {farePerSeat > 0 ? (
                <View className="bg-primary/5 rounded-xl p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Ionicons name="cash-outline" size={20} color="#042F40" />
                      <Text className="text-lg font-bold text-primary ml-2">
                        ₦{farePerSeat.toLocaleString()}
                      </Text>
                      {settings.fare_per_seat && (
                        <Text className="text-xs text-gray-400 ml-1">
                          /seat
                        </Text>
                      )}
                    </View>
                    {settings.fare_per_seat && seats > 0 && (
                      <View className="bg-primary/10 rounded-lg px-3 py-1.5">
                        <Text className="text-sm font-bold text-primary">
                          ₦{totalFare.toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </View>
                  {settings.fare_per_seat && seats > 1 && (
                    <Text className="text-xs text-gray-400 mt-2">
                      ₦{farePerSeat.toLocaleString()} × {seats}{" "}
                      {seats === 1 ? "seat" : "seats"} = ₦
                      {totalFare.toLocaleString()}
                    </Text>
                  )}
                </View>
              ) : (
                <View className="bg-gray-100 rounded-xl p-3 flex-row items-center">
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color="#9CA3AF"
                  />
                  <Text className="text-xs text-gray-400 ml-2">
                    <T>Fare will be set by the administrator</T>
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* ── Departure Time ──────────────────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(170).duration(300)}
              className="mx-5 mt-3 bg-gray-50 rounded-2xl p-4"
            >
              <Text className="text-xs font-semibold text-gray-400 uppercase mb-3">
                <T>Departure Time</T>
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="flex-1 flex-row items-center bg-white rounded-xl px-3 py-3 border border-gray-200"
                >
                  <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                  <Text className="ml-2 text-sm text-gray-700">
                    {departure.toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowTimePicker(true)}
                  className="flex-1 flex-row items-center bg-white rounded-xl px-3 py-3 border border-gray-200"
                >
                  <Ionicons name="time-outline" size={18} color="#6B7280" />
                  <Text className="ml-2 text-sm text-gray-700">
                    {departure.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
              {(showDatePicker || showTimePicker) && (
                <DateTimePicker
                  value={departure}
                  mode={showDatePicker ? "date" : "time"}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    setShowTimePicker(false);
                    if (date) setDeparture(date);
                  }}
                />
              )}
            </Animated.View>

            {/* ── Seat Selector ────────────────────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(220).duration(300)}
              className="mx-5 mt-3 bg-gray-50 rounded-2xl p-4"
            >
              <Text className="text-xs font-semibold text-gray-400 uppercase mb-3">
                <T>How many seats do you need?</T>
              </Text>
              <View className="flex-row items-center justify-center gap-6">
                <TouchableOpacity
                  onPress={() => setSeats(Math.max(1, seats - 1))}
                  className="w-10 h-10 rounded-full bg-white border border-gray-200 items-center justify-center"
                >
                  <Ionicons name="remove" size={18} color="#042F40" />
                </TouchableOpacity>
                <View className="w-16 h-16 rounded-2xl bg-primary items-center justify-center">
                  <Text className="text-2xl font-bold text-white">{seats}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSeats(Math.min(maxSeats, seats + 1))}
                  className="w-10 h-10 rounded-full bg-white border border-gray-200 items-center justify-center"
                >
                  <Ionicons name="add" size={18} color="#042F40" />
                </TouchableOpacity>
              </View>
              <Text className="text-xs text-gray-400 text-center mt-2">
                <T>Max</T> {maxSeats} <T>seats per booking</T>
              </Text>
            </Animated.View>

            {/* ── Payment Method ───────────────────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(270).duration(300)}
              className="mx-5 mt-3 bg-gray-50 rounded-2xl p-4"
            >
              <Text className="text-xs font-semibold text-gray-400 uppercase mb-3">
                <T>Payment Method</T>
              </Text>
              <View className="flex-row gap-3">
                {(["cash", "transfer"] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setPayMethod(m)}
                    className={`flex-1 py-4 rounded-xl flex-row items-center justify-center border ${
                      payMethod === m
                        ? "bg-primary border-primary"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <Ionicons
                      name={m === "cash" ? "cash-outline" : "card-outline"}
                      size={20}
                      color={payMethod === m ? "#fff" : "#6B7280"}
                    />
                    <Text
                      className={`ml-2 text-sm font-semibold ${
                        payMethod === m ? "text-white" : "text-gray-600"
                      }`}
                    >
                      {m === "cash" ? "Cash" : "Transfer"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>

            {/* ── Info Note ────────────────────────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(320).duration(300)}
              className="mx-5 mt-4 bg-blue-50 rounded-2xl p-4 flex-row items-start border border-blue-100"
            >
              <Ionicons
                name="information-circle"
                size={20}
                color="#2563EB"
                style={{ marginTop: 1 }}
              />
              <Text className="text-xs text-blue-700 ml-3 flex-1 leading-5">
                <T>
                  Your ride request will be visible to all drivers. Once a
                  driver accepts, you'll be notified and your ride will begin.
                </T>
              </Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Bottom CTA ──────────────────────────────────────────── */}
        <SafeAreaView
          edges={["bottom"]}
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3"
        >
          <Animated.View entering={FadeInDown.duration(300)}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              className={`rounded-2xl py-4 items-center mb-2 ${
                canSubmit ? "bg-primary" : "bg-gray-200"
              }`}
            >
              {isCreatingRide ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  className={`font-bold text-base ${
                    canSubmit ? "text-white" : "text-gray-400"
                  }`}
                >
                  <T>Submit Ride Request</T>
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );
}
