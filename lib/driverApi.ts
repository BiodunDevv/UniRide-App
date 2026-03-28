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

  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  } catch (networkError: any) {
    throw networkError;
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const error: any = new Error(data?.message || "Request failed");
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data || ({} as T);
}

// ─── Driver API ───────────────────────────────────────────────────────────────
export const driverApi = {
  getProfile() {
    return request("/api/driver/profile");
  },

  updateProfile(body: {
    phone?: string;
    bank_name?: string;
    bank_account_number?: string;
    bank_account_name?: string;
    available_seats?: number;
    vehicle_image?: string;
    vehicle_color?: string;
    vehicle_description?: string;
  }) {
    return request("/api/driver/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  updateLicense(body: { drivers_license: string }) {
    return request("/api/driver/license", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  updateVehicleImage(body: { vehicle_image: string }) {
    return request("/api/driver/vehicle-image", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  verifyBankAccount(body: { account_number: string; bank_code: string }) {
    return request("/api/driver/verify-bank", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  getBankList() {
    return request("/api/driver/banks");
  },

  toggleStatus() {
    return request("/api/driver/toggle-status", { method: "PATCH" });
  },

  getApplicationStatus() {
    return request("/api/driver/status");
  },
};

// ─── Settings API ─────────────────────────────────────────────────────────────
export const settingsApi = {
  getNotificationSettings() {
    return request("/api/settings/notifications");
  },

  updateNotificationSettings(body: {
    push_notifications_enabled?: boolean;
    email_notifications_enabled?: boolean;
    notification_preferences?: Record<string, boolean>;
  }) {
    return request("/api/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  getPushHealth(params?: { push_token?: string | null; device_id?: string | null }) {
    const qs = new URLSearchParams();
    if (params?.push_token) qs.set("push_token", params.push_token);
    if (params?.device_id) qs.set("device_id", params.device_id);
    const query = qs.toString();
    return request(`/api/settings/push-health${query ? `?${query}` : ""}`);
  },

  syncPushToken(body: {
    push_token: string;
    device_id?: string;
    platform?: string;
    send_login_test?: boolean;
    send_test_push?: boolean;
  }) {
    return request("/api/settings/push-sync", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
