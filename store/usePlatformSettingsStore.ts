import { create } from "zustand";
import { platformApi } from "@/lib/api";

export interface FarePolicyInfo {
  mode: "admin" | "driver" | "distance_auto";
  base_fare: number;
  minimum_fare: number;
  per_km_rate: number;
}

export interface PlatformSettings {
  map_provider: "mapbox" | "expo";
  mapbox_enabled: boolean;
  expo_maps_enabled: boolean;
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
}

const DEFAULT_SETTINGS: PlatformSettings = {
  map_provider: "mapbox",
  mapbox_enabled: true,
  expo_maps_enabled: true,
  fare_per_seat: true,
  maintenance_mode: false,
  app_version_minimum: "1.0.0",
  max_seats_per_booking: 4,
  allow_ride_without_driver: true,
  auto_accept_bookings: false,
  fare_policy: null,
};

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
          set({ settings: { ...DEFAULT_SETTINGS, ...res.data } });
        }
      } catch (error: any) {
        set({ error: error.message || "Failed to fetch settings" });
      } finally {
        set({ isLoading: false });
      }
    },
  }),
);
