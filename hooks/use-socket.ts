import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import { useLocationStore } from "@/store/useLocationStore";
import { useRideStore } from "@/store/useRideStore";
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

  const connect = useCallback(async () => {
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
    });

    // ── Booking events (real-time) ─────────────────────────────────────
    socket.on("booking:updated", (data) => {
      const store = useRideStore.getState();
      // Update booking status + check_in_code in local state
      useRideStore.setState({
        myBookings: store.myBookings.map((b) =>
          b._id === data.booking_id
            ? {
                ...b,
                status: data.status,
                ...(data.check_in_code
                  ? { check_in_code: data.check_in_code }
                  : {}),
              }
            : b,
        ),
        driverBookings: store.driverBookings.map((b) =>
          b._id === data.booking_id ? { ...b, status: data.status } : b,
        ),
      });
      // Refresh full booking/ride data silently
      store.fetchMyBookings();
      store.fetchDriverBookings();
      store.fetchDriverRides();
      store.fetchActiveRides();
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
    });

    socket.on("booking:checkin", (data) => {
      const store = useRideStore.getState();
      // Update the booking's check-in status locally
      useRideStore.setState({
        driverBookings: store.driverBookings.map((b) =>
          b._id === data.booking_id
            ? {
                ...b,
                check_in_status: "checked_in" as const,
                status: "in_progress" as const,
              }
            : b,
        ),
        myBookings: store.myBookings.map((b) =>
          b._id === data.booking_id
            ? {
                ...b,
                check_in_status: "checked_in" as const,
                status: "in_progress" as const,
              }
            : b,
        ),
      });
      // Refresh ride data since ride status may have changed too
      store.fetchDriverRides();
      store.fetchMyBookings();
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

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

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
