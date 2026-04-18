import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  BackHandler,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  RefreshControl,
  Linking,
  LayoutChangeEvent,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";

import { useRideStore, Ride, Booking } from "@/store/useRideStore";
import { useAuthStore } from "@/store/useAuthStore";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { useSocket } from "@/hooks/use-socket";
import { eventBus } from "@/lib/eventBus";
import { locationApi } from "@/lib/rideApi";
import { T } from "@/hooks/use-translation";

const STATUS_BADGES: Record<
  string,
  { bg: string; text: string; color: string }
> = {
  scheduled: {
    bg: "bg-purple-50",
    text: "Scheduled",
    color: "text-purple-600",
  },
  available: { bg: "bg-green-50", text: "Available", color: "text-green-600" },
  accepted: { bg: "bg-blue-50", text: "Accepted", color: "text-blue-600" },
  in_progress: {
    bg: "bg-amber-50",
    text: "In Progress",
    color: "text-amber-600",
  },
  completed: { bg: "bg-gray-50", text: "Completed", color: "text-gray-500" },
  cancelled: { bg: "bg-red-50", text: "Cancelled", color: "text-red-500" },
  pending: { bg: "bg-yellow-50", text: "Pending", color: "text-yellow-600" },
  declined: { bg: "bg-red-50", text: "Declined", color: "text-red-500" },
};

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

function formatAverageSpeed(
  distanceMeters?: number | null,
  durationSeconds?: number | null,
): string | null {
  if (!distanceMeters || !durationSeconds || durationSeconds <= 0) {
    return null;
  }

  const speedKmh = distanceMeters / 1000 / (durationSeconds / 3600);
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) {
    return null;
  }

  return `${speedKmh.toFixed(1)} km/h`;
}

export default function RideDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    rideId?: string;
    bookingId?: string;
  }>();
  const { user } = useAuthStore();
  const { settings } = usePlatformSettingsStore();
  const { connect, joinRide, leaveRide, joinUserFeed } = useSocket();
  const joinedRideRef = useRef<string | null>(null);
  const {
    fetchRideDetails,
    bookRide,
    cancelBooking,
    fetchActiveRides,
    setSelectedPickup,
    setSelectedDestination,
    updatePaymentStatus,
    myBookings,
    fetchMyBookings,
    isBooking,
  } = useRideStore();

  const [ride, setRide] = useState<Ride | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState(1);
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("cash");
  const [markingPaid, setMarkingPaid] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bottomActionHeight, setBottomActionHeight] = useState(0);
  const [elapsedClockMs, setElapsedClockMs] = useState(() => Date.now());
  const [driverProfileFallback, setDriverProfileFallback] = useState<{
    phone?: string | null;
    name?: string | null;
    profile_picture?: string | null;
  } | null>(null);
  const autoNavigateRideRef = useRef<string | null>(null);

  const loadDetails = useCallback(async () => {
    // If we have a bookingId, find it from myBookings first
    if (params.bookingId) {
      await fetchMyBookings();
      const bk = useRideStore
        .getState()
        .myBookings.find((b) => b._id === params.bookingId);
      if (bk) {
        setBooking(bk);
        const rideId =
          typeof bk.ride_id === "object" ? bk.ride_id._id : bk.ride_id;
        if (rideId) {
          const r = await fetchRideDetails(rideId);
          setRide(r);
        }
      }
      return;
    }

    if (params.rideId) {
      const r = await fetchRideDetails(params.rideId);
      setRide(r);
      await fetchMyBookings();
      const bk = useRideStore
        .getState()
        .myBookings.find(
          (b) =>
            (typeof b.ride_id === "object" ? b.ride_id._id : b.ride_id) ===
              params.rideId &&
            b.status !== "cancelled" &&
            b.status !== "declined",
        );
      if (bk) setBooking(bk);
    }
  }, [params.bookingId, params.rideId, fetchMyBookings, fetchRideDetails]);

  // ── Load data ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadDetails();
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Failed to load");
      }
      setLoading(false);
    })();
  }, [loadDetails]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDetails();
    } finally {
      setRefreshing(false);
    }
  }, [loadDetails]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, []);

  // ── Sync local state with store (real-time socket updates) ────────
  useEffect(() => {
    if (!booking) return;
    const updated = myBookings.find((b) => b._id === booking._id);
    if (updated && JSON.stringify(updated) !== JSON.stringify(booking)) {
      setBooking(updated);
    }
  }, [myBookings]);

  // Re-fetch ride when bookings update (ride status may have changed)
  useEffect(() => {
    const rideId =
      params.rideId ||
      (booking?.ride_id &&
        (typeof booking.ride_id === "object"
          ? booking.ride_id._id
          : booking.ride_id));
    if (rideId && !loading) {
      fetchRideDetails(rideId)
        .then(setRide)
        .catch(() => {});
    }
  }, [myBookings]);

  const currentRideId = useMemo(() => {
    if (ride?._id) return ride._id;
    if (params.rideId) return params.rideId;
    if (!booking?.ride_id) return null;
    return typeof booking.ride_id === "object"
      ? booking.ride_id._id
      : booking.ride_id;
  }, [booking?.ride_id, params.rideId, ride?._id]);

  useEffect(() => {
    if (!currentRideId) return;

    let cancelled = false;

    const connectAndJoin = async () => {
      try {
        await connect();
        if (user?.id) {
          joinUserFeed(user.id);
        }
      } catch {}

      if (cancelled) return;
      if (joinedRideRef.current === currentRideId) return;

      if (joinedRideRef.current) {
        leaveRide(joinedRideRef.current);
      }

      joinRide(currentRideId);
      joinedRideRef.current = currentRideId;
    };

    void connectAndJoin();

    return () => {
      cancelled = true;
    };
  }, [connect, currentRideId, joinRide, joinUserFeed, leaveRide, user?.id]);

  useEffect(() => {
    return () => {
      if (joinedRideRef.current) {
        leaveRide(joinedRideRef.current);
        joinedRideRef.current = null;
      }
    };
  }, [leaveRide]);

  useEffect(() => {
    const refreshIfCurrentRide = (payload?: Record<string, any>) => {
      const payloadRideId =
        typeof payload?.ride_id === "string" ? payload.ride_id : null;

      if (payloadRideId && currentRideId && payloadRideId !== currentRideId) {
        return;
      }

      void loadDetails().catch(() => {});
    };

    const off1 = eventBus.on("booking:updated", refreshIfCurrentRide);
    const off2 = eventBus.on("booking:cancelled", refreshIfCurrentRide);
    const off3 = eventBus.on("booking:checkin", refreshIfCurrentRide);
    const off4 = eventBus.on("ride:started", refreshIfCurrentRide);
    const off5 = eventBus.on("ride:ended", refreshIfCurrentRide);
    const off6 = eventBus.on("ride:accepted", refreshIfCurrentRide);
    const off7 = eventBus.on("ride:cancelled", refreshIfCurrentRide);

    return () => {
      off1();
      off2();
      off3();
      off4();
      off5();
      off6();
      off7();
    };
  }, [currentRideId, loadDetails]);

  // ── Derived ───────────────────────────────────────────────────────
  const pickup =
    ride && typeof ride.pickup_location_id === "object"
      ? ride.pickup_location_id
      : null;
  const dest =
    ride && typeof ride.destination_id === "object"
      ? ride.destination_id
      : null;
  const bookingRide =
    booking?.ride_id && typeof booking.ride_id === "object"
      ? booking.ride_id
      : null;
  const sharedBookings = useMemo(() => {
    const all = ride?.bookings || [];
    return all
      .filter((item) =>
        ["pending", "accepted", "in_progress"].includes(item.status),
      )
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });
  }, [ride?.bookings]);
  const rideDriverValue = ride?.driver_id ?? null;
  const bookingRideDriverValue = bookingRide?.driver_id ?? null;
  const rideDriverDoc =
    rideDriverValue && typeof rideDriverValue === "object"
      ? rideDriverValue
      : null;
  const bookingRideDriverDoc =
    bookingRideDriverValue && typeof bookingRideDriverValue === "object"
      ? bookingRideDriverValue
      : null;
  const driverDoc = rideDriverDoc || bookingRideDriverDoc;
  const driverUser =
    driverDoc?.user_id && typeof driverDoc.user_id === "object"
      ? driverDoc.user_id
      : null;
  const driverId =
    driverDoc?._id ||
    (typeof rideDriverValue === "string" ? rideDriverValue : null) ||
    (typeof bookingRideDriverValue === "string"
      ? bookingRideDriverValue
      : null) ||
    null;
  const hasAssignedDriver = Boolean(driverDoc || driverId);
  const driverNameRaw = driverUser?.name ?? driverDoc?.name ?? "";
  const driverName = driverNameRaw.trim();
  const driverPhoto = driverUser?.profile_picture || null;
  const driverPhoneRaw = driverUser?.phone ?? driverDoc?.phone ?? null;
  const driverPhone =
    driverPhoneRaw == null ? null : String(driverPhoneRaw).trim() || null;
  const resolvedDriverPhone =
    driverPhone ||
    (driverProfileFallback?.phone
      ? String(driverProfileFallback.phone).trim() || null
      : null);
  const resolvedDriverName =
    driverName ||
    (driverProfileFallback?.name
      ? String(driverProfileFallback.name).trim() || ""
      : "") ||
    (hasAssignedDriver ? "Driver assigned" : "Driver");
  const resolvedDriverPhoto =
    driverPhoto || driverProfileFallback?.profile_picture || null;
  const driverBankName = driverDoc?.bank_name?.trim?.() || "Not added yet";
  const driverBankAccountNumber =
    driverDoc?.bank_account_number?.trim?.() || "Not added yet";
  const driverBankAccountName =
    driverDoc?.bank_account_name?.trim?.() || "Not added yet";
  const seatsLeft = ride
    ? (ride.seats_remaining ?? ride.available_seats - ride.booked_seats)
    : 0;
  const maxSeats = Math.min(seatsLeft, settings.max_seats_per_booking || 10);
  const totalFare = settings.fare_per_seat
    ? ride?.fare
      ? ride.fare * seats
      : 0
    : ride?.fare || 0;
  const dep = ride?.departure_time ? new Date(ride.departure_time) : null;
  const dist = ride?.distance_meters
    ? `${(ride.distance_meters / 1000).toFixed(1)} km`
    : null;
  const dur = ride?.duration_seconds
    ? `${Math.round(ride.duration_seconds / 60)} min`
    : null;
  const avgSpeed = formatAverageSpeed(
    ride?.distance_meters,
    ride?.duration_seconds,
  );
  const routeIntelligence = useMemo(
    () => [
      {
        label: "Distance",
        value: dist || "Not available",
      },
      {
        label: "Duration",
        value: dur || "Not available",
      },
      {
        label: "Avg Speed",
        value: avgSpeed || "Not available",
      },
      {
        label: "Departure",
        value: dep
          ? dep.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "Flexible",
      },
      {
        label: "Fare / Seat",
        value: `₦${Number(ride?.fare || 0).toLocaleString()}`,
      },
      {
        label: "Seats Left",
        value: String(seatsLeft),
      },
    ],
    [avgSpeed, dep, dist, dur, ride?.fare, seatsLeft],
  );
  const canBook =
    ride &&
    !booking &&
    (ride.status === "available" ||
      ride.status === "scheduled" ||
      ride.status === "accepted") &&
    seatsLeft > 0;
  const hasBottomActions = Boolean(
    canBook ||
    (booking &&
      (booking.status === "pending" || booking.status === "accepted")),
  );
  const hasBookingPhone = Boolean(user?.phone?.trim());
  const needsCheckIn =
    booking?.status === "accepted" && booking?.check_in_status !== "checked_in";
  const isCheckedIn = booking?.check_in_status === "checked_in";
  const inProgress = ride?.status === "in_progress";
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
  const isTransfer = booking?.payment_method === "transfer";
  const isTransferBookingFlow =
    booking?.status === "accepted" || booking?.status === "in_progress";
  const transferPaymentStatus =
    booking?.payment_status === "paid" || booking?.payment_status === "sent"
      ? booking.payment_status
      : "pending";
  const hasDriverAccountNumber = Boolean(
    driverDoc?.bank_account_number?.trim?.(),
  );
  const transferAmount = Number(booking?.total_fare || ride?.fare || 0);
  const canMarkSent =
    isTransfer && isTransferBookingFlow && transferPaymentStatus === "pending";

  useEffect(() => {
    let cancelled = false;

    if (!driverId) {
      setDriverProfileFallback(null);
      return;
    }

    if (driverPhone) {
      setDriverProfileFallback((prev) => ({
        ...prev,
        phone: driverPhone,
        name: driverName,
        profile_picture: driverPhoto,
      }));
      return;
    }

    const fetchPublicDriverProfile = async () => {
      try {
        const response = await locationApi.getPublicDriverProfile(driverId);
        if (cancelled) return;

        const payload = response?.data || {};
        setDriverProfileFallback({
          phone: payload.phone || null,
          name: payload.name || null,
          profile_picture: payload.profile_picture || null,
        });
      } catch {
        if (!cancelled) {
          setDriverProfileFallback((prev) => prev || null);
        }
      }
    };

    void fetchPublicDriverProfile();

    return () => {
      cancelled = true;
    };
  }, [driverId, driverName, driverPhone, driverPhoto]);

  useEffect(() => {
    if (!currentRideId || !booking || !ride) return;
    if (ride.status !== "in_progress") return;
    if (!["accepted", "in_progress"].includes(booking.status)) return;
    if (autoNavigateRideRef.current === currentRideId) return;

    autoNavigateRideRef.current = currentRideId;
    router.replace({
      pathname: "/(users)/active-ride" as any,
      params: { rideId: currentRideId },
    });
  }, [booking?.status, currentRideId, ride?.status, router]);

  useEffect(() => {
    if (!ride?.started_at || ride.status !== "in_progress") return;

    const timer = setInterval(() => {
      setElapsedClockMs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [ride?.started_at, ride?.status]);

  const timelineItems = useMemo(() => {
    if (!ride) {
      return [] as Array<{
        id: string;
        title: string;
        detail?: string;
        time?: string;
        tone?: "default" | "success" | "danger";
      }>;
    }

    const items: Array<{
      id: string;
      title: string;
      detail?: string;
      time?: string;
      tone?: "default" | "success" | "danger";
    }> = [
      {
        id: "ride-created",
        title: "Ride session created",
        detail: `${pickup?.short_name || pickup?.name || "Pickup"} → ${dest?.short_name || dest?.name || "Destination"}`,
        time: ride.createdAt,
        tone: "success",
      },
    ];

    if (booking) {
      items.push({
        id: "booking-created",
        title: "Booking submitted",
        detail: `${booking.seats_requested || 1} seat${(booking.seats_requested || 1) > 1 ? "s" : ""} · ${booking.payment_method}`,
        time: booking.booking_time || booking.createdAt,
        tone: "success",
      });
    }

    if (hasAssignedDriver) {
      items.push({
        id: "driver-assigned",
        title: "Driver assigned",
        detail: resolvedDriverName,
        time: ride.updatedAt,
        tone: "success",
      });
    }

    if (sharedBookings.length > 0) {
      items.push({
        id: "shared-ride",
        title: "Shared ride participants",
        detail: `${sharedBookings.length} booking${sharedBookings.length === 1 ? "" : "s"} on this route`,
        time: sharedBookings[0]?.createdAt || ride.updatedAt,
      });
    }

    if (booking?.check_in_status === "checked_in") {
      items.push({
        id: "checked-in",
        title: "Check-in completed",
        detail: "Your boarding code was verified",
        time: booking.updatedAt,
        tone: "success",
      });
    }

    if (["in_progress", "completed"].includes(ride.status)) {
      items.push({
        id: "started",
        title: "Ride started",
        detail: "Trip is in progress",
        time: ride.started_at || ride.updatedAt,
        tone: "success",
      });
    }

    if (ride.status === "completed") {
      items.push({
        id: "completed",
        title: "Ride completed",
        detail: "Session ended successfully",
        time: ride.ended_at || ride.updatedAt,
        tone: "success",
      });
    }

    if (ride.status === "cancelled") {
      items.push({
        id: "cancelled",
        title: "Ride cancelled",
        detail: ride.cancel_reason || "Cancellation reason not provided",
        time: ride.cancelled_at || ride.updatedAt,
        tone: "danger",
      });
    }

    if (booking?.status === "declined") {
      items.push({
        id: "declined",
        title: "Booking declined",
        detail: booking.admin_note || "No additional note provided",
        time: booking.updatedAt,
        tone: "danger",
      });
    }

    if (booking?.status === "cancelled" && ride.status !== "cancelled") {
      items.push({
        id: "booking-cancelled",
        title: "Booking cancelled",
        detail: booking.admin_note || "This booking was cancelled",
        time: booking.updatedAt,
        tone: "danger",
      });
    }

    return items;
  }, [
    ride,
    pickup,
    dest,
    booking,
    hasAssignedDriver,
    resolvedDriverName,
    sharedBookings,
  ]);

  const scrollBottomPadding = useMemo(() => {
    if (!hasBottomActions) return 120;
    return Math.max(120, bottomActionHeight + 28);
  }, [hasBottomActions, bottomActionHeight]);

  const handleBottomActionsLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setBottomActionHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  useEffect(() => {
    if (!__DEV__ || !booking || !isTransfer || !isTransferBookingFlow) return;

    if (!driverDoc) {
      console.info(
        "[RideDetails][TransferDebug] Missing populated driver_id in ride details payload",
        {
          bookingId: booking._id,
          rideId: ride?._id,
          bookingStatus: booking.status,
          paymentStatus: booking.payment_status,
          hasRideDriverId: Boolean(ride?.driver_id),
          hasBookingRideDriverId: Boolean(bookingRideDriverDoc),
        },
      );
      return;
    }

    const missingFields: string[] = [];
    if (!driverDoc.bank_name?.trim?.()) missingFields.push("bank_name");
    if (!driverDoc.bank_account_number?.trim?.())
      missingFields.push("bank_account_number");
    if (!driverDoc.bank_account_name?.trim?.())
      missingFields.push("bank_account_name");

    if (missingFields.length > 0) {
      console.info(
        "[RideDetails][TransferDebug] Transfer flow missing bank fields on driver_id",
        {
          bookingId: booking._id,
          rideId: ride?._id,
          driverId: driverDoc._id,
          missingFields,
          driverKeys: Object.keys(driverDoc),
        },
      );
    }
  }, [
    booking?._id,
    booking?.payment_method,
    booking?.payment_status,
    booking?.status,
    driverDoc,
    isTransfer,
    isTransferBookingFlow,
    bookingRideDriverDoc,
    ride?._id,
    ride?.driver_id,
  ]);

  const syncRouteAndOpenAvailableRides = useCallback(async () => {
    if (pickup && typeof pickup === "object") {
      setSelectedPickup(pickup as any);
    }
    if (dest && typeof dest === "object") {
      setSelectedDestination(dest as any);
    }

    await fetchActiveRides({
      pickup: pickup?._id,
      destination: dest?._id,
    });

    router.replace("/(users)/available-rides" as any);
  }, [
    pickup,
    dest,
    setSelectedPickup,
    setSelectedDestination,
    fetchActiveRides,
    router,
  ]);

  // ── Book ──────────────────────────────────────────────────────────
  const handleBook = async () => {
    if (!ride) return;
    if (!hasBookingPhone) {
      Alert.alert(
        "Phone number required",
        "Add your phone number before booking so your driver can call you about pickup.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Update Profile",
            onPress: () => router.push("/settings/edit-profile" as any),
          },
        ],
      );
      return;
    }
    try {
      const res = await bookRide(ride._id, payMethod, seats);
      setBooking(res.data || res);
      if (settings.auto_accept_bookings) {
        Alert.alert("Confirmed!", "Your booking has been auto-confirmed.");
      } else {
        Alert.alert("Booked!", "Waiting for driver confirmation.");
      }
      fetchMyBookings();
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.response?.data?.message || e?.message || "Booking failed",
      );
    }
  };

  // ── Cancel ────────────────────────────────────────────────────────
  const handleCancel = () => {
    if (!booking) return;
    Alert.alert("Cancel Booking", "Are you sure?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setCancelling(true);
          try {
            await cancelBooking(booking._id);
            setBooking({ ...booking, status: "cancelled" });
            await fetchMyBookings();
            setCancelling(false);
            await syncRouteAndOpenAvailableRides();
            return;
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed");
          }
          setCancelling(false);
        },
      },
    ]);
  };

  // ── Mark Transfer Sent ────────────────────────────────────────────
  const handleMarkSent = () => {
    if (!booking) return;
    Alert.alert(
      "Confirm Transfer",
      "Have you sent the transfer payment to the driver's bank account?",
      [
        { text: "Not Yet", style: "cancel" },
        {
          text: "Yes, I've Sent It",
          onPress: async () => {
            setMarkingPaid(true);
            try {
              await updatePaymentStatus(booking._id, "sent");
              setBooking({ ...booking, payment_status: "sent" as const });
              fetchMyBookings();
              Alert.alert(
                "Transfer Noted",
                "Your driver will be notified to confirm receipt.",
              );
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed to update");
            }
            setMarkingPaid(false);
          },
        },
      ],
    );
  };

  const handleCallDriver = async () => {
    if (!resolvedDriverPhone) {
      Alert.alert(
        "Phone unavailable",
        "This driver has not added a phone number yet.",
      );
      return;
    }
    const telUrl = `tel:${resolvedDriverPhone}`;
    const supported = await Linking.canOpenURL(telUrl);
    if (!supported) {
      Alert.alert(
        "Call unavailable",
        "This device cannot open the phone dialer.",
      );
      return;
    }
    Linking.openURL(telUrl);
  };

  const handleOpenDriverProfile = () => {
    if (!driverId) return;
    router.push({
      pathname: "/(users)/driver-profile" as any,
      params: { driverId },
    });
  };

  const copyAccountNumber = async () => {
    const accountNumber = driverDoc?.bank_account_number?.trim?.();
    if (!accountNumber) {
      Alert.alert(
        "Account number unavailable",
        "This driver has not added an account number yet.",
      );
      return;
    }
    await Clipboard.setStringAsync(accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenCheckIn = () => {
    if (!booking) return;
    router.push({
      pathname: "/check-in" as any,
      params: {
        bookingId: booking._id,
        rideId: ride?._id,
        pickup:
          pickup?.short_name ||
          pickup?.name ||
          ride?.pickup_location?.address ||
          "Pickup",
        destination:
          dest?.short_name ||
          dest?.name ||
          ride?.destination?.address ||
          "Destination",
      },
    });
  };

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#042F40" />
      </View>
    );
  if (!ride)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-400">
          <T>Ride not found</T>
        </Text>
      </View>
    );

  const badge =
    STATUS_BADGES[booking?.status || ride.status] || STATUS_BADGES.available;

  // ═════════════════════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* ── Header ─────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="px-5 pt-3 pb-2"
        >
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 h-10 w-10 rounded-full bg-white items-center justify-center"
            >
              <Ionicons name="arrow-back" size={20} color="#042F40" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Passenger Journey
              </Text>
              <Text className="mt-1 text-xl font-bold text-gray-900">
                <T>Ride Details</T>
              </Text>
            </View>
            <View className={`px-3 py-1 rounded-full ${badge.bg}`}>
              <Text className={`text-xs font-semibold ${badge.color}`}>
                <T>{badge.text}</T>
              </Text>
            </View>
          </View>
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            className="flex-1"
            contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#042F40"
              />
            }
          >
            {/* ── Route ───────────────────────────────────────────── */}
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
                    {pickup?.short_name ||
                      pickup?.name ||
                      ride.pickup_location?.address ||
                      "Pickup"}
                  </Text>
                  <Text className="text-xs text-gray-400 mb-5">
                    {pickup?.address || ""}
                  </Text>
                  <Text className="text-sm font-semibold text-gray-800">
                    {dest?.short_name ||
                      dest?.name ||
                      ride.destination?.address ||
                      "Destination"}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {dest?.address || ""}
                  </Text>
                </View>
              </View>
              {/* Stats */}
              <View className="flex-row mt-4 pt-3 border-t border-gray-200 gap-3">
                {dep && (
                  <View className="flex-1 items-center">
                    <Ionicons name="time-outline" size={16} color="#6B7280" />
                    <Text className="text-xs text-gray-500 mt-1">
                      {dep.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <Text className="text-xs font-semibold text-gray-700">
                      {dep.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                )}
                {dist && (
                  <View className="flex-1 items-center">
                    <Ionicons
                      name="navigate-outline"
                      size={16}
                      color="#6B7280"
                    />
                    <Text className="text-xs text-gray-500 mt-1">
                      <T>Distance</T>
                    </Text>
                    <Text className="text-xs font-semibold text-gray-700">
                      {dist}
                    </Text>
                  </View>
                )}
                {dur && (
                  <View className="flex-1 items-center">
                    <Ionicons name="timer-outline" size={16} color="#6B7280" />
                    <Text className="text-xs text-gray-500 mt-1">
                      <T>Duration</T>
                    </Text>
                    <Text className="text-xs font-semibold text-gray-700">
                      {dur}
                    </Text>
                  </View>
                )}
                <View className="flex-1 items-center">
                  <Ionicons name="people-outline" size={16} color="#6B7280" />
                  <Text className="text-xs text-gray-500 mt-1">
                    <T>Seats Left</T>
                  </Text>
                  <Text className="text-xs font-semibold text-gray-700">
                    {seatsLeft}
                  </Text>
                </View>
              </View>
            </Animated.View>

            <Animated.View
              entering={FadeInUp.delay(130).duration(300)}
              className="mx-5 mt-3"
            >
              <View className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Route Intelligence
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {routeIntelligence.map((item) => (
                    <View
                      key={item.label}
                      className="min-w-[31%] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                    >
                      <Text className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                        {item.label}
                      </Text>
                      <Text className="mt-1 text-xs font-semibold text-slate-900">
                        {item.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>

            <Animated.View
              entering={FadeInUp.delay(180).duration(300)}
              className="mx-5 mt-3 rounded-[26px] bg-[#042F40] px-4 py-4"
            >
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4A017]">
                Trip Summary
              </Text>
              <Text className="mt-2 text-lg font-bold text-white">
                {pickup?.short_name ||
                  pickup?.name ||
                  ride.pickup_location?.address ||
                  "Pickup"}{" "}
                {"→"}{" "}
                {dest?.short_name ||
                  dest?.name ||
                  ride.destination?.address ||
                  "Destination"}
              </Text>
              <View className="mt-4 flex-row gap-3">
                <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                  <Text className="text-[11px] text-slate-300">
                    <T>Seats</T>
                  </Text>
                  <Text className="mt-1 text-xl font-bold text-white">
                    {booking?.seats_requested || seats}
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                  <Text className="text-[11px] text-slate-300">
                    <T>Fare</T>
                  </Text>
                  <Text className="mt-1 text-xl font-bold text-white">
                    ₦{totalFare}
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                  <Text className="text-[11px] text-slate-300">
                    <T>Status</T>
                  </Text>
                  <Text className="mt-1 text-sm font-bold text-white">
                    <T>{badge.text}</T>
                  </Text>
                </View>
              </View>
              {rideTimerLabel && (
                <View className="mt-3 rounded-2xl bg-white/10 px-4 py-3">
                  <Text className="text-[11px] uppercase tracking-[0.16em] text-slate-300">
                    <T>Ride Timer</T>
                  </Text>
                  <Text className="mt-1 text-2xl font-bold text-white">
                    {rideTimerLabel}
                  </Text>
                </View>
              )}
            </Animated.View>

            <Animated.View
              entering={FadeInUp.delay(190).duration(300)}
              className="mx-5 mt-3"
            >
              <View className="rounded-[26px] border border-slate-200 bg-white p-4">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Session Timeline
                </Text>
                <View className="mt-3">
                  {timelineItems.map((item, index) => (
                    <View key={item.id} className="flex-row">
                      <View className="mr-3 items-center">
                        <View
                          className={`h-2.5 w-2.5 rounded-full ${
                            item.tone === "danger"
                              ? "bg-red-500"
                              : item.tone === "success"
                                ? "bg-emerald-500"
                                : "bg-slate-400"
                          }`}
                        />
                        {index < timelineItems.length - 1 && (
                          <View className="mt-1 h-8 w-px bg-slate-200" />
                        )}
                      </View>
                      <View className="flex-1 pb-2">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-sm font-semibold text-slate-900">
                            {item.title}
                          </Text>
                          {item.time ? (
                            <Text className="text-[10px] text-slate-400">
                              {new Date(item.time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </Text>
                          ) : null}
                        </View>
                        {item.detail ? (
                          <Text className="mt-0.5 text-xs text-slate-500">
                            {item.detail}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>

            {/* ── Driver Info ─────────────────────────────────────── */}
            {hasAssignedDriver && (
              <Animated.View
                entering={FadeInUp.delay(200).duration(300)}
                className="mx-5 mt-3 bg-gray-50 rounded-2xl p-4"
              >
                <View className="flex-row items-center">
                  {resolvedDriverPhoto ? (
                    <Image
                      source={{ uri: resolvedDriverPhoto }}
                      className="w-12 h-12 rounded-full mr-3"
                    />
                  ) : (
                    <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-3">
                      <Ionicons name="person" size={24} color="#042F40" />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-800">
                      {resolvedDriverName}
                    </Text>
                    {(driverDoc?.vehicle_model || driverDoc?.vehicle_color) && (
                      <Text className="text-xs text-gray-400 mt-0.5">
                        {[driverDoc?.vehicle_model, driverDoc?.vehicle_color]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    )}
                    {driverDoc?.plate_number && (
                      <Text className="text-xs text-gray-400">
                        {driverDoc?.plate_number}
                      </Text>
                    )}
                  </View>
                  {driverDoc?.rating != null && driverDoc?.rating > 0 && (
                    <View className="flex-row items-center bg-accent/10 rounded-full px-2.5 py-1">
                      <Ionicons name="star" size={12} color="#D4A017" />
                      <Text className="text-xs font-bold text-accent ml-1">
                        {typeof driverDoc?.rating === "number"
                          ? driverDoc.rating.toFixed(1)
                          : driverDoc?.rating}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="mt-4 flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={handleOpenDriverProfile}
                    activeOpacity={0.85}
                    className="flex-1 rounded-2xl bg-white px-4 py-3 border border-slate-200"
                  >
                    <Text className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      Driver Contact
                    </Text>
                    <Text className="mt-1 text-sm font-semibold text-slate-800">
                      {resolvedDriverPhone || "Phone not added yet"}
                    </Text>
                    <Text className="mt-1 text-xs text-slate-500">
                      {resolvedDriverPhone
                        ? "View the full driver profile or call."
                        : "Open profile to view full driver details."}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleOpenDriverProfile}
                    className="h-14 w-14 rounded-2xl items-center justify-center bg-[#042F40]"
                  >
                    <Ionicons name="person-outline" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCallDriver}
                    disabled={!resolvedDriverPhone}
                    className={`h-14 w-14 rounded-2xl items-center justify-center ${resolvedDriverPhone ? "bg-primary" : "bg-slate-200"}`}
                  >
                    <Ionicons
                      name="call"
                      size={20}
                      color={resolvedDriverPhone ? "#FFFFFF" : "#94A3B8"}
                    />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {!hasBookingPhone && canBook && (
              <Animated.View
                entering={FadeInUp.delay(230).duration(300)}
                className="mx-5 mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-4"
              >
                <View className="flex-row items-start">
                  <View className="mr-3 mt-0.5 h-10 w-10 items-center justify-center rounded-2xl bg-amber-100">
                    <Ionicons name="call-outline" size={20} color="#D97706" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-amber-800">
                      Phone number required
                    </Text>
                    <Text className="mt-1 text-xs leading-5 text-amber-700">
                      Add your phone number before booking so the driver can
                      contact you for pickup and ride coordination.
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        router.push("/settings/edit-profile" as any)
                      }
                      className="mt-3 self-start rounded-xl bg-amber-500 px-4 py-2.5"
                    >
                      <Text className="text-xs font-bold text-white">
                        <T>Complete Profile</T>
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* ── Fare ────────────────────────────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(250).duration(300)}
              className="mx-5 mt-3 bg-white rounded-2xl border border-slate-200 p-4"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-gray-600">
                  <T>Fare</T>
                </Text>
                <View className="flex-row items-baseline">
                  <Text className="text-2xl font-bold text-primary">
                    ₦{totalFare}
                  </Text>
                  {settings.fare_per_seat && seats > 1 && (
                    <Text className="text-xs text-gray-400 ml-2">
                      ₦{ride.fare} × {seats}
                    </Text>
                  )}
                </View>
              </View>
            </Animated.View>

            {/* ── Check-In Section ─────────────────────────────────── */}
            {needsCheckIn && (
              <Animated.View
                entering={FadeInUp.delay(300).duration(300)}
                className="mx-5 mt-4"
              >
                <View className="rounded-[26px] border border-slate-200 bg-white p-4">
                  <View className="mb-3 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                        <Ionicons
                          name="key-outline"
                          size={18}
                          color="#042F40"
                        />
                      </View>
                      <View>
                        <Text className="text-sm font-semibold text-slate-900">
                          <T>Check-In Required</T>
                        </Text>
                        <Text className="text-xs text-slate-500">
                          <T>Enter the 4-digit code shared by your driver.</T>
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="mb-4 rounded-2xl bg-slate-50 px-4 py-3">
                    <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Route
                    </Text>
                    <Text className="mt-1 text-sm font-semibold text-slate-900">
                      {pickup?.short_name || pickup?.name || "Pickup"} {"→"}{" "}
                      {dest?.short_name || dest?.name || "Destination"}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleOpenCheckIn}
                    className="rounded-2xl border border-[#042F40] bg-[#042F40] py-3.5 items-center flex-row justify-center"
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text className="ml-2 text-sm font-semibold text-white">
                      <T>Open Check-In</T>
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* ── Checked In Banner ─────────────────────────────── */}
            {isCheckedIn && !inProgress && (
              <Animated.View
                entering={FadeInUp.delay(300).duration(300)}
                className="mx-5 mt-4"
              >
                <View className="bg-green-50 rounded-2xl p-4 flex-row items-center border border-green-100">
                  <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3">
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#16A34A"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-green-800">
                      <T>Checked In</T>
                    </Text>
                    <Text className="text-xs text-green-600 mt-0.5">
                      <T>Waiting for the driver to start the ride</T>
                    </Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* ── In Progress Banner ──────────────────────────────── */}
            {inProgress && (
              <Animated.View
                entering={FadeInUp.delay(300).duration(300)}
                className="mx-5 mt-4"
              >
                <View className="bg-blue-50 rounded-2xl p-4 flex-row items-center border border-blue-100">
                  <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                    <Ionicons name="navigate" size={20} color="#2563EB" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-blue-800">
                      <T>Ride In Progress</T>
                    </Text>
                    <Text className="text-xs text-blue-500 mt-0.5">
                      <T>Enjoy your ride!</T>
                    </Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* ── Booking Info ─────────────────────────────────────── */}
            {booking && booking.status !== "cancelled" && (
              <Animated.View
                entering={FadeInUp.delay(350).duration(300)}
                className="mx-5 mt-3 bg-gray-50 rounded-2xl p-4"
              >
                <Text className="text-xs font-semibold text-gray-400 uppercase mb-3">
                  <T>Your Booking</T>
                </Text>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-xs text-gray-500">
                    <T>Seats</T>
                  </Text>
                  <Text className="text-xs font-semibold text-gray-800">
                    {booking.seats_requested}
                  </Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-xs text-gray-500">
                    <T>Payment</T>
                  </Text>
                  <Text className="text-xs font-semibold text-gray-800 capitalize">
                    {booking.payment_method}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-gray-500">
                    <T>Status</T>
                  </Text>
                  <View
                    className={`px-2 py-0.5 rounded-full ${STATUS_BADGES[booking.status]?.bg || "bg-gray-100"}`}
                  >
                    <Text
                      className={`text-[10px] font-semibold ${STATUS_BADGES[booking.status]?.color || "text-gray-500"}`}
                    >
                      {booking.status}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {sharedBookings.length > 0 && (
              <Animated.View
                entering={FadeInUp.delay(365).duration(300)}
                className="mx-5 mt-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  <T>Shared Ride</T>
                </Text>
                <Text className="mt-1 text-sm font-semibold text-slate-900">
                  {sharedBookings.length} booking
                  {sharedBookings.length === 1 ? "" : "s"} on this route
                </Text>

                <View className="mt-3">
                  {sharedBookings.map((item, index) => {
                    const passenger =
                      item.user_id && typeof item.user_id === "object"
                        ? item.user_id
                        : null;
                    const passengerId =
                      passenger?._id ||
                      (typeof item.user_id === "string" ? item.user_id : null);
                    const isCurrentUser =
                      item._id === booking?._id ||
                      (!!user?.id && !!passengerId && passengerId === user.id);
                    const rowBadge =
                      STATUS_BADGES[item.status] || STATUS_BADGES.pending;
                    const rowName = passenger?.name || "Passenger";
                    const rowPhoto = passenger?.profile_picture || null;

                    return (
                      <View
                        key={item._id}
                        className={`flex-row items-center justify-between rounded-xl border px-3 py-3 ${index > 0 ? "mt-2" : ""} ${isCurrentUser ? "border-primary/20 bg-primary/5" : "border-slate-200 bg-slate-50"}`}
                      >
                        <View className="flex-row items-center flex-1 pr-3">
                          {rowPhoto ? (
                            <Image
                              source={{ uri: rowPhoto }}
                              className="h-9 w-9 rounded-full mr-2.5"
                            />
                          ) : (
                            <View className="h-9 w-9 rounded-full items-center justify-center bg-white border border-slate-200 mr-2.5">
                              <Ionicons
                                name="person-outline"
                                size={14}
                                color="#334155"
                              />
                            </View>
                          )}
                          <View className="flex-1">
                            <Text
                              className="text-sm font-semibold text-slate-900"
                              numberOfLines={1}
                            >
                              {isCurrentUser ? "You" : rowName}
                            </Text>
                            <Text className="text-[11px] text-slate-500">
                              {item.seats_requested} seat
                              {item.seats_requested === 1 ? "" : "s"}
                              {item.check_in_status === "checked_in"
                                ? " · Checked in"
                                : ""}
                            </Text>
                          </View>
                        </View>

                        <View
                          className={`rounded-full px-2.5 py-1 ${rowBadge.bg}`}
                        >
                          <Text
                            className={`text-[10px] font-semibold ${rowBadge.color}`}
                          >
                            {rowBadge.text}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            )}

            {/* ── Transfer Payment Section ─────────────────────────── */}
            {booking && isTransfer && isTransferBookingFlow && (
              <Animated.View
                entering={FadeInUp.delay(375).duration(300)}
                className="mx-5 mt-3"
              >
                <View className="rounded-[26px] border border-slate-200 bg-white p-4">
                  <View className="mb-3 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-violet-50">
                        <Ionicons
                          name="card-outline"
                          size={18}
                          color="#7C3AED"
                        />
                      </View>
                      <View>
                        <Text className="text-sm font-semibold text-slate-900">
                          <T>Transfer Payment</T>
                        </Text>
                        <Text className="text-xs text-slate-500">
                          {transferPaymentStatus === "paid" ? (
                            <T>Driver confirmed payment receipt.</T>
                          ) : transferPaymentStatus === "sent" ? (
                            <T>Waiting for the driver to confirm.</T>
                          ) : (
                            <T>{`Send ₦${transferAmount.toLocaleString()} to the driver's account.`}</T>
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
                        ₦{transferAmount.toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {canMarkSent && (
                    <TouchableOpacity
                      onPress={handleMarkSent}
                      disabled={markingPaid}
                      className="rounded-2xl border border-[#042F40] bg-[#042F40] py-3 items-center mb-3 flex-row justify-center"
                    >
                      {markingPaid ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons
                            name="paper-plane-outline"
                            size={14}
                            color="#FFFFFF"
                          />
                          <Text className="text-white text-sm font-semibold ml-2">
                            <T>{"I've Sent the Money"}</T>
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <View className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Driver Account Details
                    </Text>
                    <View className="mt-3 flex-row justify-between">
                      <Text className="text-xs text-slate-500">
                        <T>Bank Name</T>
                      </Text>
                      <Text className="text-xs font-semibold text-slate-900">
                        {driverBankName}
                      </Text>
                    </View>
                    <View className="mt-2 flex-row justify-between">
                      <Text className="text-xs text-slate-500">
                        <T>Account Number</T>
                      </Text>
                      <View className="items-end">
                        <Text className="text-xs font-semibold text-slate-900">
                          {driverBankAccountNumber}
                        </Text>
                        <TouchableOpacity
                          onPress={copyAccountNumber}
                          disabled={!hasDriverAccountNumber}
                          className={`mt-1 flex-row items-center rounded-full border px-2.5 py-1 ${
                            hasDriverAccountNumber
                              ? "border-slate-900 bg-white"
                              : "border-slate-200 bg-slate-100"
                          }`}
                        >
                          <Ionicons
                            name={copied ? "checkmark-circle" : "copy-outline"}
                            size={12}
                            color={
                              hasDriverAccountNumber ? "#0F172A" : "#94A3B8"
                            }
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
                    <View className="mt-2 flex-row justify-between">
                      <Text className="text-xs text-slate-500">
                        <T>Account Name</T>
                      </Text>
                      <Text className="text-xs font-semibold text-slate-900">
                        {driverBankAccountName}
                      </Text>
                    </View>
                    <View className="mt-2 flex-row justify-between">
                      <Text className="text-xs text-slate-500">
                        <T>Amount</T>
                      </Text>
                      <Text className="text-xs font-semibold text-slate-900">
                        ₦{transferAmount.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            )}

            {booking &&
              (booking.status === "cancelled" ||
                booking.status === "declined") && (
                <Animated.View
                  entering={FadeInUp.delay(390).duration(300)}
                  className="mx-5 mt-3 rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <View className="flex-row items-start">
                    <View className="mr-3 mt-0.5 h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100">
                      <Ionicons
                        name="car-sport-outline"
                        size={18}
                        color="#047857"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-slate-900">
                        <T>Find another ride now</T>
                      </Text>
                      <Text className="mt-1 text-xs leading-5 text-slate-500">
                        <T>
                          We can show available rides on this same route so you
                          can quickly join another trip.
                        </T>
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          void syncRouteAndOpenAvailableRides();
                        }}
                        className="mt-3 self-start rounded-xl bg-[#042F40] px-4 py-2.5"
                        activeOpacity={0.88}
                      >
                        <Text className="text-xs font-semibold text-white">
                          <T>Browse Available Rides</T>
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
              )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Bottom Actions ──────────────────────────────────────── */}
        {hasBottomActions && (
          <SafeAreaView
            edges={["bottom"]}
            onLayout={handleBottomActionsLayout}
            className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3 pb-4"
          >
            {canBook ? (
              <Animated.View entering={FadeInDown.duration(300)}>
                {/* Seat Selector */}
                {maxSeats > 1 && (
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-sm text-gray-600">
                      <T>Seats</T>
                    </Text>
                    <View className="flex-row items-center gap-3">
                      <TouchableOpacity
                        onPress={() => setSeats(Math.max(1, seats - 1))}
                        className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                      >
                        <Ionicons name="remove" size={16} color="#042F40" />
                      </TouchableOpacity>
                      <Text className="text-lg font-bold text-gray-800 w-6 text-center">
                        {seats}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setSeats(Math.min(maxSeats, seats + 1))}
                        className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                      >
                        <Ionicons name="add" size={16} color="#042F40" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {/* Payment Select */}
                <View className="flex-row gap-2 mb-3">
                  {(["cash", "transfer"] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setPayMethod(m)}
                      className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center ${payMethod === m ? "bg-primary" : "bg-gray-100"}`}
                    >
                      <Ionicons
                        name={m === "cash" ? "cash-outline" : "card-outline"}
                        size={16}
                        color={payMethod === m ? "#fff" : "#6B7280"}
                      />
                      <Text
                        className={`ml-2 text-sm font-semibold ${payMethod === m ? "text-white" : "text-gray-600"}`}
                      >
                        {m === "cash" ? "Cash" : "Transfer"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  onPress={handleBook}
                  disabled={isBooking || !hasBookingPhone}
                  className={`${hasBookingPhone ? "bg-primary" : "bg-amber-200"} rounded-2xl py-4 items-center mb-2`}
                >
                  {isBooking ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      className={`font-bold text-base ${hasBookingPhone ? "text-white" : "text-amber-700"}`}
                    >
                      {hasBookingPhone ? (
                        <T>Book Ride</T>
                      ) : (
                        <T>Add Phone to Book</T>
                      )}{" "}
                      · ₦{totalFare}
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            ) : booking &&
              (booking.status === "pending" ||
                booking.status === "accepted") ? (
              <TouchableOpacity
                onPress={handleCancel}
                disabled={cancelling}
                className="bg-red-50 rounded-2xl py-4 items-center mb-2 border border-red-100"
              >
                {cancelling ? (
                  <ActivityIndicator color="#EF4444" />
                ) : (
                  <Text className="text-red-500 font-bold text-sm">
                    <T>Cancel Booking</T>
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </SafeAreaView>
        )}
      </SafeAreaView>
    </View>
  );
}
