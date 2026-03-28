import { create } from "zustand";

type PushHealthResponse = {
  success: boolean;
  data?: {
    native_push_available: boolean;
    push_notifications_enabled: boolean;
    current_push_token_registered: boolean;
    current_device_registered: boolean;
    registered_token_count: number;
    linked_device_count?: number;
    last_registration_at?: string | null;
    push_result?: {
      success?: boolean;
      error?: string;
      sent_count?: number;
      failed_count?: number;
    } | null;
    preference_health: Record<
      string,
      {
        enabled: boolean;
      }
    >;
  };
};

interface PushDebugState {
  currentPushToken: string | null;
  currentDeviceId: string | null;
  permissionStatus: string | null;
  nativePushAvailable: boolean;
  backendHealth: PushHealthResponse["data"] | null;
  lastCheckedAt: string | null;
  lastRegistrationAt: string | null;
  setCurrentPushToken: (token: string | null) => void;
  setCurrentDeviceId: (deviceId: string | null) => void;
  setPermissionStatus: (status: string | null) => void;
  setNativePushAvailable: (available: boolean) => void;
  setBackendHealth: (health: PushHealthResponse["data"] | null) => void;
  clear: () => void;
}

export const usePushDebugStore = create<PushDebugState>((set) => ({
  currentPushToken: null,
  currentDeviceId: null,
  permissionStatus: null,
  nativePushAvailable: false,
  backendHealth: null,
  lastCheckedAt: null,
  lastRegistrationAt: null,
  setCurrentPushToken: (token) => set({ currentPushToken: token }),
  setCurrentDeviceId: (deviceId) => set({ currentDeviceId: deviceId }),
  setPermissionStatus: (status) => set({ permissionStatus: status }),
  setNativePushAvailable: (available) => set({ nativePushAvailable: available }),
  setBackendHealth: (health) =>
    set({
      backendHealth: health,
      lastCheckedAt: health ? new Date().toISOString() : null,
      lastRegistrationAt: health?.last_registration_at || null,
    }),
  clear: () =>
    set({
      currentPushToken: null,
      currentDeviceId: null,
      permissionStatus: null,
      backendHealth: null,
      lastCheckedAt: null,
      lastRegistrationAt: null,
    }),
}));
