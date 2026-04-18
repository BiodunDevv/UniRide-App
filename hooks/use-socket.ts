import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import { useLocationStore } from "@/store/useLocationStore";
import { useRideStore } from "@/store/useRideStore";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { eventBus } from "@/lib/eventBus";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

let socketInstance: Socket | null = null;
// Track joined rooms for reconnection
let lastJoinedRooms: { userId?: string; role?: string; rideId?: string } = {};

export function getSocket(): Socket | null {
  return socketInstance;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { addDriverToList, removeDriverFromList, updateDriverInList } =
    useLocationStore();

  useEffect(() => {
    if (socketInstance && !socketRef.current) {
      socketRef.current = socketInstance;
    }
  }, []);

  const connect = useCallback(async () => {
    if (socketInstance) {
      socketRef.current = socketInstance;
      if (!socketInstance.connected) {
        socketInstance.connect();
      }
      return;
    }

    if (socketRef.current?.connected) return;

    const token = await SecureStore.getItemAsync("token");
    if (!token) return;

    const socket = io(API_URL, {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      console.log("🔌 Socket connected:", socket.id);
      // Ensure settings are fresh in case updates happened while disconnected.
      usePlatformSettingsStore
        .getState()
        .fetchSettings()
        .catch(() => {});
    });

    // On reconnect, re-join previously joined rooms
    socket.on("reconnect", () => {
      console.log("🔌 Socket reconnected:", socket.id);
      // Re-join rooms after reconnection
      if (lastJoinedRooms.userId && lastJoinedRooms.role) {
        socket.emit("join-room", {
          user_id: lastJoinedRooms.userId,
          role: lastJoinedRooms.role,
        });
        if (lastJoinedRooms.role === "driver") {
          socket.emit("join-driver-feed");
        } else {
          socket.emit("join-user-feed", { user_id: lastJoinedRooms.userId });
          socket.emit("join-live-map");
        }
      }
      if (lastJoinedRooms.rideId) {
        socket.emit("join-ride", { ride_id: lastJoinedRooms.rideId });
      }

      usePlatformSettingsStore
        .getState()
        .fetchSettings()
        .catch(() => {});
    });

    // ── Platform settings sync events ─────────────────────────────────
    socket.on("platform-settings:updated", (payload) => {
      const incoming = payload?.settings;

      if (incoming && typeof incoming === "object") {
        usePlatformSettingsStore.getState().applySettings(incoming);
      } else {
        usePlatformSettingsStore
          .getState()
          .fetchSettings()
          .catch(() => {});
      }

      eventBus.emit("platform-settings:updated", payload);
    });

    // ── Driver location events ─────────────────────────────────────────
    socket.on("driver-location-updated", (data) => {
      updateDriverInList(data.driver_id, data.location, data.heading);
      // Also emit to eventBus for active-ride screen
      eventBus.emit("driver-location-updated", data);
    });

    socket.on("driver-online", (data) => {
      addDriverToList({
        driver_id: data.driver_id,
        user_id: data.user_id,
        name: data.name,
        profile_picture: data.profile_picture,
        vehicle_model: data.vehicle_model,
        vehicle_color: data.vehicle_color,
        plate_number: data.plate_number,
        rating: data.rating,
        available_seats: data.available_seats,
        total_ratings: 0,
        heading: data.heading || 0,
        is_online: true,
        location: data.location,
        last_online_at: new Date().toISOString(),
      });
    });

    socket.on("driver-offline", (data) => {
      removeDriverFromList(data.driver_id);
    });

    // ── Ride events (real-time) ────────────────────────────────────────
    socket.on("ride:new_request", (ride) => {
      // A new ride request appeared — add to driver's available requests
      const store = useRideStore.getState();
      const existing = store.availableRequests.find((r) => r._id === ride._id);
      if (!existing) {
        useRideStore.setState({
          availableRequests: [ride, ...store.availableRequests],
        });
      }
    });

    socket.on("ride:created", (ride) => {
      // A new ride was created — refresh available rides for users
      const store = useRideStore.getState();
      store.fetchActiveRides();
    });

    socket.on("ride:accepted", (data) => {
      // A ride was claimed by a driver — remove from available requests
      const store = useRideStore.getState();
      useRideStore.setState({
        availableRequests: store.availableRequests.filter(
          (r) => r._id !== data.ride_id,
        ),
        // If the check_in_code is provided, update matching bookings immediately
        myBookings: data.check_in_code
          ? store.myBookings.map((b) =>
              b.ride_id?._id === data.ride_id || b.ride_id === data.ride_id
                ? {
                    ...b,
                    check_in_code: data.check_in_code,
                    status: "accepted" as const,
                  }
                : b,
            )
          : store.myBookings,
      });
      // Refresh all ride/booking data
      store.fetchMyBookings();
      store.fetchActiveRides();
      store.fetchDriverRides();
      store.fetchDriverBookings();
      eventBus.emit("ride:accepted", data);
    });

    socket.on("ride:ended", (data) => {
      const store = useRideStore.getState();
      // Refresh all data to show completed status
      store.fetchMyBookings();
      store.fetchDriverBookings();
      store.fetchDriverRides();
      store.fetchActiveRides();
      store.fetchAvailableRequests();
      if (store.activeRide?._id === data.ride_id) {
        useRideStore.setState({ activeRide: null });
      }
      eventBus.emit("ride:ended", data);
    });

    socket.on("ride:started", (data) => {
      const store = useRideStore.getState();
      // Refresh all data so UI reflects in_progress status
      store.fetchMyBookings();
      store.fetchDriverBookings();
      store.fetchDriverRides();
      store.fetchActiveRides();
      eventBus.emit("ride:started", data);
    });

    // ── Booking events (real-time) ─────────────────────────────────────
    socket.on("booking:updated", (data) => {
      const store = useRideStore.getState();
      // Update booking fields in local state (status, payment_status, check_in_status, check_in_code)
      const patch: Record<string, unknown> = {};
      if (data.status) patch.status = data.status;
      if (data.payment_status) patch.payment_status = data.payment_status;
      if (data.check_in_status) patch.check_in_status = data.check_in_status;
      if (data.check_in_code) patch.check_in_code = data.check_in_code;

      useRideStore.setState({
        myBookings: store.myBookings.map((b) =>
          b._id === data.booking_id ? { ...b, ...patch } : b,
        ),
        driverBookings: store.driverBookings.map((b) =>
          b._id === data.booking_id ? { ...b, ...patch } : b,
        ),
      });
      // Refresh full booking/ride data silently
      store.fetchMyBookings();
      store.fetchDriverBookings();
      store.fetchDriverRides();
      store.fetchActiveRides();
      eventBus.emit("booking:updated", data);
    });

    socket.on("booking:cancelled", (data) => {
      const store = useRideStore.getState();
      // Update booking status locally
      useRideStore.setState({
        driverBookings: store.driverBookings.map((b) =>
          b._id === data.booking_id
            ? { ...b, status: "cancelled" as const }
            : b,
        ),
        myBookings: store.myBookings.map((b) =>
          b._id === data.booking_id
            ? { ...b, status: "cancelled" as const }
            : b,
        ),
      });
      // Refresh full data
      store.fetchDriverBookings();
      store.fetchDriverRides();
      store.fetchActiveRides();
      eventBus.emit("booking:cancelled", data);
    });

    socket.on("booking:checkin", (data) => {
      const store = useRideStore.getState();
      // Update the booking's check-in status locally — do NOT change booking.status
      useRideStore.setState({
        driverBookings: store.driverBookings.map((b) =>
          b._id === data.booking_id
            ? {
                ...b,
                check_in_status: "checked_in" as const,
              }
            : b,
        ),
        myBookings: store.myBookings.map((b) =>
          b._id === data.booking_id
            ? {
                ...b,
                check_in_status: "checked_in" as const,
              }
            : b,
        ),
      });
      // Refresh ride data since check-in count may have changed
      store.fetchDriverRides();
      store.fetchMyBookings();
      eventBus.emit("booking:checkin", data);
    });

    // ── Passenger location events (for driver's active ride) ───────────
    socket.on("passenger-location-updated", (data) => {
      eventBus.emit("passenger-location-updated", data);
    });

    socket.on("disconnect", () => {
      console.log("🔌 Socket disconnected");
    });

    socketRef.current = socket;
    socketInstance = socket;
  }, [addDriverToList, removeDriverFromList, updateDriverInList]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      socketInstance = null;
    }
  }, []);

  const joinRoom = useCallback((userId: string, role: string) => {
    lastJoinedRooms.userId = userId;
    lastJoinedRooms.role = role;
    socketRef.current?.emit("join-room", { user_id: userId, role });
  }, []);

  const joinLiveMap = useCallback(() => {
    socketRef.current?.emit("join-live-map");
  }, []);

  const leaveLiveMap = useCallback(() => {
    socketRef.current?.emit("leave-live-map");
  }, []);

  const joinRide = useCallback((rideId: string) => {
    lastJoinedRooms.rideId = rideId;
    socketRef.current?.emit("join-ride", { ride_id: rideId });
  }, []);

  const leaveRide = useCallback((rideId: string) => {
    lastJoinedRooms.rideId = undefined;
    socketRef.current?.emit("leave-ride", { ride_id: rideId });
  }, []);

  // Join driver feed for real-time ride requests
  const joinDriverFeed = useCallback(() => {
    socketRef.current?.emit("join-driver-feed");
  }, []);

  const leaveDriverFeed = useCallback(() => {
    socketRef.current?.emit("leave-driver-feed");
  }, []);

  // Join user feed for real-time booking updates
  const joinUserFeed = useCallback((userId: string) => {
    socketRef.current?.emit("join-user-feed", { user_id: userId });
  }, []);

  const streamLocation = useCallback(
    (
      driverId: string,
      latitude: number,
      longitude: number,
      heading?: number,
      rideId?: string,
    ) => {
      socketRef.current?.emit("driver-location-stream", {
        driver_id: driverId,
        latitude,
        longitude,
        heading,
        ride_id: rideId,
      });
    },
    [],
  );

  const streamPassengerLocation = useCallback(
    (
      userId: string,
      rideId: string,
      latitude: number,
      longitude: number,
      name?: string,
      profilePicture?: string | null,
    ) => {
      socketRef.current?.emit("passenger-location-stream", {
        user_id: userId,
        ride_id: rideId,
        latitude,
        longitude,
        name,
        profile_picture: profilePicture,
      });
    },
    [],
  );

  return {
    connect,
    disconnect,
    joinRoom,
    joinLiveMap,
    leaveLiveMap,
    joinRide,
    leaveRide,
    joinDriverFeed,
    leaveDriverFeed,
    joinUserFeed,
    streamLocation,
    streamPassengerLocation,
    socket: socketRef,
  };
}
