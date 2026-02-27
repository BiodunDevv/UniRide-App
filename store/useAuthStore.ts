import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { authApi } from "@/lib/api";
import useTranslatorStore from "@/store/useTranslatorStore";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DriverProfile {
  _id: string;
  phone: string;
  vehicle_model: string;
  plate_number: string;
  available_seats: number;
  drivers_license: string;
  vehicle_image?: string;
  vehicle_color?: string;
  vehicle_description?: string;
  application_status: "pending" | "approved" | "rejected";
  status: "inactive" | "active";
  rating: number;
  total_ratings: number;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  license_last_updated?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  profile_picture?: string;
  role: "user" | "driver" | "admin" | "super_admin";
  biometric_enabled: boolean;
  pin_enabled: boolean;
  first_login: boolean;
  preferred_language?: string;
  email_verified?: boolean;
  devices?: { device_id: string; device_name?: string; device_type?: string }[];
  driver?: DriverProfile;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setLoading: (v: boolean) => void;
  register: (
    name: string,
    email: string,
    password: string,
    role?: string,
  ) => Promise<any>;
  login: (email: string, password: string, role?: string) => Promise<any>;
  verifyEmail: (email: string, code: string) => Promise<any>;
  resendVerification: (email: string) => Promise<any>;
  forgotPassword: (email: string) => Promise<any>;
  resetPassword: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<any>;
  biometricLogin: () => Promise<any>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  setupPin: (pin: string, password: string) => Promise<any>;
  updatePin: (currentPin: string, newPin: string) => Promise<any>;
  removePin: (password: string) => Promise<any>;
  pinLogin: (pin: string) => Promise<any>;
  forgotPin: () => Promise<any>;
  resetPin: (code: string, newPin: string) => Promise<any>;
  changePassword: (currentPw: string, newPw: string) => Promise<any>;
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

// ─── Device ID helper ─────────────────────────────────────────────────────────
async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync("device_id");
  if (!id) {
    id = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await SecureStore.setItemAsync("device_id", id);
  }
  return id;
}

function getDeviceName(): string {
  // Prefer the actual model (e.g. "iPhone 15 Pro"), fall back to user-customized name
  const model = Device.modelName || Device.deviceName || "Unknown Device";
  const os = Device.osName || "";
  const ver = Device.osVersion || "";
  return os && ver ? `${model} (${os} ${ver})` : model;
}

function getDeviceType(): string {
  switch (Device.deviceType) {
    case Device.DeviceType.PHONE:
      return "mobile";
    case Device.DeviceType.TABLET:
      return "tablet";
    case Device.DeviceType.DESKTOP:
      return "desktop";
    default:
      return "other";
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,

  setLoading: (v) => set({ isLoading: v }),

  register: async (name, email, password, role) => {
    set({ isLoading: true });
    try {
      const res = await authApi.register({ name, email, password, role });
      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password, role) => {
    set({ isLoading: true });
    try {
      const deviceId = await getDeviceId();
      const res = await authApi.login({
        email,
        password,
        device_id: deviceId,
        device_name: getDeviceName(),
        device_type: getDeviceType(),
        role,
      });
      const { user, token } = res.data;
      await SecureStore.setItemAsync("token", token);
      await SecureStore.setItemAsync("user_id", user.id);
      set({ user, token, isAuthenticated: true });

      // Sync language preference from backend
      if (user.preferred_language && user.preferred_language !== "en") {
        useTranslatorStore.getState().setLanguage(user.preferred_language);
      }

      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  verifyEmail: async (email, code) => {
    set({ isLoading: true });
    try {
      const res = await authApi.verifyEmail({ email, code });
      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  resendVerification: async (email) => {
    const res = await authApi.resendVerification({ email });
    return res;
  },

  forgotPassword: async (email) => {
    set({ isLoading: true });
    try {
      const res = await authApi.forgotPassword({ email });
      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  resetPassword: async (email, code, newPassword) => {
    set({ isLoading: true });
    try {
      const res = await authApi.resetPassword({ email, code, newPassword });
      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  biometricLogin: async () => {
    set({ isLoading: true });
    try {
      const userId = await SecureStore.getItemAsync("user_id");
      const deviceId = await getDeviceId();
      if (!userId) throw new Error("No saved user for biometric login");
      const res = await authApi.biometricAuth({
        user_id: userId,
        device_id: deviceId,
      });
      const { user, token } = res.data;
      await SecureStore.setItemAsync("token", token);
      set({ user, token, isAuthenticated: true });
      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  enableBiometric: async () => {
    await authApi.enableBiometric();
    const u = get().user;
    if (u) set({ user: { ...u, biometric_enabled: true } });
  },

  disableBiometric: async () => {
    await authApi.disableBiometric();
    const u = get().user;
    if (u) set({ user: { ...u, biometric_enabled: false } });
  },

  setupPin: async (pin, password) => {
    set({ isLoading: true });
    try {
      const res = await authApi.setupPin({ pin, password });
      const u = get().user;
      if (u) set({ user: { ...u, pin_enabled: true } });
      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  updatePin: async (currentPin, newPin) => {
    set({ isLoading: true });
    try {
      return await authApi.updatePin({
        current_pin: currentPin,
        new_pin: newPin,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  removePin: async (password) => {
    set({ isLoading: true });
    try {
      const res = await authApi.removePin({ password });
      const u = get().user;
      if (u) set({ user: { ...u, pin_enabled: false } });
      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  pinLogin: async (pin) => {
    set({ isLoading: true });
    try {
      const userId = await SecureStore.getItemAsync("user_id");
      const deviceId = await getDeviceId();
      if (!userId) throw new Error("No saved user for PIN login");
      const res = await authApi.pinLogin({
        user_id: userId,
        device_id: deviceId,
        pin,
      });
      const { user, token } = res.data;
      await SecureStore.setItemAsync("token", token);
      set({ user, token, isAuthenticated: true });
      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  forgotPin: async () => {
    set({ isLoading: true });
    try {
      return await authApi.forgotPin();
    } finally {
      set({ isLoading: false });
    }
  },

  resetPin: async (code, newPin) => {
    set({ isLoading: true });
    try {
      const res = await authApi.resetPin({ code, new_pin: newPin });
      const u = get().user;
      if (u) set({ user: { ...u, pin_enabled: true } });
      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  changePassword: async (currentPw, newPw) => {
    set({ isLoading: true });
    try {
      const res = await authApi.changePassword({
        current_password: currentPw,
        new_password: newPw,
      });
      const u = get().user;
      if (u) set({ user: { ...u, first_login: false } });
      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMe: async () => {
    try {
      const res = await authApi.getMe();
      set({ user: res.data, isAuthenticated: true });

      // Sync language if user has a preference set
      const lang = res.data?.preferred_language;
      if (lang && lang !== useTranslatorStore.getState().language) {
        useTranslatorStore.getState().setLanguage(lang);
      }
    } catch {
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  logout: async () => {
    try {
      const deviceId = await getDeviceId();
      await authApi.logout({ device_id: deviceId });
    } catch {
      // Logout on server failed, clean up locally anyway
    }
    await SecureStore.deleteItemAsync("token");
    set({ user: null, token: null, isAuthenticated: false });
  },

  hydrate: async () => {
    const token = await SecureStore.getItemAsync("token");
    if (token) {
      set({ token });
      try {
        const res = await authApi.getMe();
        set({ user: res.data, isAuthenticated: true });

        // Sync language on hydrate
        const lang = res.data?.preferred_language;
        if (lang && lang !== useTranslatorStore.getState().language) {
          useTranslatorStore.getState().setLanguage(lang);
        }
      } catch {
        await SecureStore.deleteItemAsync("token");
        set({ token: null, isAuthenticated: false });
      }
    }
  },
}));
