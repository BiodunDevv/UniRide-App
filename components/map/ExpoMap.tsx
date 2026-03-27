/**
 * Expo Maps-only wrapper built on react-native-maps.
 * The backend now controls a single expo_maps_enabled flag for mobile.
 * When maps are disabled, screens can still render graceful read-only content.
 */
import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

let RNMaps: any = null;
let isExpoMapsAvailable = false;
try {
  RNMaps = require("react-native-maps");
  isExpoMapsAvailable = true;
} catch {
  isExpoMapsAvailable = false;
}

const noopMapModule = { setAccessToken: (_token: string) => {} };

const MapAvailabilityContext = createContext<{
  mapsEnabled: boolean;
  setMapsEnabled: (enabled: boolean) => void;
}>({
  mapsEnabled: true,
  setMapsEnabled: () => {},
});

export function MapProviderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mapsEnabled, setMapsEnabled] = useState(true);

  return (
    <MapAvailabilityContext.Provider value={{ mapsEnabled, setMapsEnabled }}>
      {children}
    </MapAvailabilityContext.Provider>
  );
}

export function useMapProvider() {
  return useContext(MapAvailabilityContext);
}

export { isExpoMapsAvailable };
export default noopMapModule;

const ExpoMapRefContext = createContext<React.MutableRefObject<any>>({
  current: null,
});

function zoomToDelta(zoom: number): number {
  return 360 / Math.pow(2, zoom || 14);
}

interface UnifiedMapViewProps {
  style?: any;
  children?: React.ReactNode;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  showsUserLocation?: boolean;
  [key: string]: any;
}

export const MapView = forwardRef(
  (
    {
      children,
      style,
      initialRegion,
      showsUserLocation,
      ...props
    }: UnifiedMapViewProps,
    ref: any,
  ) => {
    const { mapsEnabled } = useMapProvider();
    const expoMapRef = useRef<any>(null);

    if (!mapsEnabled || !isExpoMapsAvailable) {
      return (
        <View style={[styles.fallback, style]}>
          <View style={styles.fallbackContent}>
            <Ionicons name="map-outline" size={44} color="#94A3B8" />
            <Text style={styles.fallbackTitle}>Map temporarily unavailable</Text>
            <Text style={styles.fallbackText}>
              Live trip details still work normally. Enable Expo Maps in admin
              settings to restore the interactive map.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <ExpoMapRefContext.Provider value={expoMapRef}>
        <RNMaps.default
          ref={(instance: any) => {
            expoMapRef.current = instance;
            if (typeof ref === "function") ref(instance);
            else if (ref) ref.current = instance;
          }}
          style={[{ flex: 1 }, style]}
          initialRegion={
            initialRegion || {
              latitude: 7.52,
              longitude: 4.52,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }
          }
          showsUserLocation={showsUserLocation ?? true}
          followsUserLocation={false}
          showsMyLocationButton={false}
          {...props}
        >
          {children}
        </RNMaps.default>
      </ExpoMapRefContext.Provider>
    );
  },
);
MapView.displayName = "MapView";

const ExpoCamera = forwardRef((props: any, ref: any) => {
  const mapRef = useContext(ExpoMapRefContext);
  const hasAppliedDefaultSettings = useRef(false);

  useImperativeHandle(ref, () => ({
    setCamera: ({
      centerCoordinate,
      zoomLevel,
      animationDuration,
    }: {
      centerCoordinate?: [number, number];
      zoomLevel?: number;
      animationDuration?: number;
    }) => {
      if (!mapRef?.current || !centerCoordinate) return;
      const delta = zoomToDelta(zoomLevel || 14);
      mapRef.current.animateToRegion(
        {
          longitude: centerCoordinate[0],
          latitude: centerCoordinate[1],
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        animationDuration || 1000,
      );
    },
  }));

  useEffect(() => {
    if (hasAppliedDefaultSettings.current) return;
    const ds = props.defaultSettings;
    if (!ds?.centerCoordinate || !mapRef?.current) return;
    hasAppliedDefaultSettings.current = true;

    const delta = zoomToDelta(ds.zoomLevel || 14);
    const timer = setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          longitude: ds.centerCoordinate[0],
          latitude: ds.centerCoordinate[1],
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        500,
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [mapRef, props.defaultSettings]);

  return null;
});
ExpoCamera.displayName = "ExpoCamera";

export const Camera = forwardRef((props: any, ref: any) => {
  return <ExpoCamera ref={ref} {...props} />;
});
(Camera as any).displayName = "Camera";

export const LocationPuck = () => null;

export const Marker = isExpoMapsAvailable
  ? RNMaps.Marker
  : (_props: any) => null;
export const Polyline = isExpoMapsAvailable
  ? RNMaps.Polyline
  : (_props: any) => null;
export const Callout = isExpoMapsAvailable
  ? RNMaps.Callout
  : (_props: any) => null;
export const Circle = isExpoMapsAvailable
  ? RNMaps.Circle
  : (_props: any) => null;

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  fallbackContent: {
    alignItems: "center",
    paddingHorizontal: 28,
    maxWidth: 320,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 12,
  },
  fallbackText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});
