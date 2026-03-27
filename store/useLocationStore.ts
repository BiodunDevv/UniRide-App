import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { locationApi } from "@/lib/rideApi";

export interface OnlineDriver {
  driver_id: string;
  user_id: string;
  name: string;
  profile_picture: string | null;
  vehicle_model: string;
  vehicle_color: string;
  plate_number: string;
  available_seats: number;
  rating: number;
  total_ratings: number;
  heading: number;
  is_online: boolean;
  location: { latitude: number; longitude: number } | null;
  last_online_at: string;
}

interface LocationState {
  // User's current location
  userLocation: { latitude: number; longitude: number } | null;
  locationPermissionGranted: boolean;

  // Online drivers visible on map
  onlineDrivers: OnlineDriver[];
  isLoadingDrivers: boolean;

  // Driver online status (for driver role)
  isDriverOnline: boolean;
  isTogglingOnline: boolean;
  lastDriverPresenceLocation: { latitude: number; longitude: number } | null;

  // Actions
  setUserLocation: (location: { latitude: number; longitude: number }) => void;
  setLocationPermission: (granted: boolean) => void;
  fetchOnlineDrivers: () => Promise<void>;
  updateDriverInList: (
    driverId: string,
    location: { latitude: number; longitude: number },
    heading?: number,
  ) => void;
  removeDriverFromList: (driverId: string) => void;
  addDriverToList: (driver: OnlineDriver) => void;

  // Driver actions
  goOnline: (
    latitude: number,
    longitude: number,
    heading?: number,
  ) => Promise<void>;
  goOffline: () => Promise<void>;
  updateLiveLocation: (
    latitude: number,
    longitude: number,
    heading?: number,
  ) => Promise<void>;
  setDriverOnlineStatus: (isOnline: boolean) => void;
  setLastDriverPresenceLocation: (
    location: { latitude: number; longitude: number } | null,
  ) => void;
  restoreOnlineState: () => Promise<void>;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      userLocation: null,
      locationPermissionGranted: false,
      onlineDrivers: [],
      isLoadingDrivers: false,
      isDriverOnline: false,
      isTogglingOnline: false,
      lastDriverPresenceLocation: null,

      setUserLocation: (location) => set({ userLocation: location }),

      setLocationPermission: (granted) =>
        set({ locationPermissionGranted: granted }),

      fetchOnlineDrivers: async () => {
        try {
          set({ isLoadingDrivers: true });
          const { userLocation } = get();
          const res = await locationApi.getOnlineDrivers(
            userLocation
              ? {
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                  radius: 50000,
                }
              : undefined,
          );
          set({ onlineDrivers: res.data || [], isLoadingDrivers: false });
        } catch {
          set({ isLoadingDrivers: false });
        }
      },

      updateDriverInList: (driverId, location, heading) => {
        set((state) => ({
          onlineDrivers: state.onlineDrivers.map((d) =>
            d.driver_id === driverId
              ? { ...d, location, heading: heading ?? d.heading }
              : d,
          ),
        }));
      },

      removeDriverFromList: (driverId) => {
        set((state) => ({
          onlineDrivers: state.onlineDrivers.filter(
            (d) => d.driver_id !== driverId,
          ),
        }));
      },

      addDriverToList: (driver) => {
        set((state) => {
          const exists = state.onlineDrivers.find(
            (d) => d.driver_id === driver.driver_id,
          );
          if (exists) {
            return {
              onlineDrivers: state.onlineDrivers.map((d) =>
                d.driver_id === driver.driver_id ? { ...d, ...driver } : d,
              ),
            };
          }
          return { onlineDrivers: [...state.onlineDrivers, driver] };
        });
      },

      goOnline: async (latitude, longitude, heading) => {
        try {
          set({ isTogglingOnline: true });
          await locationApi.goOnline({ latitude, longitude, heading });
          set({
            isDriverOnline: true,
            isTogglingOnline: false,
            lastDriverPresenceLocation: { latitude, longitude },
            userLocation: { latitude, longitude },
          });
        } catch (error) {
          set({ isTogglingOnline: false });
          throw error;
        }
      },

      goOffline: async () => {
        try {
          set({ isTogglingOnline: true });
          await locationApi.goOffline();
          set({ isDriverOnline: false, isTogglingOnline: false });
        } catch (error) {
          set({ isTogglingOnline: false });
          throw error;
        }
      },

      updateLiveLocation: async (latitude, longitude, heading) => {
        try {
          await locationApi.updateDriverLocation({ latitude, longitude, heading });
          set({
            lastDriverPresenceLocation: { latitude, longitude },
            userLocation: { latitude, longitude },
          });
        } catch {
          // Non-critical, will retry on next interval
        }
      },

      setDriverOnlineStatus: (isOnline) => set({ isDriverOnline: isOnline }),

      setLastDriverPresenceLocation: (location) =>
        set({ lastDriverPresenceLocation: location }),

      restoreOnlineState: async () => {
        try {
          const res = await locationApi.getDriverProfile();
          const driver = res.data;
          const coordinates =
            driver?.current_location?.coordinates ||
            driver?.last_known_location?.coordinates;

          const nextLocation =
            coordinates?.length === 2
              ? {
                  latitude: coordinates[1],
                  longitude: coordinates[0],
                }
              : null;

          set({
            isDriverOnline: Boolean(driver?.is_online),
            lastDriverPresenceLocation: nextLocation,
            userLocation: nextLocation || get().userLocation,
          });
        } catch {
          // Keep persisted state if backend sync fails transiently.
        }
      },
    }),
    {
      name: "location-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        userLocation: state.userLocation,
        isDriverOnline: state.isDriverOnline,
        lastDriverPresenceLocation: state.lastDriverPresenceLocation,
      }),
    },
  ),
);
