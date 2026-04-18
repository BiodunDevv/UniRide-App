import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
  InteractionManager,
  ScrollView,
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
  useMapProvider,
} from "@/components/map/ExpoMap";
import Animated, { FadeInUp } from "react-native-reanimated";

import { useRideStore, Ride, Booking } from "@/store/useRideStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useSocket } from "@/hooks/use-socket";
import { eventBus } from "@/lib/eventBus";
import { T } from "@/hooks/use-translation";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { recordBootstrapTrace } from "@/lib/post-auth";
import { useLocation } from "@/hooks/use-location";
import {
  resolveSafeCenter,
  sanitizeLatLng,
  sanitizeLngLatTuple,
  sanitizeRouteGeometry,
} from "@/lib/mapSafety";
import {
  fetchMapboxNavigationRoute,
  findNearestStepIndex,
  getRemainingStepDistanceMeters,
  getRemainingStepDurationSeconds,
  MapboxNavigationRoute,
  nearestDistanceToRouteMeters,
} from "@/lib/mapNavigation";

const NAV_REROUTE_THRESHOLD_METERS = 90;
const NAV_REROUTE_COOLDOWN_MS = 15000;
const ACTIVE_RIDE_AUTO_LOCATION_ZOOM_LEVEL = 16.4;

function formatDistanceLabel(distanceMeters: number): string {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  return `${Math.max(1, Math.round(distanceMeters))} m`;
}

function formatDurationLabel(durationSeconds: number): string {
  const totalMinutes = Math.max(1, Math.round(durationSeconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatElapsedDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

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
  const mapsFeatureEnabled = usePlatformSettingsStore(
    (state) =>
      state.settings.mobile_map_enabled ?? state.settings.expo_maps_enabled,
  );
  const farePerSeatEnabled = usePlatformSettingsStore((state) =>
    Boolean(state.settings.fare_per_seat),
  );
  const navigationSdkEnabled = usePlatformSettingsStore((state) =>
    Boolean(state.settings.mobile_navigation_enabled),
  );
  const {
    canRenderMaps,
    provider,
    mapboxExpoGoRuntime,
    mapboxTokenConfigured,
    requestedProviderAvailable,
    nativeModuleAvailable,
    runtimeFailure,
  } = useMapProvider();
  const safeMode = useBootstrapStore((state) => state.safeMode);
  const { connect, joinRide, leaveRide } = useSocket();
  const cameraRef = useRef<{ setCamera: (opts: any) => void }>(null);
  const { requestPermission, startWatching } = useLocation();

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
        timestamp?: string;
      }
    >
  >({});
  const [lastPassengerUpdate, setLastPassengerUpdate] = useState<string | null>(
    null,
  );
  const [elapsedClockMs, setElapsedClockMs] = useState(() => Date.now());

  const formatLiveStatus = useCallback((value?: string | null) => {
    if (!value) return "Waiting for live updates";
    const diffMs = Date.now() - new Date(value).getTime();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
    if (diffMinutes < 1) return "Live now";
    if (diffMinutes === 1) return "Updated 1 min ago";
    if (diffMinutes < 60) return `Updated ${diffMinutes} mins ago`;
    const diffHours = Math.round(diffMinutes / 60);
    return `Updated ${diffHours}h ago`;
  }, []);

  // ── Load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (rideId) {
          await connect();
          joinRide(rideId);
          const r = await fetchRideDetails(rideId);
          setRide(r);
          if (r?.status === "completed") {
            setRideCompleted(true);
          } else {
            // Start the ride (transition to in_progress) only if it is not already completed
            try {
              await startRide(rideId);
              const refreshedRide = await fetchRideDetails(rideId);
              setRide(refreshedRide);
            } catch {}
          }
          const seededPassengerLocations = ((r as any)?.bookings || []).reduce(
            (
              acc: Record<
                string,
                {
                  latitude: number;
                  longitude: number;
                  name: string;
                  profile_picture: string | null;
                  timestamp?: string;
                }
              >,
              bk: any,
            ) => {
              const user = bk?.user_id;
              const coordinates = user?.current_location?.coordinates;
              const safeLocation = sanitizeLatLng({
                latitude: coordinates?.[1],
                longitude: coordinates?.[0],
              });
              if (!user?._id || !safeLocation) {
                return acc;
              }

              acc[user._id] = {
                latitude: safeLocation.latitude,
                longitude: safeLocation.longitude,
                name: user?.name || "Passenger",
                profile_picture: user?.profile_picture || null,
                timestamp: bk?.updatedAt
                  ? new Date(bk.updatedAt).toISOString()
                  : new Date().toISOString(),
              };
              return acc;
            },
            {},
          );

          if (Object.keys(seededPassengerLocations).length > 0) {
            setPassengerLocations(seededPassengerLocations);
            const seededPassengerValues = Object.values(
              seededPassengerLocations,
            ) as Array<{
              latitude: number;
              longitude: number;
              name: string;
              profile_picture: string | null;
              timestamp?: string;
            }>;
            const latestSeededTimestamp = seededPassengerValues
              .map((item) => item.timestamp)
              .filter((value): value is string => Boolean(value))
              .sort()
              .at(-1);
            if (latestSeededTimestamp) {
              setLastPassengerUpdate(latestSeededTimestamp);
            }
          }
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
  }, [
    connect,
    fetchDriverBookings,
    fetchRideDetails,
    joinRide,
    rideId,
    startRide,
  ]);

  useEffect(() => {
    requestPermission()
      .then((granted) => {
        if (granted && !safeMode) {
          startWatching();
        }
      })
      .catch(() => {});
  }, [requestPermission, safeMode, startWatching]);

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
  }, [leaveRide, rideId]);
  useEffect(() => {
    const refresh = async () => {
      if (rideId) {
        try {
          const r = await fetchRideDetails(rideId);
          setRide(r);
          if (r?.status === "completed") {
            setRideCompleted(true);
          }
          const seededPassengerLocations = ((r as any)?.bookings || []).reduce(
            (
              acc: Record<
                string,
                {
                  latitude: number;
                  longitude: number;
                  name: string;
                  profile_picture: string | null;
                  timestamp?: string;
                }
              >,
              bk: any,
            ) => {
              const user = bk?.user_id;
              const coordinates = user?.current_location?.coordinates;
              const safeLocation = sanitizeLatLng({
                latitude: coordinates?.[1],
                longitude: coordinates?.[0],
              });
              if (!user?._id || !safeLocation) {
                return acc;
              }

              acc[user._id] = {
                latitude: safeLocation.latitude,
                longitude: safeLocation.longitude,
                name: user?.name || "Passenger",
                profile_picture: user?.profile_picture || null,
                timestamp: bk?.updatedAt
                  ? new Date(bk.updatedAt).toISOString()
                  : new Date().toISOString(),
              };
              return acc;
            },
            {},
          );
          if (Object.keys(seededPassengerLocations).length > 0) {
            setPassengerLocations((prev) => ({
              ...prev,
              ...seededPassengerLocations,
            }));
          }
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
    const u5 = eventBus.on("ride:started", refresh);
    const u6 = eventBus.on("ride:cancelled", refresh);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, [rideId]);

  // ── Listen for passenger locations ────────────────────────────────
  useEffect(() => {
    const unsub = eventBus.on("passenger-location-updated", (data: any) => {
      if (!data?.user_id || !data?.location) return;
      const safeLocation = sanitizeLatLng(data.location);
      if (!safeLocation) return;
      setPassengerLocations((prev) => ({
        ...prev,
        [data.user_id]: {
          latitude: safeLocation.latitude,
          longitude: safeLocation.longitude,
          name: data.name || "Passenger",
          profile_picture: data.profile_picture || null,
          timestamp: data.timestamp
            ? new Date(data.timestamp).toISOString()
            : new Date().toISOString(),
        },
      }));
      setLastPassengerUpdate(
        data.timestamp
          ? new Date(data.timestamp).toISOString()
          : new Date().toISOString(),
      );
    });
    return () => unsub();
  }, []);

  const [actionId, setActionId] = useState<string | null>(null);
  const [rideCompleted, setRideCompleted] = useState(false);
  const [mapType, setMapType] = useState<"satellite" | "standard">("satellite");
  const [allowMapCanvas, setAllowMapCanvas] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationLoading, setNavigationLoading] = useState(false);
  const [navigationRoute, setNavigationRoute] =
    useState<MapboxNavigationRoute | null>(null);
  const [navigationStepIndex, setNavigationStepIndex] = useState(0);
  const [navigationNotice, setNavigationNotice] = useState<string | null>(null);
  const [offRouteDistanceMeters, setOffRouteDistanceMeters] = useState<
    number | null
  >(null);
  const rerouteInFlightRef = useRef(false);
  const lastRerouteAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        setAllowMapCanvas(
          Boolean(mapsFeatureEnabled && canRenderMaps) && !safeMode,
        );
      }
    });

    recordBootstrapTrace(
      "driver-active-ride:mount",
      safeMode ? "safe-mode" : "full-mode",
    ).catch(() => {});

    return () => {
      cancelled = true;
      interactionHandle.cancel();
    };
  }, [canRenderMaps, mapsFeatureEnabled, safeMode]);

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
    const label = encodeURIComponent(`${pickupLabel} to ${destinationLabel}`);

    try {
      await Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}%20(${label})`,
      );
    } catch {
      Alert.alert("Error", "Unable to open Google Maps.");
    }
  }, [ride]);

  const handleBackToHome = useCallback(() => {
    setRideCompleted(false);
    if (rideId) {
      leaveRide(rideId);
    }
    router.replace("/(drivers)" as any);
  }, [leaveRide, rideId, router]);

  const pickup =
    ride && typeof ride.pickup_location_id === "object"
      ? ride.pickup_location_id
      : null;
  const dest =
    ride && typeof ride.destination_id === "object"
      ? ride.destination_id
      : null;
  const routeCoordinates = sanitizeRouteGeometry(ride?.route_geometry);
  const center = resolveSafeCenter(
    userLocation,
    ride?.current_location?.coordinates,
  );
  const checkedIn = bookings.filter(
    (b) => b.check_in_status === "checked_in",
  ).length;
  const completedModalBookings = useMemo(() => {
    const rideBookings = Array.isArray((ride as any)?.bookings)
      ? (((ride as any).bookings || []) as Booking[])
      : [];

    const rideParticipants = rideBookings.filter((booking) =>
      ["accepted", "in_progress", "completed"].includes(booking.status),
    );

    return rideParticipants.length > 0 ? rideParticipants : bookings;
  }, [bookings, ride]);

  const completedModalPassengerCount = completedModalBookings.length;
  const completedModalCheckedIn = completedModalBookings.filter(
    (booking) => booking.check_in_status === "checked_in",
  ).length;
  const completedModalFare = useMemo(() => {
    if (completedModalBookings.length === 0) {
      return Number(ride?.fare || 0);
    }

    return completedModalBookings.reduce((sum, booking) => {
      const bookingTotal = Number((booking as any)?.total_fare);
      if (Number.isFinite(bookingTotal) && bookingTotal > 0) {
        return sum + bookingTotal;
      }

      const seatsRequested = Number(booking?.seats_requested || 1);
      const farePerSeat = Number(ride?.fare || 0);
      return (
        sum + (farePerSeatEnabled ? farePerSeat * seatsRequested : farePerSeat)
      );
    }, 0);
  }, [completedModalBookings, farePerSeatEnabled, ride?.fare]);
  const rideElapsedSeconds = useMemo(() => {
    if (!ride?.started_at) {
      return typeof ride?.elapsed_seconds === "number"
        ? ride.elapsed_seconds
        : null;
    }

    const startedAtMs = new Date(ride.started_at).getTime();
    if (Number.isNaN(startedAtMs)) {
      return typeof ride?.elapsed_seconds === "number"
        ? ride.elapsed_seconds
        : null;
    }

    const endMs =
      ride.status === "in_progress"
        ? elapsedClockMs
        : ride.ended_at
          ? new Date(ride.ended_at).getTime()
          : elapsedClockMs;

    if (Number.isNaN(endMs) || endMs < startedAtMs) {
      return typeof ride?.elapsed_seconds === "number"
        ? ride.elapsed_seconds
        : null;
    }

    return Math.floor((endMs - startedAtMs) / 1000);
  }, [
    ride?.elapsed_seconds,
    ride?.ended_at,
    ride?.started_at,
    ride?.status,
    elapsedClockMs,
  ]);
  const rideTimerLabel =
    typeof rideElapsedSeconds === "number"
      ? formatElapsedDuration(rideElapsedSeconds)
      : null;
  const showMapCanvas =
    mapsFeatureEnabled && canRenderMaps && allowMapCanvas && !safeMode;
  const destinationTuple = useMemo(
    () =>
      sanitizeLngLatTuple(ride?.destination?.coordinates) ||
      sanitizeLngLatTuple(
        dest && typeof dest === "object"
          ? (dest as any).coordinates?.coordinates || (dest as any).coordinates
          : null,
      ),
    [dest, ride?.destination?.coordinates],
  );
  const navigationOriginTuple = useMemo(
    () =>
      sanitizeLngLatTuple(
        userLocation ? [userLocation.longitude, userLocation.latitude] : null,
      ) || sanitizeLngLatTuple(ride?.current_location?.coordinates),
    [ride?.current_location?.coordinates, userLocation],
  );

  const mapRouteCoordinates =
    isNavigating && navigationRoute?.coordinates?.length
      ? navigationRoute.coordinates
      : routeCoordinates;
  const currentNavigationStep =
    isNavigating && navigationRoute?.steps?.length
      ? navigationRoute.steps[
          Math.min(
            navigationStepIndex,
            Math.max(0, navigationRoute.steps.length - 1),
          )
        ]
      : null;
  const remainingNavigationDistance = isNavigating
    ? navigationRoute?.steps?.length
      ? getRemainingStepDistanceMeters(
          navigationRoute.steps,
          navigationStepIndex,
        )
      : navigationRoute?.distanceMeters || 0
    : 0;
  const remainingNavigationDuration = isNavigating
    ? navigationRoute?.steps?.length
      ? getRemainingStepDurationSeconds(
          navigationRoute.steps,
          navigationStepIndex,
        )
      : navigationRoute?.durationSeconds || 0
    : 0;

  const handleToggleInAppNavigation = useCallback(async () => {
    if (isNavigating) {
      setIsNavigating(false);
      setNavigationStepIndex(0);
      setOffRouteDistanceMeters(null);
      setNavigationNotice(null);
      return;
    }

    if (!navigationSdkEnabled) {
      Alert.alert(
        "Navigation disabled",
        "In-app navigation is disabled in platform settings.",
      );
      return;
    }

    if (provider !== "mapbox") {
      Alert.alert(
        "Mapbox required",
        "Switch map provider to Mapbox in platform settings to use in-app navigation.",
      );
      return;
    }

    if (mapboxExpoGoRuntime) {
      Alert.alert(
        "Mapbox unavailable in Expo Go",
        "Use a development build or production binary to run in-app navigation.",
      );
      return;
    }

    if (!mapboxTokenConfigured || !requestedProviderAvailable) {
      Alert.alert(
        "Mapbox setup required",
        "Mapbox token or native runtime is unavailable. Verify app build configuration and try again.",
      );
      return;
    }

    if (!navigationOriginTuple || !destinationTuple) {
      Alert.alert(
        "Navigation unavailable",
        "We need your current location and destination coordinates before starting in-app navigation.",
      );
      return;
    }

    try {
      setNavigationLoading(true);
      setNavigationNotice("Fetching best route...");

      const route = await fetchMapboxNavigationRoute({
        origin: navigationOriginTuple as [number, number],
        destination: destinationTuple,
      });

      setNavigationRoute(route);
      setNavigationStepIndex(0);
      setOffRouteDistanceMeters(null);
      setIsNavigating(true);
      setNavigationNotice("In-app navigation started");
    } catch (error: any) {
      const message =
        error?.message === "mapbox-token-missing"
          ? "Mapbox token is missing. Add EXPO_PUBLIC_MAPBOX_TOKEN and rebuild the app."
          : "Unable to start in-app navigation right now.";
      Alert.alert("Navigation error", message);
      setNavigationNotice(null);
    } finally {
      setNavigationLoading(false);
    }
  }, [
    destinationTuple,
    isNavigating,
    mapboxExpoGoRuntime,
    mapboxTokenConfigured,
    navigationOriginTuple,
    navigationSdkEnabled,
    provider,
    requestedProviderAvailable,
  ]);

  useEffect(() => {
    if (!navigationNotice) return;
    const timeout = setTimeout(() => {
      setNavigationNotice(null);
    }, 3200);
    return () => clearTimeout(timeout);
  }, [navigationNotice]);

  useEffect(() => {
    if (!ride?.started_at || ride.status !== "in_progress") return;

    const timer = setInterval(() => {
      setElapsedClockMs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [ride?.started_at, ride?.status]);

  useEffect(() => {
    if (!isNavigating) return;
    if (!userLocation || !cameraRef.current) return;

    cameraRef.current.setCamera({
      centerCoordinate: [userLocation.longitude, userLocation.latitude],
      zoomLevel: 16.2,
      pitch: 58,
      animationDuration: 700,
    });
  }, [isNavigating, userLocation]);

  useEffect(() => {
    if (!isNavigating || !navigationRoute || !userLocation) return;

    const currentPoint = {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
    };

    const nearestDistance = nearestDistanceToRouteMeters(
      currentPoint,
      navigationRoute.coordinates,
    );
    setOffRouteDistanceMeters(nearestDistance);

    const nearestStep = findNearestStepIndex(
      currentPoint,
      navigationRoute.steps,
      navigationStepIndex,
    );
    if (nearestStep !== navigationStepIndex) {
      setNavigationStepIndex(nearestStep);
    }

    if (
      nearestDistance <= NAV_REROUTE_THRESHOLD_METERS ||
      !destinationTuple ||
      rerouteInFlightRef.current
    ) {
      return;
    }

    const now = Date.now();
    if (now - lastRerouteAtRef.current < NAV_REROUTE_COOLDOWN_MS) {
      return;
    }

    rerouteInFlightRef.current = true;
    lastRerouteAtRef.current = now;
    setNavigationNotice("Off route detected. Rerouting...");

    fetchMapboxNavigationRoute({
      origin: [userLocation.longitude, userLocation.latitude],
      destination: destinationTuple,
    })
      .then((updatedRoute) => {
        setNavigationRoute(updatedRoute);
        setNavigationStepIndex(0);
        setOffRouteDistanceMeters(0);
        setNavigationNotice("Route updated");
      })
      .catch(() => {
        setNavigationNotice("Reroute failed. Continuing current route");
      })
      .finally(() => {
        rerouteInFlightRef.current = false;
      });
  }, [
    destinationTuple,
    isNavigating,
    navigationRoute,
    navigationStepIndex,
    userLocation,
  ]);

  const mapFallbackInfo = (() => {
    if (safeMode) {
      return {
        icon: "shield-checkmark-outline" as const,
        title: "Safe mode is active",
        description:
          "Map rendering is paused while UniRide runs in safe mode. Ride tracking details remain available below.",
      };
    }

    if (!mapsFeatureEnabled) {
      return {
        icon: "toggle-outline" as const,
        title: "Map canvas is disabled",
        description:
          "Interactive maps are disabled from platform settings. Contact an administrator to enable them.",
      };
    }

    if (!allowMapCanvas && canRenderMaps) {
      return {
        icon: "time-outline" as const,
        title: "Preparing map canvas",
        description:
          "UniRide is initializing the map view. It should appear shortly.",
      };
    }

    if (provider === "mapbox") {
      if (mapboxExpoGoRuntime) {
        return {
          icon: "phone-portrait-outline" as const,
          title: "Mapbox is not available in Expo Go",
          description:
            "Use a development build or production binary to render Mapbox maps.",
        };
      }

      if (!mapboxTokenConfigured) {
        return {
          icon: "key-outline" as const,
          title: "Mapbox token is missing",
          description:
            "EXPO_PUBLIC_MAPBOX_TOKEN is missing. Add it to environment variables and rebuild the app.",
        };
      }

      if (!requestedProviderAvailable) {
        return {
          icon: "layers-outline" as const,
          title: "Mapbox is unavailable in this build",
          description:
            "The selected Mapbox provider is not available in the current runtime. Rebuild the app with Mapbox native support.",
        };
      }

      if (runtimeFailure) {
        return {
          icon: "alert-circle-outline" as const,
          title: "Mapbox failed to initialize",
          description: `Mapbox runtime error: ${runtimeFailure}`,
        };
      }

      return {
        icon: "layers-outline" as const,
        title: "Mapbox is temporarily unavailable",
        description:
          "The selected Mapbox provider could not render right now. Try again shortly.",
      };
    }

    if (!nativeModuleAvailable || !requestedProviderAvailable) {
      return {
        icon: "map-outline" as const,
        title: "Native map is not available",
        description:
          "This build does not have a configured native map provider. Verify Google Maps setup and rebuild.",
      };
    }

    if (runtimeFailure) {
      return {
        icon: "alert-circle-outline" as const,
        title: "Native map failed to initialize",
        description: `Native map runtime error: ${runtimeFailure}`,
      };
    }

    return {
      icon: "map-outline" as const,
      title: "Map is not available",
      description:
        "Interactive maps are currently unavailable, but ride operations continue below.",
    };
  })();

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#042F40" />
      </View>
    );

  if (!rideId || !ride)
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
          <Ionicons name="car-sport-outline" size={40} color="#D1D5DB" />
        </View>
        <Text className="text-lg font-bold text-gray-800 text-center mb-2">
          <T>Ride details unavailable</T>
        </Text>
        <Text className="text-sm text-gray-400 text-center mb-6">
          <T>We could not load this live ride right now.</T>
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary rounded-2xl px-8 py-3"
        >
          <Text className="text-white font-bold">
            <T>Go Back</T>
          </Text>
        </TouchableOpacity>
      </View>
    );

  // ═════════════════════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={["top", "bottom"]} className="flex-1">
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
            className="flex-1 mx-3 bg-white rounded-2xl px-4 py-2.5 flex-row items-center"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
            }}
          >
            <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2" />
            <View className="flex-1">
              <Text className="text-sm font-bold text-gray-900">
                <T>Ride In Progress</T>
              </Text>
              {rideTimerLabel ? (
                <Text className="text-[11px] text-slate-500 mt-0.5">
                  <T>Timer</T>: {rideTimerLabel}
                </Text>
              ) : null}
            </View>
            <Text className="text-xs text-gray-400">
              {checkedIn}/{bookings.length} <T>checked in</T>
            </Text>
          </View>
        </View>

        {showMapCanvas ? (
          <View className="mx-5 mt-3 h-[280px] overflow-hidden rounded-[28px] bg-white">
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
                  zoomLevel: ACTIVE_RIDE_AUTO_LOCATION_ZOOM_LEVEL,
                }}
                animationDuration={1200}
              />
              <LocationPuck />
              {mapRouteCoordinates.length > 1 && (
                <Polyline
                  coordinates={mapRouteCoordinates}
                  strokeColor="#042F40"
                  strokeWidth={4}
                />
              )}
              {Object.entries(passengerLocations).map(([userId, loc]) => {
                const passengerLabel =
                  loc.name?.trim()?.split(" ")[0] || "Passenger";

                return (
                  <Marker
                    key={`passenger-${userId}`}
                    coordinate={{
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                    }}
                    anchor={{ x: 0.5, y: 1 }}
                  >
                    <View className="items-center">
                      <View className="h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-accent items-center justify-center">
                        {loc.profile_picture ? (
                          <Image
                            source={{ uri: loc.profile_picture }}
                            className="h-full w-full"
                          />
                        ) : (
                          <Ionicons name="person" size={14} color="#fff" />
                        )}
                      </View>
                      <View className="mt-1 rounded-full border border-slate-200 bg-white/95 px-2.5 py-1">
                        <Text className="text-[10px] font-semibold text-slate-700">
                          {passengerLabel}
                        </Text>
                      </View>
                    </View>
                  </Marker>
                );
              })}
            </MapView>
            <View className="absolute right-3 top-3 gap-2">
              {provider === "mapbox" && showMapCanvas ? (
                <TouchableOpacity
                  onPress={handleToggleInAppNavigation}
                  disabled={navigationLoading}
                  className={`w-10 h-10 rounded-full items-center justify-center ${
                    isNavigating ? "bg-[#042F40]" : "bg-white/95"
                  }`}
                >
                  {navigationLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={isNavigating ? "#FFFFFF" : "#042F40"}
                    />
                  ) : (
                    <Ionicons
                      name={isNavigating ? "stop-circle-outline" : "navigate"}
                      size={20}
                      color={isNavigating ? "#FFFFFF" : "#042F40"}
                    />
                  )}
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() =>
                  setMapType((current) =>
                    current === "satellite" ? "standard" : "satellite",
                  )
                }
                className="bg-white/95 w-10 h-10 rounded-full items-center justify-center"
              >
                <Ionicons
                  name={
                    mapType === "satellite" ? "map-outline" : "layers-outline"
                  }
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
                      zoomLevel: ACTIVE_RIDE_AUTO_LOCATION_ZOOM_LEVEL,
                      animationDuration: 800,
                    });
                }}
                className="bg-white/95 w-10 h-10 rounded-full items-center justify-center"
              >
                <Ionicons name="locate" size={20} color="#042F40" />
              </TouchableOpacity>
            </View>
            {isNavigating ? (
              <View className="absolute bottom-3 left-3 right-3 rounded-2xl border border-slate-200 bg-white/95 px-3 py-3">
                <Text className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  In-App Navigation
                </Text>
                <Text className="mt-1 text-sm font-semibold text-slate-900">
                  {navigationNotice ||
                    currentNavigationStep?.instruction ||
                    "Follow the highlighted route"}
                </Text>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-[11px] text-slate-600">
                    Remaining {formatDistanceLabel(remainingNavigationDistance)}
                  </Text>
                  <Text className="text-[11px] text-slate-600">
                    ETA {formatDurationLabel(remainingNavigationDuration)}
                  </Text>
                </View>
                {offRouteDistanceMeters !== null &&
                offRouteDistanceMeters > NAV_REROUTE_THRESHOLD_METERS ? (
                  <Text className="mt-1 text-[11px] font-medium text-amber-700">
                    Off route by {formatDistanceLabel(offRouteDistanceMeters)}.
                    Rerouting...
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View className="mx-5 mt-3 rounded-[28px] border border-slate-200 bg-white px-5 py-5">
            <View className="flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                <Ionicons
                  name={mapFallbackInfo.icon}
                  size={20}
                  color="#475569"
                />
              </View>
              <Text className="ml-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Active Ride
              </Text>
            </View>
            <Text className="mt-3 text-2xl font-bold text-slate-900">
              {mapFallbackInfo.title}
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-600">
              {mapFallbackInfo.description}
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-600">
              Check-ins, passenger payments, and ride completion actions remain
              fully available while the map view is unavailable.
            </Text>
            {safeMode ? (
              <TouchableOpacity
                onPress={() => router.push("/bootstrap")}
                className="mt-5 rounded-2xl bg-primary px-4 py-3 items-center"
              >
                <Text className="text-sm font-semibold text-white">
                  <T>Try Map Again</T>
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <ScrollView
          className="flex-1 mt-3"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 28 }}
        >
          <View className="px-5 pb-2">
            <View className="mb-4 rounded-[24px] bg-[#042F40] px-4 py-4">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4A017]">
                Driver Operations
              </Text>
              <Text className="mt-1 text-lg font-bold text-white">
                <T>Ride In Progress</T>
              </Text>
              <Text className="mt-1 text-xs leading-5 text-slate-300">
                <T>
                  Monitor passenger progress, confirm transfers, and wrap up the
                  trip from one sheet.
                </T>
              </Text>
            </View>

            <View className="mb-3 flex-row gap-3">
              <View className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Driver Live
                </Text>
                <Text className="mt-1 text-sm font-bold text-slate-900">
                  {userLocation ? "Broadcasting location" : "GPS waking up"}
                </Text>
                <Text className="mt-1 text-xs text-slate-500">
                  {userLocation
                    ? "Visible to checked-in passengers"
                    : "Waiting for current coordinates"}
                </Text>
                {userLocation ? (
                  <Text className="mt-1 text-[11px] text-slate-400">
                    {userLocation.latitude.toFixed(5)},{" "}
                    {userLocation.longitude.toFixed(5)}
                  </Text>
                ) : null}
              </View>
              <View className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Passenger live
                </Text>
                <Text className="mt-1 text-sm font-bold text-slate-900">
                  {Object.keys(passengerLocations).length} tracked passenger
                  {Object.keys(passengerLocations).length === 1 ? "" : "s"}
                </Text>
                <Text className="mt-1 text-xs text-slate-500">
                  {formatLiveStatus(lastPassengerUpdate)}
                </Text>
              </View>
            </View>
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
                  const paymentSent =
                    isTransfer && bk.payment_status === "sent";
                  const paymentConfirmed =
                    isTransfer && bk.payment_status === "paid";
                  const paymentPending =
                    isTransfer && bk.payment_status === "pending";
                  return (
                    <View
                      key={bk._id}
                      className="bg-gray-50 rounded-xl p-3 mb-2"
                    >
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
                          {usr?._id && passengerLocations[usr._id] ? (
                            <Text className="mt-1 text-[10px] text-slate-500">
                              {formatLiveStatus(
                                passengerLocations[usr._id]?.timestamp,
                              )}{" "}
                              ·{" "}
                              {passengerLocations[usr._id]?.latitude.toFixed(5)}
                              ,{" "}
                              {passengerLocations[usr._id]?.longitude.toFixed(
                                5,
                              )}
                            </Text>
                          ) : (
                            <Text className="mt-1 text-[10px] text-slate-400">
                              Live location will appear once the rider shares it
                            </Text>
                          )}
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
                                  ? "Transfer confirmed"
                                  : paymentSent
                                    ? "Transfer sent"
                                    : "Transfer pending"}
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
                              <Text className="text-[10px] text-gray-400">
                                —
                              </Text>
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
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* ── Ride Completed Overlay ──────────────────────────────────── */}
      {rideCompleted && (
        <View className="absolute inset-0 z-50 bg-white">
          <SafeAreaView
            edges={["top", "bottom"]}
            className="flex-1 justify-center px-6"
          >
            <Animated.View
              entering={FadeInUp.duration(500)}
              className="rounded-[32px] border border-slate-200 bg-white px-6 py-7"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.08,
                shadowRadius: 20,
              }}
            >
              <View className="items-center">
                <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                  <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
                </View>
                <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  <T>Trip Complete</T>
                </Text>
                <Text className="mt-2 text-center text-2xl font-bold text-slate-900">
                  <T>Ride Completed!</T>
                </Text>
                <Text className="mt-2 text-center text-sm leading-6 text-slate-500">
                  <T>Great job! Your ride has been completed successfully.</T>
                </Text>
              </View>

              <View className="mt-6 w-full rounded-[28px] bg-slate-50 p-5">
                <View className="mb-4 flex-row items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <T>Ride Summary</T>
                  </Text>
                  <View className="rounded-full bg-emerald-50 px-3 py-1.5">
                    <Text className="text-[11px] font-semibold text-emerald-700">
                      <T>Completed</T>
                    </Text>
                  </View>
                </View>
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
                <View className="flex-row justify-between border-t border-slate-200 pt-4">
                  <View className="items-center flex-1">
                    <Text className="text-lg font-bold text-primary">
                      {completedModalPassengerCount}
                    </Text>
                    <Text className="text-[10px] text-gray-400">
                      <T>Passengers</T>
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-lg font-bold text-primary">
                      ₦{completedModalFare.toLocaleString()}
                    </Text>
                    <Text className="text-[10px] text-gray-400">
                      <T>Earnings</T>
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-lg font-bold text-green-600">
                      {completedModalCheckedIn}/{completedModalPassengerCount}
                    </Text>
                    <Text className="text-[10px] text-gray-400">
                      <T>Checked In</T>
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleBackToHome}
                className="mt-6 w-full items-center rounded-2xl bg-primary py-4"
              >
                <Text className="text-white font-bold text-base">
                  <T>Back to Home</T>
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/(drivers)/earnings" as any)}
                className="mt-3 w-full flex-row items-center justify-center rounded-2xl border border-green-100 bg-green-50 py-3.5"
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
