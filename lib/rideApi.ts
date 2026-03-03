import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync("token");
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    const error: any = new Error(data.message || "Request failed");
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ─── Ride API ─────────────────────────────────────────────────────────────────
export const rideApi = {
  // Get available/scheduled rides for users
  getActiveRides(params?: { pickup?: string; destination?: string }) {
    const qs = new URLSearchParams();
    if (params?.pickup) qs.set("pickup", params.pickup);
    if (params?.destination) qs.set("destination", params.destination);
    const query = qs.toString();
    return request(`/api/rides/active${query ? `?${query}` : ""}`);
  },

  // Get ride details
  getRideDetails(rideId: string) {
    return request(`/api/rides/${rideId}`);
  },

  // Get driver's rides
  getMyRides() {
    return request("/api/rides/my-rides");
  },

  // Get available ride requests (for drivers to claim)
  getAvailableRequests() {
    return request("/api/rides/available-requests");
  },

  // Driver: accept/claim an available ride
  acceptRide(rideId: string) {
    return request(`/api/rides/${rideId}/accept`, { method: "POST" });
  },

  // End a ride (driver)
  endRide(rideId: string) {
    return request(`/api/rides/${rideId}/end`, { method: "POST" });
  },

  // Update driver location during ride
  updateRideLocation(
    rideId: string,
    body: { latitude: number; longitude: number },
  ) {
    return request(`/api/rides/${rideId}/location`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // Create a new ride (any user - requests for users, schedules for drivers/admins)
  createRide(body: {
    pickup_location_id: string;
    destination_id: string;
    fare?: number;
    departure_time?: string;
    available_seats?: number;
    seats_requested?: number;
    payment_method?: string;
  }) {
    return request("/api/rides", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

// ─── Booking API ──────────────────────────────────────────────────────────────
export const bookingApi = {
  // User: Request a ride (creates pending booking)
  requestRide(body: {
    ride_id: string;
    payment_method: "cash" | "transfer";
    seats_requested?: number;
  }) {
    return request("/api/booking/request", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // User: Check in to a ride
  checkIn(body: { booking_id: string; check_in_code: string }) {
    return request("/api/booking/checkin", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // Update payment status
  updatePaymentStatus(body: { booking_id: string; payment_status: string }) {
    return request("/api/booking/payment-status", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  // Rate driver (user)
  rateDriver(body: { booking_id: string; rating: number; feedback?: string }) {
    return request("/api/booking/rate", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // Get my bookings
  getMyBookings() {
    return request("/api/booking/my-bookings");
  },

  // Cancel a booking
  cancelBooking(bookingId: string) {
    return request(`/api/booking/cancel/${bookingId}`, { method: "PATCH" });
  },

  // Driver: Get bookings for my rides
  getDriverBookings(status?: string) {
    const qs = status ? `?status=${status}` : "";
    return request(`/api/booking/driver-bookings${qs}`);
  },

  // Driver: Accept a booking
  acceptBooking(bookingId: string) {
    return request(`/api/booking/accept/${bookingId}`, { method: "POST" });
  },

  // Driver: Decline a booking
  declineBooking(bookingId: string) {
    return request(`/api/booking/decline/${bookingId}`, { method: "POST" });
  },
};

// ─── Location API ─────────────────────────────────────────────────────────────
export const locationApi = {
  // Get all campus locations
  getLocations(params?: { category?: string; search?: string }) {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.search) qs.set("search", params.search);
    const query = qs.toString();
    return request(`/api/locations${query ? `?${query}` : ""}`);
  },

  // Get locations grouped by category
  getGroupedLocations() {
    return request("/api/locations/grouped");
  },

  // Get single location
  getLocation(locationId: string) {
    return request(`/api/locations/${locationId}`);
  },

  // Get online drivers (for user map)
  getOnlineDrivers(params?: {
    latitude?: number;
    longitude?: number;
    radius?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.latitude) qs.set("latitude", String(params.latitude));
    if (params?.longitude) qs.set("longitude", String(params.longitude));
    if (params?.radius) qs.set("radius", String(params.radius));
    const query = qs.toString();
    return request(`/api/driver/online${query ? `?${query}` : ""}`);
  },

  // Driver go online
  goOnline(body: { latitude: number; longitude: number; heading?: number }) {
    return request("/api/driver/go-online", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  // Driver go offline
  goOffline(body?: { address?: string }) {
    return request("/api/driver/go-offline", {
      method: "PATCH",
      body: JSON.stringify(body || {}),
    });
  },

  // Update driver live location
  updateDriverLocation(body: {
    latitude: number;
    longitude: number;
    heading?: number;
  }) {
    return request("/api/driver/location", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // Update user location
  updateUserLocation(body: { latitude: number; longitude: number }) {
    return request("/api/driver/user-location", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
