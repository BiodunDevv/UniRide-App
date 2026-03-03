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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Mapbox, {
  MapView,
  Camera,
  LocationPuck,
  ShapeSource,
  LineLayer,
  PointAnnotation,
} from "@/components/map/MapboxWrapper";
import Animated, { FadeInUp } from "react-native-reanimated";

import { useRideStore, Ride, Booking } from "@/store/useRideStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useSocket } from "@/hooks/use-socket";
import { eventBus } from "@/lib/eventBus";
import { T } from "@/hooks/use-translation";

const MAPBOX_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  "find_your_own_token_at_mapbox.com_and_put_it_here";
Mapbox.setAccessToken(MAPBOX_TOKEN);

export default function DriverActiveRideScreen() {
  const router = useRouter();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { fetchRideDetails, endRide, driverBookings, fetchDriverBookings } =
    useRideStore();
  const { userLocation, updateLiveLocation } = useLocationStore();
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
    return () => {
      u1();
      u2();
      u3();
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
              Alert.alert("Ride Ended", "Well done!", [
                { text: "OK", onPress: () => router.back() },
              ]);
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
      <MapView
        style={{ flex: 1 }}
        styleURL="mapbox://styles/mapbox/light-v11"
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: center,
            zoomLevel: 14,
            pitch: 45,
          }}
          animationMode="flyTo"
          animationDuration={1200}
        />
        <LocationPuck
          puckBearingEnabled
          puckBearing="heading"
          pulsing={{ isEnabled: true, color: "#16A34A", radius: 60 }}
        />
        {routeGeo && (
          <ShapeSource id="route" shape={routeGeo}>
            <LineLayer
              id="route-line"
              style={{
                lineColor: "#042F40",
                lineWidth: 4,
                lineOpacity: 0.7,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </ShapeSource>
        )}
        {/* Passenger location markers */}
        {Object.entries(passengerLocations).map(([userId, loc]) => (
          <PointAnnotation
            key={`passenger-${userId}`}
            id={`passenger-${userId}`}
            coordinate={[loc.longitude, loc.latitude]}
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
          </PointAnnotation>
        ))}
      </MapView>

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
                return (
                  <View
                    key={bk._id}
                    className="flex-row items-center py-2 border-b border-gray-50"
                  >
                    {usr?.profile_picture ? (
                      <Image
                        source={{ uri: usr.profile_picture }}
                        className="w-7 h-7 rounded-full mr-2"
                      />
                    ) : (
                      <View className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center mr-2">
                        <Ionicons name="person" size={12} color="#042F40" />
                      </View>
                    )}
                    <Text className="flex-1 text-xs font-medium text-gray-700">
                      {usr?.name || "Passenger"}
                    </Text>
                    <Text className="text-xs text-gray-400 mr-2">
                      {bk.seats_requested}s
                    </Text>
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
    </View>
  );
}
