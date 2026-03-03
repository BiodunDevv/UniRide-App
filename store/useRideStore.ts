import { create } from "zustand";
import { rideApi, bookingApi, locationApi } from "@/lib/rideApi";

export interface CampusLocation {
  _id: string;
  name: string;
  short_name: string;
  category: string;
  coordinates: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  address: string;
  description?: string;
  icon: string;
  is_active: boolean;
  is_popular: boolean;
  order: number;
}

export interface Ride {
  _id: string;
  driver_id: any;
  pickup_location_id: CampusLocation | string;
  destination_id: CampusLocation | string;
  pickup_location: {
    type: string;
    coordinates: [number, number];
    address: string;
  };
  destination: {
    type: string;
    coordinates: [number, number];
    address: string;
  };
  fare: number;
  fare_policy_source: string;
  departure_time: string;
  available_seats: number;
  booked_seats: number;
  seats_remaining?: number;
  status:
    | "scheduled"
    | "available"
    | "accepted"
    | "in_progress"
    | "completed"
    | "cancelled";
  gps_tracking_enabled: boolean;
  route_geometry: any;
  distance_meters: number;
  duration_seconds: number;
  check_in_code: string;
  current_location?: {
    type: string;
    coordinates: [number, number];
  };
  ended_at?: string;
  createdAt: string;
}

export interface Booking {
  _id: string;
  ride_id: any;
  user_id: any;
  seats_requested: number;
  total_fare?: number;
  payment_method: "cash" | "transfer";
  payment_status: "pending" | "paid" | "not_applicable";
  bank_details_visible: boolean;
  booking_time: string;
  check_in_status: "not_checked_in" | "checked_in";
  check_in_code?: string;
  status:
    | "pending"
    | "accepted"
    | "declined"
    | "in_progress"
    | "completed"
    | "cancelled";
  rating?: number;
  feedback?: string;
  admin_note?: string;
  createdAt: string;
}

interface RideState {
  // Campus locations
  campusLocations: CampusLocation[];
  groupedLocations: Record<string, CampusLocation[]>;
  isLoadingLocations: boolean;
  selectedPickup: CampusLocation | null;
  selectedDestination: CampusLocation | null;

  // Available rides (for users)
  availableRides: Ride[];
  isLoadingRides: boolean;

  // Driver's rides
  driverRides: Ride[];
  isLoadingDriverRides: boolean;

  // Active ride (current ongoing ride for both user and driver)
  activeRide: Ride | null;
  activeBooking: Booking | null;

  // User's bookings
  myBookings: Booking[];
  isLoadingBookings: boolean;

  // Loading states
  isBooking: boolean;

  // Actions - Locations
  fetchLocations: (params?: {
    category?: string;
    search?: string;
  }) => Promise<void>;
  fetchGroupedLocations: () => Promise<void>;
  setSelectedPickup: (location: CampusLocation | null) => void;
  setSelectedDestination: (location: CampusLocation | null) => void;

  // Available ride requests (for drivers)
  availableRequests: Ride[];
  isLoadingAvailableRequests: boolean;

  // Actions - Rides
  fetchActiveRides: (params?: {
    pickup?: string;
    destination?: string;
  }) => Promise<void>;
  fetchDriverRides: () => Promise<void>;
  fetchRideDetails: (rideId: string) => Promise<Ride>;
  endRide: (rideId: string) => Promise<void>;
  setActiveRide: (ride: Ride | null) => void;
  createRide: (body: {
    pickup_location_id: string;
    destination_id: string;
    fare?: number;
    departure_time?: string;
    available_seats?: number;
    seats_requested?: number;
    payment_method?: string;
  }) => Promise<any>;
  isCreatingRide: boolean;

  // Actions - Driver ride requests
  fetchAvailableRequests: () => Promise<void>;
  acceptRideRequest: (rideId: string) => Promise<void>;

  // Actions - Bookings
  bookRide: (
    rideId: string,
    paymentMethod: "cash" | "transfer",
    seatsRequested?: number,
  ) => Promise<any>;
  checkIn: (bookingId: string, code: string) => Promise<void>;
  rateDriver: (
    bookingId: string,
    rating: number,
    feedback?: string,
  ) => Promise<void>;
  fetchMyBookings: () => Promise<void>;
  cancelBooking: (bookingId: string) => Promise<void>;
  updatePaymentStatus: (bookingId: string, status: string) => Promise<void>;
  setActiveBooking: (booking: Booking | null) => void;

  // Actions - Driver Bookings
  driverBookings: Booking[];
  isLoadingDriverBookings: boolean;
  fetchDriverBookings: (status?: string) => Promise<void>;
  acceptBooking: (bookingId: string) => Promise<void>;
  declineBooking: (bookingId: string) => Promise<void>;
}

export const useRideStore = create<RideState>((set, get) => ({
  campusLocations: [],
  groupedLocations: {},
  isLoadingLocations: false,
  selectedPickup: null,
  selectedDestination: null,
  availableRides: [],
  isLoadingRides: false,
  driverRides: [],
  isLoadingDriverRides: false,
  activeRide: null,
  activeBooking: null,
  myBookings: [],
  isLoadingBookings: false,
  isBooking: false,
  driverBookings: [],
  isLoadingDriverBookings: false,
  isCreatingRide: false,
  availableRequests: [],
  isLoadingAvailableRequests: false,

  fetchLocations: async (params) => {
    try {
      set({ isLoadingLocations: true });
      const res = await locationApi.getLocations(params);
      set({ campusLocations: res.data || [], isLoadingLocations: false });
    } catch {
      set({ isLoadingLocations: false });
    }
  },

  fetchGroupedLocations: async () => {
    try {
      set({ isLoadingLocations: true });
      const res = await locationApi.getGroupedLocations();
      set({ groupedLocations: res.data || {}, isLoadingLocations: false });
    } catch {
      set({ isLoadingLocations: false });
    }
  },

  setSelectedPickup: (location) => set({ selectedPickup: location }),
  setSelectedDestination: (location) => set({ selectedDestination: location }),

  fetchActiveRides: async (params) => {
    try {
      if (get().availableRides.length === 0) set({ isLoadingRides: true });
      const res = await rideApi.getActiveRides(params);
      set({ availableRides: res.data || [], isLoadingRides: false });
    } catch {
      set({ isLoadingRides: false });
    }
  },

  fetchDriverRides: async () => {
    try {
      // Only show loading on first fetch (empty state)
      if (get().driverRides.length === 0) set({ isLoadingDriverRides: true });
      const res = await rideApi.getMyRides();
      set({ driverRides: res.data || [], isLoadingDriverRides: false });
    } catch {
      set({ isLoadingDriverRides: false });
    }
  },

  fetchRideDetails: async (rideId: string) => {
    const res = await rideApi.getRideDetails(rideId);
    return res.data;
  },

  endRide: async (rideId: string) => {
    try {
      await rideApi.endRide(rideId);
      set((state) => ({
        activeRide: null,
        driverRides: state.driverRides.map((r) =>
          r._id === rideId ? { ...r, status: "completed" as const } : r,
        ),
      }));
    } catch (error) {
      throw error;
    }
  },

  setActiveRide: (ride) => set({ activeRide: ride }),

  createRide: async (body) => {
    try {
      set({ isCreatingRide: true });
      const res = await rideApi.createRide(body);
      set({ isCreatingRide: false });
      return res;
    } catch (error) {
      set({ isCreatingRide: false });
      throw error;
    }
  },

  bookRide: async (rideId, paymentMethod, seatsRequested = 1) => {
    try {
      set({ isBooking: true });
      const res = await bookingApi.requestRide({
        ride_id: rideId,
        payment_method: paymentMethod,
        seats_requested: seatsRequested,
      });
      set({ isBooking: false, activeBooking: res.data });
      return res;
    } catch (error) {
      set({ isBooking: false });
      throw error;
    }
  },

  checkIn: async (bookingId, code) => {
    await bookingApi.checkIn({ booking_id: bookingId, check_in_code: code });
  },

  rateDriver: async (bookingId, rating, feedback) => {
    await bookingApi.rateDriver({ booking_id: bookingId, rating, feedback });
  },

  fetchMyBookings: async () => {
    try {
      if (get().myBookings.length === 0) set({ isLoadingBookings: true });
      const res = await bookingApi.getMyBookings();
      // Map check_in_code from populated ride onto the booking for easy access
      const bookings = (res.data || []).map((b: any) => ({
        ...b,
        check_in_code: b.check_in_code || b.ride_id?.check_in_code || undefined,
      }));
      set({ myBookings: bookings, isLoadingBookings: false });
    } catch {
      set({ isLoadingBookings: false });
    }
  },

  cancelBooking: async (bookingId) => {
    await bookingApi.cancelBooking(bookingId);
    set((state) => ({
      myBookings: state.myBookings.map((b) =>
        b._id === bookingId ? { ...b, status: "cancelled" as const } : b,
      ),
      activeBooking:
        state.activeBooking?._id === bookingId ? null : state.activeBooking,
    }));
  },

  updatePaymentStatus: async (bookingId, status) => {
    await bookingApi.updatePaymentStatus({
      booking_id: bookingId,
      payment_status: status,
    });
  },

  setActiveBooking: (booking) => set({ activeBooking: booking }),

  fetchDriverBookings: async (status) => {
    try {
      if (get().driverBookings.length === 0)
        set({ isLoadingDriverBookings: true });
      const res = await bookingApi.getDriverBookings(status);
      set({ driverBookings: res.data || [], isLoadingDriverBookings: false });
    } catch {
      set({ isLoadingDriverBookings: false });
    }
  },

  acceptBooking: async (bookingId) => {
    await bookingApi.acceptBooking(bookingId);
    set((state) => ({
      driverBookings: state.driverBookings.map((b) =>
        b._id === bookingId ? { ...b, status: "accepted" as const } : b,
      ),
    }));
  },

  declineBooking: async (bookingId) => {
    await bookingApi.declineBooking(bookingId);
    set((state) => ({
      driverBookings: state.driverBookings.map((b) =>
        b._id === bookingId ? { ...b, status: "declined" as const } : b,
      ),
    }));
  },

  fetchAvailableRequests: async () => {
    try {
      if (get().availableRequests.length === 0)
        set({ isLoadingAvailableRequests: true });
      const res = await rideApi.getAvailableRequests();
      set({
        availableRequests: res.data || [],
        isLoadingAvailableRequests: false,
      });
    } catch {
      set({ isLoadingAvailableRequests: false });
    }
  },

  acceptRideRequest: async (rideId) => {
    try {
      await rideApi.acceptRide(rideId);
      // Remove from available requests and refresh driver rides
      set((state) => ({
        availableRequests: state.availableRequests.filter(
          (r) => r._id !== rideId,
        ),
      }));
      // Refresh driver rides to show the newly accepted ride
      get().fetchDriverRides();
    } catch (error) {
      throw error;
    }
  },
}));
