import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  BackHandler,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { useRideStore, CampusLocation } from "@/store/useRideStore";
import { useLocationStore } from "@/store/useLocationStore";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { T } from "@/hooks/use-translation";

const STEPS = ["pickup", "destination", "details"] as const;
type Step = (typeof STEPS)[number];

const CATEGORIES = [
  { key: "all", label: "All", icon: "grid" },
  { key: "academic", label: "Academic", icon: "school" },
  { key: "hostel", label: "Hostels", icon: "bed" },
  { key: "cafeteria", label: "Cafeteria", icon: "restaurant" },
  { key: "admin_building", label: "Admin", icon: "business" },
  { key: "library", label: "Library", icon: "library" },
  { key: "market", label: "Markets", icon: "cart" },
  { key: "other", label: "Other", icon: "location" },
] as const;

export default function CreateRideScreen() {
  const router = useRouter();
  const { campusLocations, fetchLocations, createRide, isCreatingRide } =
    useRideStore();
  const { isDriverOnline } = useLocationStore();
  const { settings } = usePlatformSettingsStore();

  // If driver navigates here while offline, bounce them back
  useEffect(() => {
    if (!isDriverOnline) {
      Alert.alert("Go Online First", "You need to be online to create rides.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, []);

  const [step, setStep] = useState<Step>("pickup");
  const [pickup, setPickup] = useState<CampusLocation | null>(null);
  const [destination, setDestination] = useState<CampusLocation | null>(null);
  const [fare, setFare] = useState("");
  const [seats, setSeats] = useState(4);
  const [departureTime, setDepartureTime] = useState(
    new Date(Date.now() + 15 * 60000),
  );

  const farePolicy = settings.fare_policy;
  const isAdminFare = farePolicy?.mode === "admin";
  const suggestedFare = farePolicy?.minimum_fare ?? farePolicy?.base_fare ?? 0;
  const fareNum = fare ? Number(fare) : 0;
  const totalFarePreview = settings.fare_per_seat ? fareNum * seats : fareNum;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  // Auto-fill and lock fare when admin controls pricing
  useEffect(() => {
    if (isAdminFare && suggestedFare > 0) {
      setFare(String(suggestedFare));
    }
  }, [isAdminFare, suggestedFare]);

  // Date/time picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date(Date.now() + 15 * 60000));

  useEffect(() => {
    if (campusLocations.length === 0) fetchLocations();
  }, []);

  // ── Back handler ──────────────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const idx = STEPS.indexOf(step);
      if (idx > 0) {
        setStep(STEPS[idx - 1]);
        setQuery("");
        return true;
      }
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [step]);

  // ── Filtered locations ────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = campusLocations.filter((l) => l.is_active);
    if (category !== "all") list = list.filter((l) => l.category === category);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.short_name?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [campusLocations, category, query]);

  const selectLocation = (loc: CampusLocation) => {
    if (step === "pickup") {
      setPickup(loc);
      setStep("destination");
      setQuery("");
      setCategory("all");
    } else if (step === "destination") {
      setDestination(loc);
      setStep("details");
      setQuery("");
    }
  };

  // ── Date/Time picker handlers ─────────────────────────────────────
  const openPicker = () => {
    setTempDate(new Date(departureTime));
    if (Platform.OS === "ios") {
      setShowIOSPicker(true);
    } else {
      setShowDatePicker(true);
    }
  };

  const onAndroidDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowDatePicker(false);
    if (event.type === "dismissed") return;
    if (selectedDate) {
      setTempDate(selectedDate);
      // After picking date, show time picker
      setTimeout(() => setShowTimePicker(true), 300);
    }
  };

  const onAndroidTimeChange = (
    event: DateTimePickerEvent,
    selectedTime?: Date,
  ) => {
    setShowTimePicker(false);
    if (event.type === "dismissed") return;
    if (selectedTime) {
      // Combine tempDate (date part) with selectedTime (time part)
      const combined = new Date(tempDate);
      combined.setHours(selectedTime.getHours());
      combined.setMinutes(selectedTime.getMinutes());
      combined.setSeconds(0);
      combined.setMilliseconds(0);
      setDepartureTime(combined);
    }
  };

  const onIOSDateChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const confirmIOSDate = () => {
    setDepartureTime(tempDate);
    setShowIOSPicker(false);
  };

  const cancelIOSDate = () => {
    setShowIOSPicker(false);
  };

  const handleCreate = async () => {
    if (!pickup || !destination) {
      Alert.alert("Error", "Select pickup and destination");
      return;
    }
    try {
      const body: any = {
        pickup_location_id: pickup._id,
        destination_id: destination._id,
        available_seats: seats,
        departure_time: departureTime.toISOString(),
      };
      if (fare) body.fare = Number(fare);
      await createRide(body);
      Alert.alert("Ride Created!", "Your ride is now visible to passengers.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.response?.data?.message || e?.message || "Failed",
      );
    }
  };

  const stepIdx = STEPS.indexOf(step);

  // ═════════════════════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* ── Header ─────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="px-5 pt-3 pb-2"
        >
          <View className="flex-row items-center mb-3">
            <TouchableOpacity
              onPress={() => {
                if (stepIdx > 0) {
                  setStep(STEPS[stepIdx - 1]);
                  setQuery("");
                } else router.back();
              }}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={20} color="#042F40" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-gray-900 flex-1">
              <T>Create Ride</T>
            </Text>
            <Text className="text-xs text-gray-400">{stepIdx + 1}/3</Text>
          </View>

          {/* Progress */}
          <View className="flex-row gap-2 mb-3">
            {STEPS.map((s, i) => (
              <View
                key={s}
                className={`flex-1 h-1 rounded-full ${i <= stepIdx ? "bg-primary" : "bg-gray-200"}`}
              />
            ))}
          </View>

          {/* Route Summary */}
          <View className="bg-gray-50 rounded-xl p-3 mb-3">
            <View className="flex-row items-center mb-1">
              <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2" />
              <Text className="text-xs text-gray-600 flex-1" numberOfLines={1}>
                {pickup ? pickup.short_name || pickup.name : "Pickup"}
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2" />
              <Text className="text-xs text-gray-600 flex-1" numberOfLines={1}>
                {destination
                  ? destination.short_name || destination.name
                  : "Destination"}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Location Selection (Steps 1 & 2) ───────────────────── */}
        {(step === "pickup" || step === "destination") && (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1"
          >
            <Animated.View
              entering={FadeInUp.delay(100).duration(300)}
              className="px-5"
            >
              <Text className="text-xs font-semibold text-accent mb-2 uppercase tracking-wider">
                {step === "pickup" ? (
                  <T>Select Pickup</T>
                ) : (
                  <T>Select Destination</T>
                )}
              </Text>
              <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-2.5 mb-2">
                <Ionicons name="search" size={18} color="#9CA3AF" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search..."
                  placeholderTextColor="#9CA3AF"
                  className="flex-1 ml-2 text-sm text-gray-800"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="px-5 mb-2 max-h-10"
            >
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  className={`mr-2 px-3 py-1.5 rounded-full flex-row items-center ${category === c.key ? "bg-primary" : "bg-gray-100"}`}
                >
                  <Ionicons
                    name={c.icon as any}
                    size={12}
                    color={category === c.key ? "#fff" : "#6B7280"}
                  />
                  <Text
                    className={`ml-1.5 text-xs font-medium ${category === c.key ? "text-white" : "text-gray-600"}`}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView
              className="flex-1 px-5"
              showsVerticalScrollIndicator={false}
            >
              {filtered.map((loc, idx) => {
                const isSel =
                  (step === "pickup" && pickup?._id === loc._id) ||
                  (step === "destination" && destination?._id === loc._id);
                return (
                  <Animated.View
                    key={loc._id}
                    entering={FadeInDown.delay(idx * 20).duration(200)}
                  >
                    <TouchableOpacity
                      onPress={() => selectLocation(loc)}
                      className={`flex-row items-center py-3 px-3 rounded-xl mb-1 ${isSel ? "bg-primary/10" : ""}`}
                    >
                      <View
                        className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${isSel ? "bg-primary" : "bg-gray-100"}`}
                      >
                        <Ionicons
                          name={isSel ? "checkmark" : ("location" as any)}
                          size={14}
                          color={isSel ? "#fff" : "#042F40"}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-gray-800">
                          {loc.short_name || loc.name}
                        </Text>
                        {loc.address && (
                          <Text className="text-xs text-gray-400">
                            {loc.address}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
              <View className="h-20" />
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ── Details (Step 3) ────────────────────────────────────── */}
        {step === "details" && (
          <ScrollView
            className="flex-1 px-5"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            <Animated.View entering={FadeInUp.delay(100).duration(300)}>
              {/* Fare */}
              <Text className="text-xs font-semibold text-gray-400 uppercase mt-2 mb-2 tracking-wider">
                {settings.fare_per_seat ? (
                  <T>Fare per Seat (₦)</T>
                ) : (
                  <T>Ride Fare — Flat (₦)</T>
                )}
              </Text>
              <View
                className={`rounded-xl px-4 py-3 flex-row items-center mb-1 ${isAdminFare ? "bg-primary/5 border border-primary/20" : "bg-gray-50"}`}
              >
                <Ionicons
                  name={isAdminFare ? "lock-closed" : "cash-outline"}
                  size={18}
                  color={isAdminFare ? "#042F40" : "#6B7280"}
                />
                <TextInput
                  value={fare}
                  onChangeText={setFare}
                  placeholder={
                    suggestedFare
                      ? `Suggested: ₦${suggestedFare}`
                      : "Leave empty for auto"
                  }
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  editable={!isAdminFare}
                  className={`flex-1 ml-3 text-sm ${isAdminFare ? "text-primary font-semibold" : "text-gray-800"}`}
                />
                {isAdminFare ? (
                  <View className="bg-primary/10 rounded-lg px-2.5 py-1">
                    <Text className="text-[10px] font-bold text-primary uppercase">
                      <T>Set by Admin</T>
                    </Text>
                  </View>
                ) : (
                  suggestedFare > 0 &&
                  !fare && (
                    <TouchableOpacity
                      onPress={() => setFare(String(suggestedFare))}
                      className="bg-accent/15 rounded-lg px-2.5 py-1"
                    >
                      <Text className="text-xs font-semibold text-accent">
                        <T>Use</T> ₦{suggestedFare}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              {/* Fare info / preview */}
              <View className="mb-4 ml-1">
                {isAdminFare ? (
                  <Text className="text-xs text-primary/70">
                    <T>
                      Fare is controlled by admin policy and cannot be changed
                    </T>
                  </Text>
                ) : settings.fare_per_seat ? (
                  <Text className="text-xs text-accent">
                    <T>Fare is per seat</T>
                    {fareNum > 0 && (
                      <>
                        {"  ·  "}
                        <T>Total for</T> {seats} <T>seats</T>: ₦
                        {totalFarePreview.toLocaleString()}
                      </>
                    )}
                  </Text>
                ) : (
                  <Text className="text-xs text-gray-400">
                    <T>Flat fare — same price regardless of seats booked</T>
                  </Text>
                )}
                {!isAdminFare && !fare && suggestedFare > 0 && (
                  <Text className="text-xs text-gray-400 mt-0.5">
                    <T>{`If empty, admin fare policy (₦${suggestedFare}) will be used`}</T>
                  </Text>
                )}
              </View>

              {/* Seats */}
              <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">
                <T>Available Seats</T>
              </Text>
              <View className="flex-row items-center justify-center bg-gray-50 rounded-xl py-3 mb-4">
                <TouchableOpacity
                  onPress={() => setSeats(Math.max(1, seats - 1))}
                  className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center"
                >
                  <Ionicons name="remove" size={18} color="#042F40" />
                </TouchableOpacity>
                <Text className="text-3xl font-bold text-primary mx-8">
                  {seats}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setSeats(
                      Math.min(settings.max_seats_per_booking || 10, seats + 1),
                    )
                  }
                  className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center"
                >
                  <Ionicons name="add" size={18} color="#042F40" />
                </TouchableOpacity>
              </View>

              {/* Departure Time */}
              <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">
                <T>Departure Time</T>
              </Text>
              <TouchableOpacity
                onPress={openPicker}
                className="bg-gray-50 rounded-xl px-4 py-3.5 flex-row items-center mb-4"
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={18} color="#6B7280" />
                <View className="flex-1 ml-3">
                  <Text className="text-sm text-gray-800 font-medium">
                    {departureTime.toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    {departureTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                <View className="bg-primary/10 rounded-lg px-3 py-1.5">
                  <Text className="text-xs font-semibold text-primary">
                    Change
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Android Date Picker */}
              {Platform.OS === "android" && showDatePicker && (
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={onAndroidDateChange}
                  display="default"
                />
              )}

              {/* Android Time Picker */}
              {Platform.OS === "android" && showTimePicker && (
                <DateTimePicker
                  value={tempDate}
                  mode="time"
                  minimumDate={new Date()}
                  onChange={onAndroidTimeChange}
                  display="default"
                  is24Hour={false}
                />
              )}
            </Animated.View>
          </ScrollView>
        )}

        {/* ── iOS DateTime Picker Modal ──────────────────────────── */}
        {Platform.OS === "ios" && (
          <Modal
            visible={showIOSPicker}
            transparent
            animationType="slide"
            onRequestClose={cancelIOSDate}
          >
            <View className="flex-1 justify-end">
              <TouchableOpacity
                className="flex-1"
                activeOpacity={1}
                onPress={cancelIOSDate}
              />
              <View className="bg-white rounded-t-3xl shadow-2xl">
                <View className="flex-row items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100">
                  <TouchableOpacity onPress={cancelIOSDate}>
                    <Text className="text-base text-gray-500 font-medium">
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <Text className="text-base font-bold text-gray-900">
                    Select Date & Time
                  </Text>
                  <TouchableOpacity onPress={confirmIOSDate}>
                    <Text className="text-base text-primary font-bold">
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
                <View className="px-5 py-4 items-center">
                  <DateTimePicker
                    value={tempDate}
                    mode="datetime"
                    minimumDate={new Date()}
                    onChange={onIOSDateChange}
                    display="spinner"
                    style={{ height: 200, width: "100%" }}
                    textColor="#042F40"
                  />
                </View>
                <View className="px-5 pb-8 pt-2">
                  <View className="bg-gray-50 rounded-xl p-3 flex-row items-center">
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#6B7280"
                    />
                    <Text className="text-sm text-gray-700 ml-2 font-medium">
                      {tempDate.toLocaleDateString([], {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}{" "}
                      at{" "}
                      {tempDate.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* ── Create Button ──────────────────────────────────────── */}
        {step === "details" && (
          <SafeAreaView
            edges={["bottom"]}
            className="px-5 pt-3 border-t border-gray-100 bg-white"
          >
            <TouchableOpacity
              onPress={handleCreate}
              disabled={isCreatingRide || !pickup || !destination}
              className={`rounded-2xl py-4 items-center mb-2 ${pickup && destination ? "bg-primary" : "bg-gray-200"}`}
            >
              {isCreatingRide ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">
                  <T>Create Ride</T>
                </Text>
              )}
            </TouchableOpacity>
          </SafeAreaView>
        )}
      </SafeAreaView>
    </View>
  );
}
