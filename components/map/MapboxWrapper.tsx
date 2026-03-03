/**
 * Unified Map wrapper — supports Mapbox and Expo Maps (react-native-maps).
 * The active provider is controlled at runtime by platform settings from the
 * backend (map_provider: "mapbox" | "expo"). ALL exported components
 * (MapView, Camera, LocationPuck, ShapeSource, etc.) dynamically switch
 * implementation based on the current provider, so screens don't need to care.
 *
 * Usage: import from "@/components/map/MapboxWrapper" instead of "@rnmapbox/maps"
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ─── Build-time provider detection ──────────────────────────────────────────

let MapboxModule: any = null;
let isMapboxAvailable = false;
try {
  MapboxModule = require("@rnmapbox/maps");
  isMapboxAvailable = true;
} catch {
  isMapboxAvailable = false;
}

let RNMaps: any = null;
let isExpoMapsAvailable = false;
try {
  RNMaps = require("react-native-maps");
  isExpoMapsAvailable = true;
} catch {
  isExpoMapsAvailable = false;
}

// ─── Runtime map provider context ───────────────────────────────────────────

type MapProvider = "mapbox" | "expo" | "none";

const MapProviderContext = createContext<{
  provider: MapProvider;
  setProvider: (p: MapProvider) => void;
}>({
  provider: isMapboxAvailable
    ? "mapbox"
    : isExpoMapsAvailable
      ? "expo"
      : "none",
  setProvider: () => {},
});

export function MapProviderProvider({
  children,
  initialProvider,
}: {
  children: React.ReactNode;
  initialProvider?: MapProvider;
}) {
  const [provider, setProvider] = useState<MapProvider>(
    initialProvider ??
      (isMapboxAvailable ? "mapbox" : isExpoMapsAvailable ? "expo" : "none"),
  );

  return (
    <MapProviderContext.Provider value={{ provider, setProvider }}>
      {children}
    </MapProviderContext.Provider>
  );
}

export function useMapProvider() {
  return useContext(MapProviderContext);
}

export { isMapboxAvailable, isExpoMapsAvailable };

// Default export (Mapbox namespace — setAccessToken is safe to call always)
const Mapbox = isMapboxAvailable
  ? MapboxModule.default
  : { setAccessToken: (_token: string) => {} };

export default Mapbox;

// ─── Internal: shared ref context (expo Camera ↔ MapView) ──────────────────

const ExpoMapRefContext = createContext<React.MutableRefObject<any>>({
  current: null,
});

// Helper: convert Mapbox zoom level → react-native-maps delta
function zoomToDelta(zoom: number): number {
  return 360 / Math.pow(2, zoom || 14);
}

// ─── Unified MapView ────────────────────────────────────────────────────────

interface UnifiedMapViewProps {
  style?: any;
  children?: React.ReactNode;
  // Mapbox props
  styleURL?: string;
  compassEnabled?: boolean;
  scaleBarEnabled?: boolean;
  // Expo Maps / shared
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  showsUserLocation?: boolean;
  onPress?: (e: any) => void;
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
    const { provider } = useMapProvider();
    const expoMapRef = useRef<any>(null);

    if (provider === "mapbox" && isMapboxAvailable) {
      return (
        <MapboxModule.MapView ref={ref} style={[{ flex: 1 }, style]} {...props}>
          {children}
        </MapboxModule.MapView>
      );
    }

    if (provider === "expo" && isExpoMapsAvailable) {
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
            showsUserLocation
            followsUserLocation
            showsMyLocationButton={false}
            {...props}
          >
            {children}
          </RNMaps.default>
        </ExpoMapRefContext.Provider>
      );
    }

    // Fallback
    return (
      <View style={[styles.fallback, style]}>
        <View style={styles.fallbackContent}>
          <Ionicons name="map-outline" size={48} color="#9CA3AF" />
          <Text style={styles.fallbackTitle}>Map Unavailable</Text>
          <Text style={styles.fallbackText}>
            No map provider available.{"\n"}Install a development build or
            enable Expo Maps.
          </Text>
        </View>
        {children}
      </View>
    );
  },
);
MapView.displayName = "MapView";

// ─── Camera ─────────────────────────────────────────────────────────────────
// Mapbox: delegates to @rnmapbox/maps Camera
// Expo:   reads shared MapView ref, calls animateToRegion; exposes setCamera()

const ExpoCamera = forwardRef((props: any, ref: any) => {
  const mapRef = useContext(ExpoMapRefContext);

  useImperativeHandle(ref, () => ({
    setCamera: ({
      centerCoordinate,
      zoomLevel,
      animationDuration,
    }: {
      centerCoordinate?: [number, number];
      zoomLevel?: number;
      animationDuration?: number;
      pitch?: number;
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

  // On mount: fly to defaultSettings location
  useEffect(() => {
    const ds = props.defaultSettings;
    if (ds?.centerCoordinate && mapRef?.current) {
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
      }, 400);
      return () => clearTimeout(timer);
    }
  }, []);

  return null;
});
ExpoCamera.displayName = "ExpoCamera";

export const Camera = forwardRef((props: any, ref: any) => {
  const { provider } = useMapProvider();
  if (provider === "mapbox" && isMapboxAvailable) {
    const MBCamera = MapboxModule.Camera;
    return <MBCamera ref={ref} {...props} />;
  }
  return <ExpoCamera ref={ref} {...props} />;
});
(Camera as any).displayName = "Camera";

// ─── LocationPuck ───────────────────────────────────────────────────────────
// Mapbox: delegates to @rnmapbox/maps LocationPuck
// Expo:   no-op — MapView's showsUserLocation handles the blue dot

export const LocationPuck = (props: any) => {
  const { provider } = useMapProvider();
  if (provider === "mapbox" && isMapboxAvailable) {
    const MBPuck = MapboxModule.LocationPuck;
    return <MBPuck {...props} />;
  }
  return null;
};

// ─── ShapeSource ────────────────────────────────────────────────────────────
// Only functional on Mapbox; renders children as-is on expo so Markers pass through

export const ShapeSource = (props: any) => {
  const { provider } = useMapProvider();
  if (provider === "mapbox" && isMapboxAvailable) {
    const MBSource = MapboxModule.ShapeSource;
    return <MBSource {...props} />;
  }
  return <>{props.children}</>;
};

// ─── LineLayer ──────────────────────────────────────────────────────────────

export const LineLayer = (props: any) => {
  const { provider } = useMapProvider();
  if (provider === "mapbox" && isMapboxAvailable) {
    const MBLine = MapboxModule.LineLayer;
    return <MBLine {...props} />;
  }
  return null;
};

// ─── SymbolLayer ────────────────────────────────────────────────────────────

export const SymbolLayer = (props: any) => {
  const { provider } = useMapProvider();
  if (provider === "mapbox" && isMapboxAvailable) {
    const MBSymbol = MapboxModule.SymbolLayer;
    return <MBSymbol {...props} />;
  }
  return null;
};

// ─── PointAnnotation ────────────────────────────────────────────────────────

export const PointAnnotation = forwardRef((props: any, ref: any) => {
  const { provider } = useMapProvider();
  if (provider === "mapbox" && isMapboxAvailable) {
    const MBAnnotation = MapboxModule.PointAnnotation;
    return <MBAnnotation ref={ref} {...props} />;
  }
  return <>{props.children}</>;
});
(PointAnnotation as any).displayName = "PointAnnotation";

// ─── Images ─────────────────────────────────────────────────────────────────

export const Images = (props: any) => {
  const { provider } = useMapProvider();
  if (provider === "mapbox" && isMapboxAvailable) {
    const MBImages = MapboxModule.Images;
    return <MBImages {...props} />;
  }
  return null;
};

// ─── Expo Maps components (Marker, Polyline) ────────────────────────────────

export const ExpoMarker = isExpoMapsAvailable
  ? RNMaps.Marker
  : (_props: any) => null;
export const ExpoPolyline = isExpoMapsAvailable
  ? RNMaps.Polyline
  : (_props: any) => null;
export const ExpoCallout = isExpoMapsAvailable
  ? RNMaps.Callout
  : (_props: any) => null;
export const ExpoCircle = isExpoMapsAvailable
  ? RNMaps.Circle
  : (_props: any) => null;

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackContent: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginTop: 12,
  },
  fallbackText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
  code: {
    fontFamily: "monospace",
    fontWeight: "600",
    color: "#042F40",
  },
});
