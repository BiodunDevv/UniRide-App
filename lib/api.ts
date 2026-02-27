import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    const error: any = new Error(data.message || "Request failed");
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  register(body: {
    name: string;
    email: string;
    password: string;
    role?: string;
  }) {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  login(body: {
    email: string;
    password: string;
    device_id: string;
    device_name?: string;
    device_type?: string;
    platform?: string;
    role?: string;
  }) {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ ...body, platform: body.platform || "mobile" }),
    });
  },

  verifyEmail(body: { email: string; code: string }) {
    return request("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  resendVerification(body: { email: string }) {
    return request("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  forgotPassword(body: { email: string }) {
    return request("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  resetPassword(body: { email: string; code: string; newPassword: string }) {
    return request("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  biometricAuth(body: { user_id: string; device_id: string }) {
    return request("/api/auth/biometric", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  logout(body: { device_id: string }) {
    return request("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  changePassword(body: { current_password: string; new_password: string }) {
    return request("/api/auth/change-password", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  enableBiometric() {
    return request("/api/auth/enable-biometric", {
      method: "PATCH",
    });
  },

  disableBiometric() {
    return request("/api/auth/disable-biometric", {
      method: "PATCH",
    });
  },

  getMe() {
    return request("/api/auth/me");
  },

  updateProfile(body: { name?: string; profile_picture?: string }) {
    return request("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  getDevices() {
    return request("/api/auth/devices");
  },

  removeDevice(deviceId: string) {
    return request(`/api/auth/devices/${deviceId}`, {
      method: "DELETE",
    });
  },

  logoutAllDevices() {
    return request("/api/auth/devices/logout-all", {
      method: "POST",
    });
  },

  // ─── Notifications ────────────────────────────────────────────────────────
  getNotifications(params?: { limit?: number; is_read?: boolean }) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.is_read !== undefined)
      qs.set("is_read", String(params.is_read));
    const query = qs.toString();
    return request(`/api/auth/notifications${query ? `?${query}` : ""}`);
  },

  getNotificationDetail(id: string) {
    return request(`/api/auth/notifications/${id}`);
  },

  markNotificationRead(id: string) {
    return request(`/api/auth/notifications/${id}/read`, {
      method: "PATCH",
    });
  },

  markAllNotificationsRead() {
    return request("/api/auth/notifications/mark-all-read", {
      method: "PATCH",
    });
  },

  clearAllNotifications() {
    return request("/api/auth/notifications", {
      method: "DELETE",
    });
  },

  // ─── PIN ──────────────────────────────────────────────────────────────────
  setupPin(body: { pin: string; password: string }) {
    return request("/api/auth/pin/setup", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updatePin(body: { current_pin: string; new_pin: string }) {
    return request("/api/auth/pin/update", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  removePin(body: { password: string }) {
    return request("/api/auth/pin/remove", {
      method: "DELETE",
      body: JSON.stringify(body),
    });
  },

  pinLogin(body: { user_id: string; device_id: string; pin: string }) {
    return request("/api/auth/pin/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  forgotPin() {
    return request("/api/auth/pin/forgot", { method: "POST" });
  },

  resetPin(body: { code: string; new_pin: string }) {
    return request("/api/auth/pin/reset", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // ─── Push Token ───────────────────────────────────────────────────────────
  registerPushToken(body: {
    push_token: string;
    device_id?: string;
    platform?: string;
  }) {
    return request("/api/settings/push-token", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  removePushToken(body: { push_token: string }) {
    return request("/api/settings/push-token", {
      method: "DELETE",
      body: JSON.stringify(body),
    });
  },

  // ─── Notification Settings ────────────────────────────────────────────────
  // ─── Language ─────────────────────────────────────────────────────────
  getAvailableLanguages() {
    return request("/api/auth/languages");
  },

  updateLanguagePreference(language: string) {
    return request("/api/auth/language", {
      method: "PATCH",
      body: JSON.stringify({ language }),
    });
  },

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
};
