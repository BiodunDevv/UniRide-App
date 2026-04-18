import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  BackHandler,
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  InteractionManager,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  MapView,
  Camera,
  LocationPuck,
  Marker,
  Polyline,
  useMapProvider,
} from "@/components/map/ExpoMap";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";

import { useRideStore, Booking, Ride } from "@/store/useRideStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useSocket } from "@/hooks/use-socket";
import { eventBus } from "@/lib/eventBus";
import { T } from "@/hooks/use-translation";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { recordBootstrapTrace } from "@/lib/post-auth";
import { useLocation } from "@/hooks/use-location";
import { locationApi } from "@/lib/rideApi";
import {
  resolveSafeCenter,
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

function getBookingRideId(booking: Booking | null | undefined): string | null {
  if (!booking) return null;
  const value = booking.ride_id;
  if (!value) return null;
  if (typeof value === "object") {
    return value._id || null;
  }

  return value;
}

export default function UserActiveRideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    rideId?: string | string[];
    routeId?: string | string[];
  }>();
  const { user } = useAuthStore();
  const {
    myBookings,
    fetchMyBookings,
    cancelBooking,
    fetchRideDetails,
    updatePaymentStatus,
  } = useRideStore();
  const { userLocation } = useLocationStore();
  const mapsFeatureEnabled = usePlatformSettingsStore(
    (state) =>
      state.settings.mobile_map_enabled ?? state.settings.expo_maps_enabled,
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
  const {
    connect,
    joinRide,
    leaveRide,
    streamPassengerLocation,
    joinUserFeed,
  } = useSocket();
  const cameraRef = useRef<{ setCamera: (opts: any) => void }>(null);
  const { requestPermission, startWatching } = useLocation();

  const [ride, setRide] = useState<Ride | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [driverCoords, setDriverCoords] = useState<[number, number] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [markingSent, setMarkingSent] = useState(false);
  const rideIdRef = useRef<string | null>(null);
  const [rideCompleted, setRideCompleted] = useState(false);
  const [mapType, setMapType] = useState<"satellite" | "standard">("satellite");
  const [allowMapCanvas, setAllowMapCanvas] = useState(false);
  const [driverLastUpdated, setDriverLastUpdated] = useState<string | null>(
    null,
  );
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
  const preferredRideId = useMemo(() => {
    const value = params.rideId ?? params.routeId;
    if (Array.isArray(value)) return value[0] || null;
    return value || null;
  }, [params.rideId, params.routeId]);

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
      "user-active-ride:mount",
      safeMode ? "safe-mode" : "full-mode",
    ).catch(() => {});

    return () => {
      cancelled = true;
      interactionHandle.cancel();
    };
  }, [canRenderMaps, mapsFeatureEnabled, safeMode]);

  useEffect(() => {
    if (safeMode) return;
    requestPermission()
      .then((granted) => {
        if (granted) {
          startWatching();
        }
      })
      .catch(() => {});
  }, [requestPermission, safeMode, startWatching]);

  // ── Find active booking & join ride room ──────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      await connect();
      if (user?.id) {
        joinUserFeed(user.id);
      }
      await fetchMyBookings();
      const bks = useRideStore.getState().myBookings;
      const preferredBooking = preferredRideId
        ? bks.find((b) => {
            const bookingRideId = getBookingRideId(b);
            return (
              bookingRideId === preferredRideId &&
              ["in_progress", "accepted", "pending", "completed"].includes(
                b.status,
              )
            );
          }) || null
        : null;
      const active = bks.find(
        (b) =>
          b.status === "in_progress" ||
          b.status === "accepted" ||
          b.status === "pending",
      );
      const completed = bks.find((b) => b.status === "completed") || null;
      const targetBooking = preferredBooking || active || completed;

      if (targetBooking) {
        setBooking(targetBooking);
        if (targetBooking.status === "completed") {
          setRideCompleted(true);
        }
        const rideId = getBookingRideId(targetBooking);
        if (rideId) {
          rideIdRef.current = rideId;
          joinRide(rideId);
          try {
            const r = await fetchRideDetails(rideId);
            setRide(r);
            if (r?.status === "completed") {
              setRideCompleted(true);
            }
            const safeDriverCoords = sanitizeLngLatTuple(
              r.current_location?.coordinates,
            );
            if (safeDriverCoords) {
              setDriverCoords(safeDriverCoords);
              setDriverLastUpdated(new Date().toISOString());
            }
          } catch {}
        }
      }
      setLoading(false);
    })();
    return () => {
      if (rideIdRef.current) leaveRide(rideIdRef.current);
    };
  }, [
    connect,
    fetchMyBookings,
    fetchRideDetails,
    joinRide,
    joinUserFeed,
    leaveRide,
    preferredRideId,
    user?.id,
  ]);

  // ── Socket: driver location ───────────────────────────────────────
  useEffect(() => {
    const unsub = eventBus.on("driver-location-updated", (data: any) => {
      const latitude = data?.location?.latitude ?? data?.latitude;
      const longitude = data?.location?.longitude ?? data?.longitude;
      const safeCoords = sanitizeLngLatTuple([longitude, latitude]);
      if (safeCoords) {
        setDriverCoords(safeCoords);
        setDriverLastUpdated(
          data?.timestamp
            ? new Date(data.timestamp).toISOString()
            : new Date().toISOString(),
        );
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!booking || !user || !userLocation) return;

    const rideId =
      typeof booking.ride_id === "object"
        ? booking.ride_id._id
        : booking.ride_id;
    if (!rideId) return;

    const emitLocation = () => {
      const liveLocation = useLocationStore.getState().userLocation;
      if (!liveLocation) return;
      streamPassengerLocation(
        user.id,
        String(rideId),
        liveLocation.latitude,
        liveLocation.longitude,
        user.name,
        user.profile_picture || null,
      );
      locationApi
        .updateUserLocation({
          latitude: liveLocation.latitude,
          longitude: liveLocation.longitude,
        })
        .catch(() => {});
    };

    emitLocation();
    const interval = setInterval(emitLocation, 5000);
    return () => clearInterval(interval);
  }, [booking, streamPassengerLocation, user, userLocation]);

  // ── Socket: booking / ride status changes ─────────────────────────
  useEffect(() => {
    const refresh = async () => {
      if (rideIdRef.current) {
        try {
          const r = await fetchRideDetails(rideIdRef.current);
          setRide(r);
        } catch {}
      }
      await fetchMyBookings();
      const bks = useRideStore.getState().myBookings;
      const pinnedByRideId = preferredRideId
        ? bks.find((b) => getBookingRideId(b) === preferredRideId) || null
        : null;
      const updated =
        pinnedByRideId ||
        (booking ? bks.find((b) => b._id === booking._id) || null : null);

      if (updated) {
        setBooking(updated);
        const updatedRideId = getBookingRideId(updated);
        if (updatedRideId && updatedRideId !== rideIdRef.current) {
          if (rideIdRef.current) {
            leaveRide(rideIdRef.current);
          }
          rideIdRef.current = updatedRideId;
          joinRide(updatedRideId);
          try {
            const freshRide = await fetchRideDetails(updatedRideId);
            setRide(freshRide);
          } catch {}
        }

        if (updated.status === "completed") {
          setRideCompleted(true);
        } else if (updated.status === "cancelled") {
          router.back();
        }
      }
    };
    const u1 = eventBus.on("booking:updated", refresh);
    const u2 = eventBus.on("booking:cancelled", refresh);
    const u3 = eventBus.on("booking:checkin", refresh);
    const u4 = eventBus.on("ride:accepted", refresh);
    const u5 = eventBus.on("ride:ended", refresh);
    const u6 = eventBus.on("ride:started", refresh);
    const u7 = eventBus.on("ride:cancelled", refresh);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
    };
  }, [
    booking,
    fetchMyBookings,
    fetchRideDetails,
    joinRide,
    leaveRide,
    preferredRideId,
    router,
  ]);

  useEffect(() => {
    const s = BackHandler.addEventListener("hardwareBackPress", () => {
      router.back();
      return true;
    });
    return () => s.remove();
  }, []);

  const handleCancel = () => {
    if (!booking) return;
    Alert.alert("Cancel Booking?", "This cannot be undone.", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setCancelling(true);
          try {
            await cancelBooking(booking._id);
            router.back();
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed");
          }
          setCancelling(false);
        },
      },
    ]);
  };

  const handleMarkSent = async () => {
    if (!booking) return;
    Alert.alert(
      "Confirm Transfer",
      "Have you sent the transfer payment to the driver's bank account?",
      [
        { text: "Not Yet", style: "cancel" },
        {
          text: "Yes, I've Sent It",
          onPress: async () => {
            setMarkingSent(true);
            try {
              await updatePaymentStatus(booking._id, "sent");
              setBooking({ ...booking, payment_status: "sent" });
              Alert.alert(
                "Transfer Noted",
                "Your driver will be notified to confirm receipt.",
              );
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed");
            }
            setMarkingSent(false);
          },
        },
      ],
    );
  };

  const copyAcct = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInGoogleMaps = useCallback(async () => {
    const activeCoords =
      driverCoords ||
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
  }, [driverCoords, ride]);

  // ── Map data ──────────────────────────────────────────────────────
  const routeCoordinates = sanitizeRouteGeometry(ride?.route_geometry);

  const pickup =
    ride && typeof ride.pickup_location_id === "object"
      ? ride.pickup_location_id
      : null;
  const dest =
    ride && typeof ride.destination_id === "object"
      ? ride.destination_id
      : null;
  const bookingRideObj =
    booking?.ride_id && typeof booking.ride_id === "object"
      ? booking.ride_id
      : null;
  const rideDriverObj =
    ride?.driver_id && typeof ride.driver_id === "object"
      ? ride.driver_id
      : null;
  const bookingRideDriverObj =
    bookingRideObj?.driver_id && typeof bookingRideObj.driver_id === "object"
      ? bookingRideObj.driver_id
      : null;
  const driverObj: any = rideDriverObj || bookingRideDriverObj;
  const driverUser: any =
    driverObj?.user_id && typeof driverObj.user_id === "object"
      ? driverObj.user_id
      : null;
  const needsCheckIn =
    booking?.status === "accepted" && booking?.check_in_status !== "checked_in";
  const driverName = driverUser?.name || driverObj?.name || "Driver";
  const driverPic = driverUser?.profile_picture || driverObj?.profile_picture;
  const driverId = driverObj?._id || null;
  const driverMapLabel = driverName.split(" ")[0] || "Driver";
  const driverInitials = driverName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const showBankDetails =
    booking?.payment_method === "transfer" &&
    (booking?.status === "accepted" || booking?.status === "in_progress");
  const transferPaymentStatus =
    booking?.payment_status === "paid" || booking?.payment_status === "sent"
      ? booking.payment_status
      : "pending";
  const hasDriverAccountNumber = Boolean(
    driverObj?.bank_account_number?.trim?.(),
  );
  const canMarkSent = showBankDetails && transferPaymentStatus === "pending";
  const totalFare = booking?.total_fare || ride?.fare || 0;
  const driverBankName = driverObj?.bank_name?.trim?.() || "Not added yet";
  const driverBankAccountNumber =
    driverObj?.bank_account_number?.trim?.() || "Not added yet";
  const driverBankAccountName =
    driverObj?.bank_account_name?.trim?.() || "Not added yet";

  useEffect(() => {
    if (!__DEV__ || !booking || !showBankDetails) return;

    if (!driverObj) {
      console.info(
        "[ActiveRide][TransferDebug] Missing populated driver_id in ride details payload",
        {
          bookingId: booking._id,
          rideId: ride?._id,
          bookingStatus: booking.status,
          paymentStatus: booking.payment_status,
          hasRideDriverId: Boolean(ride?.driver_id),
          hasBookingRideDriverId: Boolean(bookingRideDriverObj),
        },
      );
      return;
    }

    const missingFields: string[] = [];
    if (!driverObj.bank_name?.trim?.()) missingFields.push("bank_name");
    if (!driverObj.bank_account_number?.trim?.())
      missingFields.push("bank_account_number");
    if (!driverObj.bank_account_name?.trim?.())
      missingFields.push("bank_account_name");

    if (missingFields.length > 0) {
      console.info(
        "[ActiveRide][TransferDebug] Transfer flow missing bank fields on driver_id",
        {
          bookingId: booking._id,
          rideId: ride?._id,
          driverId: driverObj._id,
          missingFields,
          driverKeys: Object.keys(driverObj),
        },
      );
    }
  }, [
    booking?._id,
    booking?.payment_method,
    booking?.payment_status,
    booking?.status,
    driverObj,
    bookingRideDriverObj,
    ride?._id,
    ride?.driver_id,
    showBankDetails,
  ]);

  const center = resolveSafeCenter(driverCoords, userLocation);
  const showMapCanvas =
    mapsFeatureEnabled && canRenderMaps && allowMapCanvas && !safeMode;
  const destinationTuple =
    sanitizeLngLatTuple(ride?.destination?.coordinates) ||
    sanitizeLngLatTuple(
      dest && typeof dest === "object"
        ? (dest as any).coordinates?.coordinates || (dest as any).coordinates
        : null,
    );
  const navigationOriginTuple =
    sanitizeLngLatTuple(
      userLocation
        ? [userLocation.longitude, userLocation.latitude]
        : ride?.current_location?.coordinates,
    ) || driverCoords;

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
        origin: navigationOriginTuple,
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

  const openDriverProfile = useCallback(() => {
    if (!driverId) return;
    router.push({
      pathname: "/(users)/driver-profile" as any,
      params: { driverId },
    });
  }, [driverId, router]);

  const handleBackToHome = useCallback(() => {
    setRideCompleted(false);
    if (rideIdRef.current) {
      leaveRide(rideIdRef.current);
      rideIdRef.current = null;
    }
    router.replace("/(users)" as any);
  }, [leaveRide, router]);

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#042F40" />
      </View>
    );
  if (!booking)
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
          <Ionicons name="car-outline" size={40} color="#D1D5DB" />
        </View>
        <Text className="text-lg font-bold text-gray-800 text-center mb-2">
          <T>No Active Ride</T>
        </Text>
        <Text className="text-sm text-gray-400 text-center mb-6">
          <T>{"You don't have an active ride right now"}</T>
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

  if (!ride)
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
          <Ionicons name="navigate-outline" size={40} color="#D1D5DB" />
        </View>
        <Text className="text-lg font-bold text-gray-800 text-center mb-2">
          <T>Ride details unavailable</T>
        </Text>
        <Text className="text-sm text-gray-400 text-center mb-6">
          <T>
            Your booking is active, but the live ride details could not load.
          </T>
        </Text>
        <TouchableOpacity
          onPress={() =>
            fetchRideDetails(
              typeof booking.ride_id === "object"
                ? booking.ride_id._id
                : booking.ride_id,
            )
              .then(setRide)
              .catch(() => router.back())
          }
          className="bg-primary rounded-2xl px-8 py-3"
        >
          <Text className="text-white font-bold">
            <T>Retry</T>
          </Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={["top", "bottom"]} className="flex-1">
        <View className="mx-5 mt-2 flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-white w-10 h-10 rounded-full items-center justify-center"
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
            className="flex-1 mx-3 bg-white rounded-2xl px-4 py-2.5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
            }}
          >
            <Text className="text-sm font-bold text-gray-900">
              {booking.status === "in_progress" ? (
                <T>Ride In Progress</T>
              ) : booking.status === "accepted" ? (
                <T>Ready for Check-in</T>
              ) : (
                <T>Booking Pending</T>
              )}
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
              {driverCoords && (
                <Marker
                  coordinate={{
                    latitude: driverCoords[1],
                    longitude: driverCoords[0],
                  }}
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={false}
                >
                  <View className="items-center">
                    <Image
                      source={require("@/assets/images/car-marker.png")}
                      style={{ width: 38, height: 38 }}
                      resizeMode="contain"
                    />
                    <View className="mt-1 rounded-full border border-slate-200 bg-white/95 px-2.5 py-1">
                      <Text className="text-[10px] font-semibold text-slate-700">
                        {driverMapLabel}
                      </Text>
                    </View>
                  </View>
                </Marker>
              )}
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
                Ride Tracking
              </Text>
            </View>
            <Text className="mt-3 text-2xl font-bold text-slate-900">
              {mapFallbackInfo.title}
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-600">
              {mapFallbackInfo.description}
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-600">
              Your booking, driver updates, fare, and check-in flow remain
              active while the map view is unavailable.
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
                Live Trip
              </Text>
              <Text className="mt-1 text-lg font-bold text-white">
                {booking.status === "in_progress" ? (
                  <T>Ride In Progress</T>
                ) : booking.status === "accepted" ? (
                  <T>Ready for Check-in</T>
                ) : (
                  <T>Booking Pending</T>
                )}
              </Text>
              <Text className="mt-1 text-xs leading-5 text-slate-300">
                <T>
                  Follow the latest ride status, driver details, and payment
                  steps from one place.
                </T>
              </Text>
            </View>

            <View className="mb-3 flex-row gap-3">
              <View className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Driver live
                </Text>
                <Text className="mt-1 text-sm font-bold text-slate-900">
                  {driverCoords ? "Tracking your driver" : "Waiting for driver"}
                </Text>
                <Text className="mt-1 text-xs text-slate-500">
                  {formatLiveStatus(driverLastUpdated)}
                </Text>
                {driverCoords ? (
                  <Text className="mt-1 text-[11px] text-slate-400">
                    {driverCoords[1].toFixed(5)}, {driverCoords[0].toFixed(5)}
                  </Text>
                ) : null}
              </View>
              <View className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Your location
                </Text>
                <Text className="mt-1 text-sm font-bold text-slate-900">
                  {userLocation
                    ? "Sharing current position"
                    : "Location pending"}
                </Text>
                <Text className="mt-1 text-xs text-slate-500">
                  {userLocation
                    ? "Visible for ride coordination"
                    : "Waiting for GPS access"}
                </Text>
                {userLocation ? (
                  <Text className="mt-1 text-[11px] text-slate-400">
                    {userLocation.latitude.toFixed(5)},{" "}
                    {userLocation.longitude.toFixed(5)}
                  </Text>
                ) : null}
              </View>
            </View>
            {/* Route Summary */}
            <View className="flex-row items-center mb-3">
              <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2" />
              <Text className="text-xs text-gray-500 flex-1" numberOfLines={1}>
                {pickup?.short_name || pickup?.name || "Pickup"}
              </Text>
              <Ionicons name="arrow-forward" size={12} color="#D1D5DB" />
              <View className="w-2.5 h-2.5 rounded-full bg-red-500 mx-2" />
              <Text
                className="text-xs text-gray-500 flex-1 text-right"
                numberOfLines={1}
              >
                {dest?.short_name || dest?.name || "Destination"}
              </Text>
            </View>

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

            {/* Driver Card with Profile Pic */}
            {driverObj && (
              <View className="bg-gray-50 rounded-xl p-3 mb-3">
                <View className="flex-row items-center">
                  {driverPic ? (
                    <Image
                      source={{ uri: driverPic }}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
                      <Text className="text-sm font-bold text-primary">
                        {driverInitials}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1 ml-3">
                    <Text className="text-sm font-semibold text-gray-800">
                      {driverName}
                    </Text>
                    <View className="flex-row items-center mt-0.5">
                      <Ionicons name="star" size={11} color="#D4A017" />
                      <Text className="text-[10px] font-semibold text-accent ml-0.5">
                        {typeof driverObj.rating === "number"
                          ? driverObj.rating.toFixed(1)
                          : "5.0"}
                      </Text>
                      {driverObj.vehicle_model && (
                        <Text className="text-[10px] text-gray-400 ml-2">
                          {driverObj.vehicle_model}
                        </Text>
                      )}
                    </View>
                    {driverObj.plate_number && (
                      <Text className="text-[10px] font-bold text-primary tracking-wider mt-0.5">
                        {driverObj.plate_number}
                      </Text>
                    )}
                  </View>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={openDriverProfile}
                      className="w-9 h-9 rounded-full bg-[#042F40] items-center justify-center"
                    >
                      <Ionicons name="person-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                    {driverObj.phone && (
                      <TouchableOpacity
                        onPress={() =>
                          Linking.openURL(`tel:${driverObj.phone}`)
                        }
                        className="w-9 h-9 rounded-full bg-green-50 items-center justify-center"
                      >
                        <Ionicons name="call" size={16} color="#16A34A" />
                      </TouchableOpacity>
                    )}
                    {driverCoords && (
                      <View className="w-2.5 h-2.5 rounded-full bg-green-500 self-center" />
                    )}
                  </View>
                </View>
                {driverObj.vehicle_image && (
                  <Image
                    source={{ uri: driverObj.vehicle_image }}
                    className="w-full h-24 rounded-lg mt-2"
                    resizeMode="cover"
                  />
                )}
                <TouchableOpacity
                  onPress={openDriverProfile}
                  activeOpacity={0.85}
                  className="mt-3 flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      Driver Profile
                    </Text>
                    <Text className="mt-1 text-sm font-semibold text-slate-900">
                      View driver info, ratings, and ride identity
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#042F40" />
                </TouchableOpacity>
              </View>
            )}

            {/* Bank Details (Transfer Payment) */}
            {showBankDetails && (
              <View className="mb-3 rounded-[26px] border border-slate-200 bg-white p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-violet-50">
                      <Ionicons name="card-outline" size={18} color="#7C3AED" />
                    </View>
                    <View>
                      <Text className="text-sm font-semibold text-slate-900">
                        <T>Transfer Payment</T>
                      </Text>
                      <Text className="text-xs text-slate-500">
                        {transferPaymentStatus === "paid" ? (
                          <T>Driver confirmed your transfer.</T>
                        ) : transferPaymentStatus === "sent" ? (
                          <T>Waiting for driver confirmation.</T>
                        ) : (
                          <T>{`Send ₦${Number(totalFare).toLocaleString()} to the driver's account.`}</T>
                        )}
                      </Text>
                    </View>
                  </View>
                  <View
                    className={`rounded-full px-3 py-1.5 ${
                      transferPaymentStatus === "paid"
                        ? "bg-green-50"
                        : transferPaymentStatus === "sent"
                          ? "bg-blue-50"
                          : "bg-amber-50"
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        transferPaymentStatus === "paid"
                          ? "text-green-700"
                          : transferPaymentStatus === "sent"
                            ? "text-blue-700"
                            : "text-amber-700"
                      }`}
                    >
                      {transferPaymentStatus === "paid" ? (
                        <T>Confirmed</T>
                      ) : transferPaymentStatus === "sent" ? (
                        <T>Sent</T>
                      ) : (
                        <T>Pending</T>
                      )}
                    </Text>
                  </View>
                </View>

                <View className="mb-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <View className="flex-row justify-between">
                    <Text className="text-[11px] text-slate-500">
                      <T>Amount</T>
                    </Text>
                    <Text className="text-base font-bold text-slate-900">
                      ₦{Number(totalFare).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <View className="flex-row justify-between mb-1.5">
                    <Text className="text-[10px] text-gray-400">
                      <T>Bank Name</T>
                    </Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      {driverBankName}
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text className="text-[10px] text-gray-400">
                      <T>Account Number</T>
                    </Text>
                    <View className="items-end">
                      <Text className="text-xs font-semibold text-gray-800">
                        {driverBankAccountNumber}
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          copyAcct(
                            driverObj?.bank_account_number?.trim?.() || "",
                          )
                        }
                        disabled={!hasDriverAccountNumber}
                        className={`mt-1 flex-row items-center rounded-full border px-2.5 py-1 ${
                          hasDriverAccountNumber
                            ? "border-slate-900 bg-white"
                            : "border-slate-200 bg-slate-100"
                        }`}
                      >
                        <Ionicons
                          name={copied ? "checkmark-circle" : "copy-outline"}
                          size={13}
                          color={hasDriverAccountNumber ? "#0F172A" : "#94A3B8"}
                        />
                        <Text
                          className={`ml-1 text-[10px] font-semibold ${
                            hasDriverAccountNumber
                              ? "text-slate-900"
                              : "text-slate-400"
                          }`}
                        >
                          {copied ? "Copied" : "Copy"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View className="flex-row justify-between mb-1.5">
                    <Text className="text-[10px] text-gray-400">
                      <T>Account Name</T>
                    </Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      {driverBankAccountName}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] text-gray-400">
                      <T>Amount</T>
                    </Text>
                    <Text className="text-base font-bold text-primary">
                      ₦{Number(totalFare).toLocaleString()}
                    </Text>
                  </View>
                </View>
                {canMarkSent && (
                  <TouchableOpacity
                    onPress={handleMarkSent}
                    disabled={markingSent}
                    className="mt-3 rounded-2xl border border-[#042F40] bg-[#042F40] py-3 items-center"
                  >
                    {markingSent ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-white text-sm font-semibold">
                        <T>{"I've Sent the Money"}</T>
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Check-in Prompt */}
            {needsCheckIn && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/check-in" as any,
                    params: {
                      bookingId: booking._id,
                      rideId: ride?._id,
                      pickup: pickup?.short_name || pickup?.name || "Pickup",
                      destination:
                        dest?.short_name || dest?.name || "Destination",
                    },
                  })
                }
                className="mb-3 rounded-[24px] border border-slate-200 bg-white p-4"
              >
                <View className="flex-row items-center">
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-violet-50">
                    <Ionicons name="key-outline" size={18} color="#7C3AED" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-slate-900">
                      <T>Check-In Required</T>
                    </Text>
                    <Text className="text-xs text-slate-500">
                      <T>Open check-in and enter your boarding code.</T>
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </View>
                {booking.check_in_code && (
                  <View className="mt-3 self-start rounded-full bg-slate-100 px-3 py-1.5">
                    <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                      <T>Code Hint</T> · {booking.check_in_code}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Cancel */}
            {(booking.status === "pending" ||
              booking.status === "accepted") && (
              <TouchableOpacity
                onPress={handleCancel}
                disabled={cancelling}
                className="bg-red-50 rounded-2xl py-3.5 items-center border border-red-100"
              >
                {cancelling ? (
                  <ActivityIndicator color="#EF4444" />
                ) : (
                  <Text className="text-red-500 font-semibold text-sm">
                    <T>Cancel Booking</T>
                  </Text>
                )}
              </TouchableOpacity>
            )}
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
                  <T>
                    {
                      "You've arrived at your destination. Thanks for riding with UniRide."
                    }
                  </T>
                </Text>
              </View>

              <View className="mt-6 rounded-[28px] bg-slate-50 p-5">
                <View className="mb-4 flex-row items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <T>Journey Summary</T>
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
                      {pickup?.short_name || pickup?.name || "Pickup"}
                    </Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      {dest?.short_name || dest?.name || "Destination"}
                    </Text>
                  </View>
                </View>
                {driverObj && (
                  <View className="flex-row items-center border-t border-slate-200 pt-4">
                    {driverPic ? (
                      <Image
                        source={{ uri: driverPic }}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                        <Ionicons name="person" size={14} color="#042F40" />
                      </View>
                    )}
                    <Text className="text-xs font-semibold text-gray-800 ml-2 flex-1">
                      {driverName}
                    </Text>
                    <View className="flex-row items-center">
                      <Ionicons name="star" size={11} color="#D4A017" />
                      <Text className="text-[10px] font-semibold text-accent ml-0.5">
                        {typeof driverObj?.rating === "number"
                          ? driverObj.rating.toFixed(1)
                          : "5.0"}
                      </Text>
                    </View>
                  </View>
                )}
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
                onPress={() => router.push("/(users)/activity" as any)}
                className="mt-3 w-full flex-row items-center justify-center rounded-2xl border border-slate-200 bg-white py-3.5"
              >
                <Ionicons name="receipt-outline" size={16} color="#042F40" />
                <Text className="text-gray-700 font-semibold text-sm ml-2">
                  <T>View Activity</T>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}
