import { create } from "zustand";
import { platformApi } from "@/lib/api";

export interface FarePolicyInfo {
  mode: "admin" | "driver" | "distance_auto";
  base_fare: number;
  minimum_fare: number;
  per_km_rate: number;
}

export interface PlatformSettings {
  // Legacy flag retained for backward compatibility during rollout.
  expo_maps_enabled: boolean;
  mobile_map_enabled: boolean;
  mobile_map_provider: "native" | "mapbox";
  mobile_map_3d_enabled: boolean;
  mobile_navigation_enabled: boolean;
  fare_per_seat: boolean;
  maintenance_mode: boolean;
  app_version_minimum: string;
  max_seats_per_booking: number;
  allow_ride_without_driver: boolean;
  auto_accept_bookings: boolean;
  fare_policy: FarePolicyInfo | null;
}

interface PlatformSettingsState {
  settings: PlatformSettings;
  isLoading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  applySettings: (incoming: Partial<PlatformSettings>) => void;
}

const DEFAULT_SETTINGS: PlatformSettings = {
  expo_maps_enabled: true,
  mobile_map_enabled: true,
  mobile_map_provider: "native",
  mobile_map_3d_enabled: false,
  mobile_navigation_enabled: false,
  fare_per_seat: true,
  maintenance_mode: false,
  app_version_minimum: "1.0.0",
  max_seats_per_booking: 4,
  allow_ride_without_driver: true,
  auto_accept_bookings: false,
  fare_policy: null,
};

function normalizeSettingsData(
  incoming?: Partial<PlatformSettings> | null,
): PlatformSettings {
  const source = incoming || {};
  const merged = {
    ...DEFAULT_SETTINGS,
    ...source,
  } as PlatformSettings;

  const mobileMapEnabled =
    source.mobile_map_enabled ?? source.expo_maps_enabled;

  merged.mobile_map_enabled = Boolean(mobileMapEnabled);
  merged.expo_maps_enabled = Boolean(mobileMapEnabled);
  merged.mobile_map_provider =
    source.mobile_map_provider === "mapbox" ? "mapbox" : "native";
  merged.mobile_map_3d_enabled = Boolean(source.mobile_map_3d_enabled);
  merged.mobile_navigation_enabled = Boolean(source.mobile_navigation_enabled);

  return merged;
}

export const usePlatformSettingsStore = create<PlatformSettingsState>(
  (set) => ({
    settings: DEFAULT_SETTINGS,
    isLoading: false,
    error: null,

    fetchSettings: async () => {
      try {
        set({ isLoading: true, error: null });
        const res = await platformApi.getSettings();
        if (res.data) {
          set({ settings: normalizeSettingsData(res.data), error: null });
        }
      } catch (error: any) {
        set({ error: error.message || "Failed to fetch settings" });
      } finally {
        set({ isLoading: false });
      }
    },

    applySettings: (incoming) => {
      set((state) => ({
        settings: normalizeSettingsData({
          ...state.settings,
          ...incoming,
        }),
        error: null,
      }));
    },
  }),
);
