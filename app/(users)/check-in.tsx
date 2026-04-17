import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { useRideStore } from "@/store/useRideStore";
import { T } from "@/hooks/use-translation";

export default function UserCheckInPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    bookingId?: string;
    rideId?: string;
    pickup?: string;
    destination?: string;
  }>();
  const { checkIn, fetchMyBookings } = useRideStore();
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const refs = useRef<(TextInput | null)[]>([null, null, null, null]);

  const code = useMemo(() => digits.join(""), [digits]);
  const pickup = params.pickup || "Pickup";
  const destination = params.destination || "Destination";
  const bookingShortId = params.bookingId ? params.bookingId.slice(-6) : null;

  const handleChange = (value: string, index: number) => {
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < refs.current.length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    if (!params.bookingId) {
      Alert.alert("Booking unavailable", "We could not find your booking.");
      return;
    }
    if (code.length < 4) {
      Alert.alert("Incomplete code", "Enter the full 4-digit check-in code.");
      return;
    }

    setSubmitting(true);
    try {
      await checkIn(params.bookingId, code);
      await fetchMyBookings();
      Alert.alert("Checked in", "You are confirmed and ready for the ride.", [
        {
          text: "Back to ride",
          onPress: () =>
            router.replace({
              pathname: "/(users)/ride-details" as any,
              params: params.bookingId
                ? { bookingId: params.bookingId }
                : params.rideId
                  ? { rideId: params.rideId }
                  : {},
            }),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Invalid code",
        error?.data?.message || error?.message || "Check-in failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={["top", "bottom"]} className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              entering={FadeInUp.duration(240)}
              className="pb-3 pt-3"
            >
              <View className="mb-4 flex-row items-center">
                <TouchableOpacity
                  onPress={() => router.back()}
                  className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-white"
                >
                  <Ionicons name="arrow-back" size={20} color="#042F40" />
                </TouchableOpacity>
                <View className="flex-1">
                  <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Boarding
                  </Text>
                  <Text className="mt-1 text-xl font-bold text-slate-900">
                    <T>Check-In Verification</T>
                  </Text>
                </View>
              </View>

              <View className="rounded-[28px] bg-[#042F40] px-5 py-5">
                <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4A017]">
                  Ride Route
                </Text>
                <Text className="mt-2 text-2xl font-bold text-white">
                  {pickup} {"→"} {destination}
                </Text>
                <Text className="mt-2 text-sm leading-6 text-slate-300">
                  <T>
                    Enter the driver code to complete boarding and confirm your
                    ride attendance.
                  </T>
                </Text>
                <View className="mt-4 flex-row gap-3">
                  <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                    <Text className="text-[11px] text-slate-300">
                      <T>Code Length</T>
                    </Text>
                    <Text className="mt-1 text-xl font-bold text-white">4</Text>
                  </View>
                  <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                    <Text className="text-[11px] text-slate-300">
                      <T>Booking Ref</T>
                    </Text>
                    <Text className="mt-1 text-xl font-bold text-white">
                      {bookingShortId || "----"}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(60).duration(240)}
              className="rounded-[26px] border border-slate-200 bg-white p-5"
            >
              <View className="mb-2 flex-row items-center">
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-violet-50">
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color="#7C3AED"
                  />
                </View>
                <View>
                  <Text className="text-sm font-semibold text-slate-900">
                    <T>Enter Driver Code</T>
                  </Text>
                  <Text className="text-xs text-slate-500">
                    <T>Use the exact 4 digits shared by your driver.</T>
                  </Text>
                </View>
              </View>

              <View className="mt-4 flex-row justify-between">
                {digits.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      refs.current[index] = ref;
                    }}
                    value={digit}
                    onChangeText={(text) => handleChange(text, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    className="h-16 w-14 rounded-2xl border-2 bg-slate-50 text-2xl font-bold text-slate-900"
                    style={{ borderColor: digit ? "#7C3AED" : "#E2E8F0" }}
                    onKeyPress={({ nativeEvent }) => {
                      if (
                        nativeEvent.key === "Backspace" &&
                        !digit &&
                        index > 0
                      ) {
                        refs.current[index - 1]?.focus();
                      }
                    }}
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || code.length < 4}
                className={`mt-5 flex-row items-center justify-center rounded-2xl border px-4 py-3.5 ${
                  code.length === 4
                    ? "border-slate-900 bg-slate-900"
                    : "border-slate-200 bg-slate-100"
                }`}
              >
                {submitting ? (
                  <ActivityIndicator
                    color={code.length === 4 ? "#fff" : "#94A3B8"}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={17}
                      color={code.length === 4 ? "#FFFFFF" : "#94A3B8"}
                    />
                    <Text
                      className={`ml-2 text-sm font-semibold ${
                        code.length === 4 ? "text-white" : "text-slate-400"
                      }`}
                    >
                      <T>Verify and Check In</T>
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(120).duration(240)}
              className="mt-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4"
            >
              <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                What Happens Next
              </Text>
              <Text className="mt-2 text-sm leading-6 text-slate-600">
                <T>
                  Once verified, your booking is marked as checked in and your
                  driver can proceed with boarding.
                </T>
              </Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
