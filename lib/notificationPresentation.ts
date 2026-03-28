import type { Notification } from "@/store/useNotificationStore";

type NotificationPresentation = {
  icon: string;
  bgClassName: string;
  color: string;
  label: string;
};

const PRESENTATIONS: Record<string, NotificationPresentation> = {
  ride_accepted: {
    icon: "car-sport",
    bgClassName: "bg-emerald-50",
    color: "#059669",
    label: "Driver Assigned",
  },
  login_push_ready: {
    icon: "shield-checkmark",
    bgClassName: "bg-sky-50",
    color: "#0284C7",
    label: "Device Connected",
  },
  login: {
    icon: "log-in",
    bgClassName: "bg-sky-50",
    color: "#0284C7",
    label: "New Sign In",
  },
  biometric_login: {
    icon: "scan-circle",
    bgClassName: "bg-sky-50",
    color: "#0284C7",
    label: "Biometric Sign In",
  },
  pin_login: {
    icon: "keypad",
    bgClassName: "bg-sky-50",
    color: "#0284C7",
    label: "PIN Sign In",
  },
  logout: {
    icon: "log-out",
    bgClassName: "bg-slate-100",
    color: "#475569",
    label: "Signed Out",
  },
  booking_confirmed: {
    icon: "checkmark-circle",
    bgClassName: "bg-emerald-50",
    color: "#16A34A",
    label: "Booking Confirmed",
  },
  new_booking_request: {
    icon: "receipt-outline",
    bgClassName: "bg-amber-50",
    color: "#D97706",
    label: "New Booking Request",
  },
  passenger_joined: {
    icon: "person-add",
    bgClassName: "bg-emerald-50",
    color: "#16A34A",
    label: "Passenger Joined",
  },
  driver_arriving: {
    icon: "car",
    bgClassName: "bg-sky-50",
    color: "#2563EB",
    label: "Driver Arriving",
  },
  booking_declined: {
    icon: "close-circle",
    bgClassName: "bg-rose-50",
    color: "#EF4444",
    label: "Booking Declined",
  },
  booking_cancelled: {
    icon: "close-circle",
    bgClassName: "bg-rose-50",
    color: "#EF4444",
    label: "Booking Cancelled",
  },
  booking_cancelled_by_user: {
    icon: "close-circle",
    bgClassName: "bg-rose-50",
    color: "#EF4444",
    label: "Booking Cancelled",
  },
  driver_arrived: {
    icon: "navigate-circle",
    bgClassName: "bg-sky-50",
    color: "#2563EB",
    label: "Driver Arriving",
  },
  ride_started: {
    icon: "play-circle",
    bgClassName: "bg-sky-50",
    color: "#2563EB",
    label: "Ride Started",
  },
  ride_completed: {
    icon: "checkmark-done-circle",
    bgClassName: "bg-slate-100",
    color: "#475569",
    label: "Ride Completed",
  },
  ride_cancelled: {
    icon: "close-circle",
    bgClassName: "bg-rose-50",
    color: "#EF4444",
    label: "Ride Cancelled",
  },
  matching_ride_available: {
    icon: "car-outline",
    bgClassName: "bg-violet-50",
    color: "#7C3AED",
    label: "Ride Available",
  },
  passenger_checked_in: {
    icon: "key",
    bgClassName: "bg-amber-50",
    color: "#D4A017",
    label: "Passenger Checked In",
  },
  check_in_success: {
    icon: "key",
    bgClassName: "bg-amber-50",
    color: "#D4A017",
    label: "Checked In",
  },
  payment_status_updated: {
    icon: "wallet",
    bgClassName: "bg-emerald-50",
    color: "#16A34A",
    label: "Payment Update",
  },
  payment_received: {
    icon: "cash",
    bgClassName: "bg-emerald-50",
    color: "#16A34A",
    label: "Payment Received",
  },
  payment_sent_by_passenger: {
    icon: "cash",
    bgClassName: "bg-sky-50",
    color: "#2563EB",
    label: "Transfer Sent",
  },
  new_rating: {
    icon: "star",
    bgClassName: "bg-amber-50",
    color: "#D4A017",
    label: "New Rating",
  },
  driver_profile_updated: {
    icon: "person-circle",
    bgClassName: "bg-sky-50",
    color: "#2563EB",
    label: "Profile Updated",
  },
  license_updated: {
    icon: "document-text",
    bgClassName: "bg-sky-50",
    color: "#2563EB",
    label: "License Updated",
  },
  vehicle_image_updated: {
    icon: "images",
    bgClassName: "bg-sky-50",
    color: "#2563EB",
    label: "Vehicle Updated",
  },
  broadcast_message: {
    icon: "megaphone",
    bgClassName: "bg-violet-50",
    color: "#7C3AED",
    label: "Announcement",
  },
  support_update: {
    icon: "help-buoy",
    bgClassName: "bg-sky-50",
    color: "#2563EB",
    label: "Support Update",
  },
  push_test: {
    icon: "notifications-circle",
    bgClassName: "bg-violet-50",
    color: "#7C3AED",
    label: "Push Test",
  },
  default: {
    icon: "notifications",
    bgClassName: "bg-gray-50",
    color: "#6B7280",
    label: "Notification",
  },
};

const TYPE_FALLBACKS: Record<string, keyof typeof PRESENTATIONS> = {
  booking: "booking_confirmed",
  ride: "ride_started",
  broadcast: "broadcast_message",
  promotion: "broadcast_message",
  account: "driver_profile_updated",
  security: "support_update",
  system: "support_update",
};

export function getNotificationAction(notification?: Partial<Notification> | null) {
  const action =
    notification?.metadata?.action ||
    notification?.metadata?.event ||
    notification?.type ||
    "default";
  return String(action);
}

export function getNotificationPresentation(
  notification?: Partial<Notification> | null,
) {
  const action = getNotificationAction(notification);
  const fallbackKey = TYPE_FALLBACKS[String(notification?.type || "system")];
  return PRESENTATIONS[action] || PRESENTATIONS[fallbackKey] || PRESENTATIONS.default;
}

export function getNotificationRoute(
  payload: Partial<Notification> | null | undefined,
  routeBase: "(users)" | "(drivers)",
) {
  const route = payload?.metadata?.route;
  const rideId = payload?.metadata?.ride_id;
  const bookingId = payload?.metadata?.booking_id;
  const action = getNotificationAction(payload);

  if (route === "active-ride") {
    if (routeBase === "(drivers)" && rideId) {
      return {
        pathname: "/(drivers)/active-ride" as const,
        params: { rideId: String(rideId) },
      };
    }

    return { pathname: `/${routeBase}/active-ride` as const };
  }

  if (route === "ride-details" && (bookingId || rideId)) {
    return {
      pathname: `/${routeBase}/ride-details` as const,
      params: bookingId
        ? { bookingId: String(bookingId) }
        : { rideId: String(rideId) },
    };
  }

  if (
    bookingId ||
    rideId ||
    action === "booking_confirmed" ||
    action === "booking_declined" ||
    action === "booking_cancelled" ||
    action === "booking_cancelled_by_user" ||
    action === "ride_accepted" ||
    action === "ride_started" ||
    action === "ride_completed" ||
    action === "ride_cancelled" ||
    action === "payment_status_updated" ||
    action === "payment_received"
  ) {
    return {
      pathname: `/${routeBase}/ride-details` as const,
      params: bookingId
        ? { bookingId: String(bookingId) }
        : rideId
          ? { rideId: String(rideId) }
          : undefined,
    };
  }

  if (route === "available-rides" && routeBase === "(users)") {
    return { pathname: "/(users)/available-rides" as const };
  }

  return { pathname: `/${routeBase}/notifications` as const };
}
