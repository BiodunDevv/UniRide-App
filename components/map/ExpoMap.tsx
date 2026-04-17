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
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  isGoogleMapsConfigured,
  sanitizeLatLng,
  sanitizeMapRegion,
  sanitizeRouteGeometry,
} from "@/lib/mapSafety";
import { recordBootstrapTrace } from "@/lib/post-auth";

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
  canRenderMaps: boolean;
  runtimeFailure: string | null;
  setMapsEnabled: (enabled: boolean) => void;
  reportRuntimeFailure: (reason: string) => void;
}>({
  mapsEnabled: true,
  canRenderMaps: true,
  runtimeFailure: null,
  setMapsEnabled: () => {},
  reportRuntimeFailure: () => {},
});

export function MapProviderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mapsEnabled, setMapsEnabled] = useState(true);
  const [runtimeFailure, setRuntimeFailure] = useState<string | null>(null);

  const handleSetMapsEnabled = useCallback((enabled: boolean) => {
    setMapsEnabled(enabled);
    if (enabled) {
      setRuntimeFailure(null);
    }
  }, []);

  const reportRuntimeFailure = useCallback((reason: string) => {
    setRuntimeFailure((current) => current || reason);
    recordBootstrapTrace("maps:runtime-failure", reason).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      mapsEnabled,
      canRenderMaps: mapsEnabled && !runtimeFailure,
      runtimeFailure,
      setMapsEnabled: handleSetMapsEnabled,
      reportRuntimeFailure,
    }),
    [handleSetMapsEnabled, mapsEnabled, reportRuntimeFailure, runtimeFailure],
  );

  return (
    <MapAvailabilityContext.Provider value={value}>
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
  allowEmptyInitialRegion?: boolean;
  [key: string]: any;
}

class MapRenderBoundary extends React.Component<
  {
    onError: (error: Error) => void;
    children: React.ReactNode;
  },
  { hasError: boolean }
> {
  constructor(props: { onError: (error: Error) => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export const MapView = forwardRef(
  (
    {
      children,
      style,
      initialRegion,
      showsUserLocation,
      allowEmptyInitialRegion,
      ...props
    }: UnifiedMapViewProps,
    ref: any,
  ) => {
    const { canRenderMaps, runtimeFailure, reportRuntimeFailure } =
      useMapProvider();
    const expoMapRef = useRef<any>(null);
    const [mapReady, setMapReady] = useState(false);
    const [localFailure, setLocalFailure] = useState<string | null>(null);
    const nativeMapConfigured = isGoogleMapsConfigured();
    const safeInitialRegion =
      !initialRegion && allowEmptyInitialRegion
        ? undefined
        : sanitizeMapRegion(initialRegion);

    useEffect(() => {
      if (!canRenderMaps || !isExpoMapsAvailable || !nativeMapConfigured) {
        return;
      }

      setMapReady(false);
      setLocalFailure(null);
    }, [canRenderMaps, nativeMapConfigured]);

    useEffect(() => {
      if (
        !canRenderMaps ||
        !isExpoMapsAvailable ||
        !nativeMapConfigured ||
        mapReady
      ) {
        return;
      }

      const timeout = setTimeout(() => {
        setLocalFailure((current) => {
          if (current) return current;
          reportRuntimeFailure("map-ready-timeout");
          return "map-ready-timeout";
        });
      }, 8000);

      return () => clearTimeout(timeout);
    }, [
      canRenderMaps,
      mapReady,
      nativeMapConfigured,
      reportRuntimeFailure,
    ]);

    const fallbackReason =
      localFailure ||
      runtimeFailure ||
      (!nativeMapConfigured && Platform.OS === "android"
        ? "android-provider-not-configured"
        : null);

    if (localFailure || !canRenderMaps || !isExpoMapsAvailable || !nativeMapConfigured) {
      return (
        <View style={[styles.fallback, style]}>
          <View style={styles.fallbackContent}>
            <Ionicons name="map-outline" size={44} color="#94A3B8" />
            <Text style={styles.fallbackTitle}>Map temporarily unavailable</Text>
            <Text style={styles.fallbackText}>
              {fallbackReason === "android-provider-not-configured"
                ? "This Android build does not have a native Google Maps provider configured yet. Live trip details still work normally."
                : "Live trip details still work normally. Enable Expo Maps in admin settings to restore the interactive map."}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <ExpoMapRefContext.Provider value={expoMapRef}>
        <MapRenderBoundary
          onError={(error) => {
            const reason = `map-render-boundary:${error.message}`;
            setLocalFailure(reason);
            reportRuntimeFailure(reason);
          }}
        >
          <RNMaps.default
            ref={(instance: any) => {
              expoMapRef.current = instance;
              if (typeof ref === "function") ref(instance);
              else if (ref) ref.current = instance;
            }}
            {...props}
            style={[{ flex: 1 }, style]}
            provider={
              Platform.OS === "android" ? RNMaps.PROVIDER_GOOGLE : undefined
            }
            initialRegion={safeInitialRegion}
            showsUserLocation={showsUserLocation ?? true}
            followsUserLocation={false}
            showsMyLocationButton={false}
            onMapReady={() => {
              setMapReady(true);
              props.onMapReady?.();
            }}
            onMapLoaded={() => {
              setMapReady(true);
              props.onMapLoaded?.();
            }}
          >
            {children}
          </RNMaps.default>
        </MapRenderBoundary>
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

export function Marker({ coordinate, ...props }: any) {
  const { canRenderMaps } = useMapProvider();
  if (!canRenderMaps || !isExpoMapsAvailable) return null;
  const safeCoordinate = sanitizeLatLng(coordinate);
  if (!safeCoordinate) return null;
  return <RNMaps.Marker coordinate={safeCoordinate} {...props} />;
}
Marker.displayName = "SafeMarker";

export function Polyline({ coordinates, ...props }: any) {
  const { canRenderMaps } = useMapProvider();
  if (!canRenderMaps || !isExpoMapsAvailable) return null;
  const safeCoordinates = Array.isArray(coordinates)
    ? coordinates.map((point) => sanitizeLatLng(point)).filter(Boolean)
    : sanitizeRouteGeometry(coordinates);

  if (safeCoordinates.length < 2) return null;
  return <RNMaps.Polyline coordinates={safeCoordinates} {...props} />;
}
Polyline.displayName = "SafePolyline";
export const Callout = isExpoMapsAvailable
  ? RNMaps.Callout
  : (_props: any) => null;
export function Circle({ center, ...props }: any) {
  const { canRenderMaps } = useMapProvider();
  if (!canRenderMaps || !isExpoMapsAvailable) return null;
  const safeCenter = sanitizeLatLng(center);
  if (!safeCenter) return null;
  return <RNMaps.Circle center={safeCenter} {...props} />;
}
Circle.displayName = "SafeCircle";

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
