import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  BackHandler,
  ActivityIndicator,
  Share,
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  MapView,
  Camera,
  LocationPuck,
  Marker,
  Polyline,
} from "@/components/map/ExpoMap";
import Animated, { FadeInUp } from "react-native-reanimated";

import { useRideStore, Ride, Booking } from "@/store/useRideStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useSocket } from "@/hooks/use-socket";
import { eventBus } from "@/lib/eventBus";
import { T } from "@/hooks/use-translation";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";

export default function DriverActiveRideScreen() {
  const router = useRouter();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const {
    fetchRideDetails,
    startRide,
    endRide,
    driverBookings,
    fetchDriverBookings,
    updatePaymentStatus,
  } = useRideStore();
  const { userLocation, updateLiveLocation } = useLocationStore();
  const mapsEnabled = usePlatformSettingsStore(
    (state) => state.settings.expo_maps_enabled,
  );
  const { joinRide, leaveRide } = useSocket();
  const cameraRef = useRef<{ setCamera: (opts: any) => void }>(null);

  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [passengerLocations, setPassengerLocations] = useState<
    Record<
      string,
      {
        latitude: number;
        longitude: number;
        name: string;
        profile_picture: string | null;
      }
    >
  >({});

  // ── Load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (rideId) {
          joinRide(rideId);
          // Start the ride (transition to in_progress) — idempotent if already started
          try {
            await startRide(rideId);
          } catch {}
          const r = await fetchRideDetails(rideId);
          setRide(r);
          await fetchDriverBookings();
          const allBk = useRideStore.getState().driverBookings;
          setBookings(
            allBk.filter((b) => {
              const bRide =
                typeof b.ride_id === "object" ? b.ride_id._id : b.ride_id;
              return (
                bRide === rideId &&
                (b.status === "accepted" || b.status === "in_progress")
              );
            }),
          );
        }
      } catch {}
      setLoading(false);
    })();
  }, [rideId]);

  // ── GPS broadcast ─────────────────────────────────────────────────
  useEffect(() => {
    locationInterval.current = setInterval(() => {
      const loc = useLocationStore.getState().userLocation;
      if (loc) updateLiveLocation(loc.latitude, loc.longitude, 0);
    }, 5000);
    return () => {
      if (locationInterval.current) clearInterval(locationInterval.current);
    };
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      Alert.alert("Leave?", "Your GPS will stop broadcasting.", [
        { text: "Stay", style: "cancel" },
        { text: "Leave", onPress: () => router.back() },
      ]);
      return true;
    });
    return () => sub.remove();
  }, []);

  // ── Socket: real-time booking updates ─────────────────────────────
  useEffect(() => {
    return () => {
      if (rideId) leaveRide(rideId);
    };
  }, []);
  useEffect(() => {
    const refresh = async () => {
      if (rideId) {
        try {
          const r = await fetchRideDetails(rideId);
          setRide(r);
        } catch {}
      }
      await fetchDriverBookings();
      const allBk = useRideStore.getState().driverBookings;
      if (rideId)
        setBookings(
          allBk.filter((b) => {
            const bRide =
              typeof b.ride_id === "object" ? b.ride_id._id : b.ride_id;
            return (
              bRide === rideId &&
              (b.status === "accepted" || b.status === "in_progress")
            );
          }),
        );
    };
    const u1 = eventBus.on("booking:updated", refresh);
    const u2 = eventBus.on("booking:checkin", refresh);
    const u3 = eventBus.on("booking:cancelled", refresh);
    const u4 = eventBus.on("ride:ended", refresh);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [rideId]);

  // ── Listen for passenger locations ────────────────────────────────
  useEffect(() => {
    const unsub = eventBus.on("passenger-location-updated", (data: any) => {
      if (!data?.user_id || !data?.location) return;
      setPassengerLocations((prev) => ({
        ...prev,
        [data.user_id]: {
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          name: data.name || "Passenger",
          profile_picture: data.profile_picture || null,
        },
      }));
    });
    return () => unsub();
  }, []);

  const [actionId, setActionId] = useState<string | null>(null);
  const [rideCompleted, setRideCompleted] = useState(false);
  const [mapType, setMapType] = useState<"hybrid" | "standard">("hybrid");

  const handleConfirmPayment = (bookingId: string, passengerName: string) => {
    Alert.alert(
      "Confirm Payment",
      `Did you receive the transfer payment from ${passengerName}?`,
      [
        { text: "Not Yet", style: "cancel" },
        {
          text: "Yes, Received",
          onPress: async () => {
            setActionId(bookingId);
            try {
              await updatePaymentStatus(bookingId, "paid");
              setBookings((prev) =>
                prev.map((b) =>
                  b._id === bookingId
                    ? { ...b, payment_status: "paid" as const }
                    : b,
                ),
              );
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed to update");
            }
            setActionId(null);
          },
        },
      ],
    );
  };

  const handleEndRide = () => {
    Alert.alert(
      "End Ride?",
      "This will complete the ride for all passengers.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Ride",
          style: "destructive",
          onPress: async () => {
            setEnding(true);
            try {
              await endRide(rideId!);
              setRideCompleted(true);
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed");
            }
            setEnding(false);
          },
        },
      ],
    );
  };

  const handleShareCode = async () => {
    if (!ride?.check_in_code) return;
    const pickup =
      typeof ride.pickup_location_id === "object"
        ? ride.pickup_location_id
        : null;
    const dest =
      typeof ride.destination_id === "object" ? ride.destination_id : null;
    try {
      await Share.share({
        message: `UniRide Check-in Code: ${ride.check_in_code}\n${pickup?.name || "Pickup"} → ${dest?.name || "Destination"}`,
      });
    } catch {}
  };

  const handleOpenInGoogleMaps = useCallback(async () => {
    const activeCoords =
      ride?.current_location?.coordinates ||
      ride?.destination?.coordinates ||
      null;

    if (!activeCoords) {
      Alert.alert("Unavailable", "No ride location is available yet.");
      return;
    }

    const [longitude, latitude] = activeCoords;
    const pickupLabel =
      (ride &&
        typeof ride.pickup_location_id === "object" &&
        (ride.pickup_location_id.short_name || ride.pickup_location_id.name)) ||
      "Pickup";
    const destinationLabel =
      (ride &&
        typeof ride.destination_id === "object" &&
        (ride.destination_id.short_name || ride.destination_id.name)) ||
      "Destination";
    const label = encodeURIComponent(
      `${pickupLabel} to ${destinationLabel}`,
    );

    try {
      await Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}%20(${label})`,
      );
    } catch {
      Alert.alert("Error", "Unable to open Google Maps.");
    }
  }, [ride]);

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#042F40" />
      </View>
    );

  const pickup =
    ride && typeof ride.pickup_location_id === "object"
      ? ride.pickup_location_id
      : null;
  const dest =
    ride && typeof ride.destination_id === "object"
      ? ride.destination_id
      : null;
  const routeGeo = ride?.route_geometry || null;
  const routeCoordinates =
    routeGeo?.coordinates?.map?.((coordinate: [number, number]) => ({
      latitude: coordinate[1],
      longitude: coordinate[0],
    })) ||
    routeGeo?.geometry?.coordinates?.map?.((coordinate: [number, number]) => ({
      latitude: coordinate[1],
      longitude: coordinate[0],
    })) ||
    [];
  const center = userLocation
    ? ([userLocation.longitude, userLocation.latitude] as [number, number])
    : ([4.52, 7.52] as [number, number]);
  const checkedIn = bookings.filter(
    (b) => b.check_in_status === "checked_in",
  ).length;

  // ═════════════════════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-white">
      {/* Map */}
      {mapsEnabled ? (
        <MapView
          style={{ flex: 1 }}
          mapType={mapType}
          showsCompass
          showsBuildings
        >
          <Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: center,
              zoomLevel: 14,
            }}
            animationDuration={1200}
          />
          <LocationPuck />
          {routeCoordinates.length > 1 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#042F40"
              strokeWidth={4}
            />
          )}
          {Object.entries(passengerLocations).map(([userId, loc]) => (
            <Marker
              key={`passenger-${userId}`}
              coordinate={{
                latitude: loc.latitude,
                longitude: loc.longitude,
              }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View className="items-center">
                <View
                  className="bg-accent rounded-full w-8 h-8 items-center justify-center border-2 border-white"
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                  }}
                >
                  <Ionicons name="person" size={14} color="#fff" />
                </View>
                <View
                  className="bg-white rounded-md px-1.5 py-0.5 mt-0.5"
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                  }}
                >
                  <Text className="text-[8px] font-bold text-gray-700">
                    {loc.name.split(" ")[0]}
                  </Text>
                </View>
              </View>
            </Marker>
          ))}
        </MapView>
      ) : (
        <View className="flex-1 bg-slate-50 px-5 pt-28">
          <View className="rounded-[28px] border border-slate-200 bg-white px-5 py-5">
            <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Active Ride
            </Text>
            <Text className="mt-2 text-2xl font-bold text-slate-900">
              Passenger tracking continues in the background
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-600">
              Check-ins, passenger payments, and ride completion actions remain
              fully available while the interactive map is disabled.
            </Text>
          </View>
        </View>
      )}

      {/* Header */}
      <SafeAreaView
        edges={["top"]}
        className="absolute top-0 left-0 right-0 z-10"
        pointerEvents="box-none"
      >
        <View className="mx-5 mt-2 flex-row items-center">
          <TouchableOpacity
            onPress={() => {
              Alert.alert("Leave?", "GPS will stop.", [
                { text: "Stay" },
                { text: "Leave", onPress: () => router.back() },
              ]);
            }}
            className="bg-white/95 w-10 h-10 rounded-full items-center justify-center"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
            }}
          >
            <Ionicons name="arrow-back" size={20} color="#042F40" />
          </TouchableOpacity>
          <View
            className="flex-1 mx-3 bg-white/95 rounded-2xl px-4 py-2.5 flex-row items-center"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
            }}
          >
            <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2" />
            <Text className="text-sm font-bold text-gray-900 flex-1">
              <T>Ride In Progress</T>
            </Text>
            <Text className="text-xs text-gray-400">
              {checkedIn}/{bookings.length} <T>checked in</T>
            </Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              setMapType((current) =>
                current === "hybrid" ? "standard" : "hybrid",
              )
            }
            className="bg-white/95 w-10 h-10 rounded-full items-center justify-center"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
            }}
          >
            <Ionicons
              name={mapType === "hybrid" ? "map-outline" : "layers-outline"}
              size={20}
              color="#042F40"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (userLocation && cameraRef.current)
                cameraRef.current.setCamera({
                  centerCoordinate: [
                    userLocation.longitude,
                    userLocation.latitude,
                  ],
                  zoomLevel: 15,
                  animationDuration: 800,
                });
            }}
            className="bg-white/95 w-10 h-10 rounded-full items-center justify-center"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
            }}
          >
            <Ionicons name="locate" size={20} color="#042F40" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom Panel */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(400)}
        className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-[28px]"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        }}
      >
        <View className="items-center pt-3 pb-1">
          <View className="w-10 h-1 bg-gray-200 rounded-full" />
        </View>
        <SafeAreaView edges={["bottom"]} className="px-5 pb-2">
          {/* Route */}
          <View className="flex-row items-center mb-3">
            <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2" />
            <Text className="text-xs text-gray-500 flex-1" numberOfLines={1}>
              {pickup?.short_name || "Pickup"}
            </Text>
            <Ionicons name="arrow-forward" size={12} color="#D1D5DB" />
            <View className="w-2.5 h-2.5 rounded-full bg-red-500 mx-2" />
            <Text
              className="text-xs text-gray-500 flex-1 text-right"
              numberOfLines={1}
            >
              {dest?.short_name || "Destination"}
            </Text>
          </View>

          {/* Check-in Code */}
          {ride?.check_in_code && (
            <TouchableOpacity
              onPress={handleShareCode}
              className="bg-accent/10 rounded-xl p-3 mb-3 flex-row items-center border border-accent/20"
            >
              <Ionicons name="key" size={18} color="#D4A017" />
              <Text className="text-lg font-bold text-accent tracking-[6px] mx-3 flex-1">
                {ride.check_in_code}
              </Text>
              <Ionicons name="share-outline" size={16} color="#D4A017" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleOpenInGoogleMaps}
            className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 flex-row items-center"
          >
            <Ionicons name="navigate-outline" size={18} color="#042F40" />
            <View className="ml-3 flex-1">
              <Text className="text-xs font-semibold text-slate-900">
                <T>Open in Google Maps</T>
              </Text>
              <Text className="text-[10px] text-slate-500 mt-0.5">
                <T>Open the latest saved ride location</T>
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color="#042F40" />
          </TouchableOpacity>

          {/* Passengers */}
          {bookings.length > 0 && (
            <View className="mb-3">
              <Text className="text-xs text-gray-400 mb-2">
                <T>Passengers</T>
              </Text>
              {bookings.map((bk) => {
                const usr =
                  bk.user_id && typeof bk.user_id === "object"
                    ? bk.user_id
                    : null;
                const isTransfer = bk.payment_method === "transfer";
                const paymentSent = isTransfer && bk.payment_status === "sent";
                const paymentConfirmed =
                  isTransfer && bk.payment_status === "paid";
                const paymentPending =
                  isTransfer && bk.payment_status === "pending";
                return (
                  <View key={bk._id} className="bg-gray-50 rounded-xl p-3 mb-2">
                    <View className="flex-row items-center">
                      {usr?.profile_picture ? (
                        <Image
                          source={{ uri: usr.profile_picture }}
                          className="w-8 h-8 rounded-full mr-2"
                        />
                      ) : (
                        <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center mr-2">
                          <Ionicons name="person" size={14} color="#042F40" />
                        </View>
                      )}
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-gray-800">
                          {usr?.name || "Passenger"}
                        </Text>
                        <Text className="text-[10px] text-gray-400">
                          {bk.seats_requested} seat
                          {bk.seats_requested > 1 ? "s" : ""} ·{" "}
                          {bk.payment_method}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        {/* Payment badge */}
                        {isTransfer && (
                          <View
                            className={`rounded-full px-2 py-0.5 ${
                              paymentConfirmed
                                ? "bg-green-100"
                                : paymentSent
                                  ? "bg-blue-100"
                                  : "bg-amber-100"
                            }`}
                          >
                            <Text
                              className={`text-[10px] font-semibold ${
                                paymentConfirmed
                                  ? "text-green-700"
                                  : paymentSent
                                    ? "text-blue-700"
                                    : "text-amber-700"
                              }`}
                            >
                              {paymentConfirmed
                                ? "₦ Paid"
                                : paymentSent
                                  ? "₦ Sent"
                                  : "₦ Pending"}
                            </Text>
                          </View>
                        )}
                        {bk.check_in_status === "checked_in" ? (
                          <View className="bg-green-100 rounded-full px-2 py-0.5">
                            <Text className="text-[10px] text-green-700 font-semibold">
                              ✓
                            </Text>
                          </View>
                        ) : (
                          <View className="bg-gray-100 rounded-full px-2 py-0.5">
                            <Text className="text-[10px] text-gray-400">—</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Confirm Transfer button — shown when passenger has marked as sent */}
                    {paymentSent && (
                      <TouchableOpacity
                        onPress={() =>
                          handleConfirmPayment(
                            bk._id,
                            usr?.name || "this passenger",
                          )
                        }
                        disabled={actionId === bk._id}
                        className="mt-2 bg-blue-50 rounded-xl py-2.5 flex-row items-center justify-center border border-blue-100"
                      >
                        {actionId === bk._id ? (
                          <ActivityIndicator size="small" color="#2563EB" />
                        ) : (
                          <>
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={14}
                              color="#2563EB"
                            />
                            <Text className="text-blue-600 font-semibold text-xs ml-1.5">
                              <T>Confirm Transfer Received</T>
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* End Ride */}
          <TouchableOpacity
            onPress={handleEndRide}
            disabled={ending}
            className="bg-red-500 rounded-2xl py-4 items-center mb-2"
          >
            {ending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="stop-circle" size={18} color="#fff" />
                <Text className="text-white font-bold text-base ml-2">
                  <T>End Ride</T>
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>

      {/* ── Ride Completed Overlay ──────────────────────────────────── */}
      {rideCompleted && (
        <View className="absolute inset-0 z-50 bg-white">
          <SafeAreaView
            edges={["top", "bottom"]}
            className="flex-1 justify-center items-center px-8"
          >
            <Animated.View
              entering={FadeInUp.duration(500)}
              className="items-center"
            >
              <View className="w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-4">
                <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
              </View>
              <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
                <T>Ride Completed!</T>
              </Text>
              <Text className="text-sm text-gray-500 text-center mb-6">
                <T>Great job! Your ride has been completed successfully.</T>
              </Text>

              {/* Summary Card */}
              <View className="bg-gray-50 rounded-2xl p-5 w-full mb-6">
                <View className="flex-row items-start mb-3">
                  <View className="items-center mr-3 mt-0.5">
                    <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <View className="w-0.5 h-6 bg-gray-200 my-0.5" />
                    <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-gray-800 mb-3">
                      {pickup?.short_name || "Pickup"}
                    </Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      {dest?.short_name || "Destination"}
                    </Text>
                  </View>
                </View>
                <View className="flex-row justify-between pt-3 border-t border-gray-200">
                  <View className="items-center flex-1">
                    <Text className="text-lg font-bold text-primary">
                      {bookings.length}
                    </Text>
                    <Text className="text-[10px] text-gray-400">
                      <T>Passengers</T>
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-lg font-bold text-primary">
                      {ride?.fare ? `₦${ride.fare}` : "—"}
                    </Text>
                    <Text className="text-[10px] text-gray-400">
                      <T>Fare</T>
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-lg font-bold text-green-600">
                      {checkedIn}/{bookings.length}
                    </Text>
                    <Text className="text-[10px] text-gray-400">
                      <T>Checked In</T>
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.back()}
                className="bg-primary rounded-2xl py-4 w-full items-center mb-3"
              >
                <Text className="text-white font-bold text-base">
                  <T>Back to Home</T>
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/(drivers)/earnings" as any)}
                className="bg-green-50 border border-green-100 rounded-2xl py-3.5 w-full items-center flex-row justify-center"
              >
                <Ionicons name="wallet-outline" size={16} color="#16A34A" />
                <Text className="text-green-700 font-semibold text-sm ml-2">
                  <T>View Earnings</T>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}
