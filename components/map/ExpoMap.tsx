/**
 * Unified map wrapper with provider-aware runtime switching.
 * Supports native maps and optional Mapbox, with graceful fallback on errors.
 */
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import Constants from "expo-constants";
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
let isNativeMapsAvailable = false;
try {
  RNMaps = require("react-native-maps");
  isNativeMapsAvailable = true;
} catch {
  isNativeMapsAvailable = false;
}

let RNMapbox: any = null;
let isMapboxModuleAvailable = false;
try {
  RNMapbox = require("@rnmapbox/maps");
  isMapboxModuleAvailable = true;
} catch {
  isMapboxModuleAvailable = false;
}

const Mapbox = RNMapbox?.default ?? RNMapbox;
const isExpoGoRuntime = Constants.appOwnership === "expo";
const mapboxToken = String(
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    "",
).trim();
const isMapboxTokenConfigured = mapboxToken.length > 0;

if (
  isMapboxModuleAvailable &&
  isMapboxTokenConfigured &&
  typeof Mapbox?.setAccessToken === "function"
) {
  try {
    Mapbox.setAccessToken(mapboxToken);
  } catch {
    // Ignore token init issues and let runtime fallback handle availability.
  }
}

const isMapboxAvailable =
  isMapboxModuleAvailable && isMapboxTokenConfigured && !isExpoGoRuntime;

const UBER_NAV_ZOOM_LEVEL = 16.2;
const UBER_NAV_PITCH = 58;
const MAP_3D_PITCH = 50;
const DEFAULT_MAP_ZOOM = 14;

const MAP_PROVIDER_NATIVE = "native" as const;
const MAP_PROVIDER_MAPBOX = "mapbox" as const;

type MapProviderKey = typeof MAP_PROVIDER_NATIVE | typeof MAP_PROVIDER_MAPBOX;

const noopMapModule = { setAccessToken: (_token: string) => {} };

const MapAvailabilityContext = createContext<{
  mapsEnabled: boolean;
  providerEnabled: boolean;
  provider: MapProviderKey;
  map3dEnabled: boolean;
  navigationEnabled: boolean;
  nativeModuleAvailable: boolean;
  mapboxModuleAvailable: boolean;
  mapboxExpoGoRuntime: boolean;
  mapboxTokenConfigured: boolean;
  requestedProviderAvailable: boolean;
  shouldUseNativeMapCanvas: boolean;
  shouldUseMapboxCanvas: boolean;
  canRenderMaps: boolean;
  runtimeFailure: string | null;
  setMapsEnabled: (enabled: boolean) => void;
  setProviderEnabled: (enabled: boolean) => void;
  setProvider: (provider: MapProviderKey) => void;
  setMap3dEnabled: (enabled: boolean) => void;
  setNavigationEnabled: (enabled: boolean) => void;
  setNativeModuleAvailable: (available: boolean) => void;
  reportRuntimeFailure: (reason: string) => void;
}>({
  mapsEnabled: true,
  providerEnabled: true,
  provider: MAP_PROVIDER_NATIVE,
  map3dEnabled: false,
  navigationEnabled: false,
  nativeModuleAvailable: true,
  mapboxModuleAvailable: false,
  mapboxExpoGoRuntime: false,
  mapboxTokenConfigured: false,
  requestedProviderAvailable: true,
  shouldUseNativeMapCanvas: true,
  shouldUseMapboxCanvas: false,
  canRenderMaps: true,
  runtimeFailure: null,
  setMapsEnabled: () => {},
  setProviderEnabled: () => {},
  setProvider: () => {},
  setMap3dEnabled: () => {},
  setNavigationEnabled: () => {},
  setNativeModuleAvailable: () => {},
  reportRuntimeFailure: () => {},
});

export function MapProviderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mapsEnabled, setMapsEnabled] = useState(true);
  const [providerEnabled, setProviderEnabled] = useState(true);
  const [provider, setProvider] = useState<MapProviderKey>(MAP_PROVIDER_NATIVE);
  const [map3dEnabled, setMap3dEnabled] = useState(false);
  const [navigationEnabled, setNavigationEnabled] = useState(false);
  const [nativeModuleAvailable, setNativeModuleAvailable] = useState(
    isNativeMapsAvailable,
  );
  const [runtimeFailure, setRuntimeFailure] = useState<string | null>(null);

  const handleSetMapsEnabled = useCallback((enabled: boolean) => {
    setMapsEnabled(enabled);
    if (enabled) {
      setRuntimeFailure(null);
    }
  }, []);

  const handleSetProviderEnabled = useCallback((enabled: boolean) => {
    setProviderEnabled(enabled);
    if (enabled) {
      setRuntimeFailure(null);
    }
  }, []);

  const handleSetProvider = useCallback((nextProvider: MapProviderKey) => {
    setProvider(
      nextProvider === MAP_PROVIDER_MAPBOX
        ? MAP_PROVIDER_MAPBOX
        : MAP_PROVIDER_NATIVE,
    );
    setRuntimeFailure(null);
  }, []);

  const handleSetMap3dEnabled = useCallback((enabled: boolean) => {
    setMap3dEnabled(enabled);
  }, []);

  const handleSetNavigationEnabled = useCallback((enabled: boolean) => {
    setNavigationEnabled(enabled);
  }, []);

  const handleSetNativeModuleAvailable = useCallback((available: boolean) => {
    setNativeModuleAvailable(available);
  }, []);

  const reportRuntimeFailure = useCallback((reason: string) => {
    setRuntimeFailure((current) => current || reason);
    recordBootstrapTrace("maps:runtime-failure", reason).catch(() => {});
  }, []);

  const requestedProviderAvailable =
    provider === MAP_PROVIDER_MAPBOX
      ? isMapboxAvailable
      : nativeModuleAvailable;

  // Provider selection is strict: selecting mapbox will not render native map canvas.
  const shouldUseNativeMapCanvas =
    mapsEnabled &&
    providerEnabled &&
    provider === MAP_PROVIDER_NATIVE &&
    nativeModuleAvailable &&
    !runtimeFailure;

  const shouldUseMapboxCanvas =
    mapsEnabled &&
    providerEnabled &&
    provider === MAP_PROVIDER_MAPBOX &&
    isMapboxAvailable &&
    !runtimeFailure;

  const canRenderMaps = shouldUseNativeMapCanvas || shouldUseMapboxCanvas;

  const value = useMemo(
    () => ({
      mapsEnabled,
      providerEnabled,
      provider,
      map3dEnabled,
      navigationEnabled,
      nativeModuleAvailable,
      mapboxModuleAvailable: isMapboxModuleAvailable,
      mapboxExpoGoRuntime: isExpoGoRuntime,
      mapboxTokenConfigured: isMapboxTokenConfigured,
      requestedProviderAvailable,
      shouldUseNativeMapCanvas,
      shouldUseMapboxCanvas,
      canRenderMaps,
      runtimeFailure,
      setMapsEnabled: handleSetMapsEnabled,
      setProviderEnabled: handleSetProviderEnabled,
      setProvider: handleSetProvider,
      setMap3dEnabled: handleSetMap3dEnabled,
      setNavigationEnabled: handleSetNavigationEnabled,
      setNativeModuleAvailable: handleSetNativeModuleAvailable,
      reportRuntimeFailure,
    }),
    [
      mapsEnabled,
      providerEnabled,
      provider,
      map3dEnabled,
      navigationEnabled,
      nativeModuleAvailable,
      requestedProviderAvailable,
      shouldUseNativeMapCanvas,
      shouldUseMapboxCanvas,
      canRenderMaps,
      runtimeFailure,
      handleSetMapsEnabled,
      handleSetProviderEnabled,
      handleSetProvider,
      handleSetMap3dEnabled,
      handleSetNavigationEnabled,
      handleSetNativeModuleAvailable,
      reportRuntimeFailure,
    ],
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

export { isNativeMapsAvailable, isMapboxAvailable };
export default noopMapModule;

const NativeMapRefContext = createContext<React.MutableRefObject<any>>({
  current: null,
});
const MapboxCameraRefContext = createContext<React.MutableRefObject<any>>({
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
  constructor(props: {
    onError: (error: Error) => void;
    children: React.ReactNode;
  }) {
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

function mapTypeToMapboxStyle(
  mapType: "satellite" | "standard",
  navigationEnabled = false,
) {
  if (navigationEnabled) {
    return (
      Mapbox?.StyleURL?.NavigationDay ||
      Mapbox?.StyleURL?.TrafficDay ||
      Mapbox?.StyleURL?.Street ||
      "mapbox://styles/mapbox/navigation-day-v1"
    );
  }

  if (mapType === "satellite") {
    return (
      Mapbox?.StyleURL?.SatelliteStreet ||
      Mapbox?.StyleURL?.Satellite ||
      "mapbox://styles/mapbox/satellite-streets-v12"
    );
  }

  return Mapbox?.StyleURL?.Street || "mapbox://styles/mapbox/streets-v12";
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
    const {
      canRenderMaps,
      provider,
      shouldUseNativeMapCanvas,
      shouldUseMapboxCanvas,
      runtimeFailure,
      reportRuntimeFailure,
      map3dEnabled,
      navigationEnabled,
      mapboxExpoGoRuntime,
      mapboxModuleAvailable,
      mapboxTokenConfigured,
    } = useMapProvider();

    const nativeMapRef = useRef<any>(null);
    const mapboxMapRef = useRef<any>(null);
    const mapboxCameraRef = useRef<any>(null);
    const [mapReady, setMapReady] = useState(false);
    const [localFailure, setLocalFailure] = useState<string | null>(null);
    const nativeMapConfigured = isGoogleMapsConfigured();

    const requestedMapType =
      props.mapType === "satellite" ? "satellite" : "standard";
    const safeInitialRegion =
      !initialRegion && allowEmptyInitialRegion
        ? undefined
        : sanitizeMapRegion(initialRegion);

    useEffect(() => {
      if (!canRenderMaps) {
        return;
      }
      setMapReady(false);
      setLocalFailure(null);
    }, [canRenderMaps, provider]);

    useEffect(() => {
      if (!canRenderMaps || mapReady) {
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
    }, [canRenderMaps, mapReady, provider, reportRuntimeFailure]);

    const fallbackReason =
      localFailure ||
      runtimeFailure ||
      (provider === MAP_PROVIDER_MAPBOX && mapboxExpoGoRuntime
        ? "mapbox-expo-go-runtime"
        : null) ||
      (provider === MAP_PROVIDER_MAPBOX && !mapboxTokenConfigured
        ? "mapbox-token-missing"
        : null) ||
      (provider === MAP_PROVIDER_MAPBOX && !mapboxModuleAvailable
        ? "mapbox-native-runtime-unavailable"
        : null) ||
      (provider === MAP_PROVIDER_NATIVE && !isNativeMapsAvailable
        ? "native-module-unavailable"
        : null) ||
      (provider === MAP_PROVIDER_NATIVE && !nativeMapConfigured
        ? "android-provider-not-configured"
        : null) ||
      (!canRenderMaps ? "map-canvas-disabled" : null);

    const showFallback =
      localFailure ||
      !canRenderMaps ||
      (provider === MAP_PROVIDER_NATIVE &&
        (!isNativeMapsAvailable || !nativeMapConfigured)) ||
      (provider === MAP_PROVIDER_MAPBOX && !isMapboxAvailable);

    if (showFallback) {
      return (
        <View style={[styles.fallback, style]}>
          <View style={styles.fallbackContent}>
            <Ionicons name="map-outline" size={44} color="#94A3B8" />
            <Text style={styles.fallbackTitle}>
              Map temporarily unavailable
            </Text>
            <Text style={styles.fallbackText}>
              {fallbackReason === "android-provider-not-configured"
                ? "This Android build does not have a native map provider configured yet. Live trip details still work normally."
                : fallbackReason === "mapbox-expo-go-runtime"
                  ? "Mapbox provider needs a development build or production app binary (Expo Go is not supported)."
                  : fallbackReason === "mapbox-native-runtime-unavailable"
                    ? "Mapbox provider is unavailable in this app runtime. Use a development build or production binary configured for Mapbox."
                    : fallbackReason === "mapbox-token-missing"
                      ? "Mapbox provider is selected, but EXPO_PUBLIC_MAPBOX_TOKEN is missing."
                      : fallbackReason === "map-canvas-disabled"
                        ? "Mobile map canvas is disabled in platform settings. Live trip operations still work normally."
                        : "Live trip details still work normally while map rendering is temporarily unavailable."}
            </Text>
          </View>
        </View>
      );
    }

    const onMapReadyInternal = () => {
      setMapReady(true);
      props.onMapReady?.();
      props.onMapLoaded?.();
    };

    if (shouldUseMapboxCanvas && Mapbox?.MapView) {
      return (
        <MapboxCameraRefContext.Provider value={mapboxCameraRef}>
          <MapRenderBoundary
            onError={(error) => {
              const reason = `map-render-boundary:${error.message}`;
              setLocalFailure(reason);
              reportRuntimeFailure(reason);
            }}
          >
            <Mapbox.MapView
              ref={(instance: any) => {
                mapboxMapRef.current = instance;
                if (typeof ref === "function") ref(instance);
                else if (ref) ref.current = instance;
              }}
              style={[{ flex: 1 }, style]}
              styleURL={mapTypeToMapboxStyle(
                requestedMapType,
                navigationEnabled,
              )}
              compassEnabled={Boolean(props.showsCompass)}
              pitchEnabled
              rotateEnabled
              onDidFinishLoadingMap={onMapReadyInternal}
              onDidFailLoadingMap={(event: any) => {
                const reason = `mapbox-load-failure:${event?.message || "unknown"}`;
                setLocalFailure(reason);
                reportRuntimeFailure(reason);
              }}
            >
              {map3dEnabled && Mapbox?.RasterDemSource && Mapbox?.Terrain ? (
                <Mapbox.RasterDemSource
                  id="uniride-dem-source"
                  url="mapbox://mapbox.mapbox-terrain-dem-v1"
                  tileSize={512}
                  maxZoomLevel={14}
                >
                  <Mapbox.Terrain
                    sourceID="uniride-dem-source"
                    exaggeration={1.3}
                  />
                </Mapbox.RasterDemSource>
              ) : null}
              {children}
            </Mapbox.MapView>
          </MapRenderBoundary>
        </MapboxCameraRefContext.Provider>
      );
    }

    if (!shouldUseNativeMapCanvas) {
      return null;
    }

    return (
      <NativeMapRefContext.Provider value={nativeMapRef}>
        <MapRenderBoundary
          onError={(error) => {
            const reason = `map-render-boundary:${error.message}`;
            setLocalFailure(reason);
            reportRuntimeFailure(reason);
          }}
        >
          <RNMaps.default
            ref={(instance: any) => {
              nativeMapRef.current = instance;
              if (typeof ref === "function") ref(instance);
              else if (ref) ref.current = instance;
            }}
            {...props}
            mapType={requestedMapType}
            style={[{ flex: 1 }, style]}
            provider={
              Platform.OS === "android" ? RNMaps.PROVIDER_GOOGLE : undefined
            }
            initialRegion={safeInitialRegion}
            showsUserLocation={showsUserLocation ?? true}
            followsUserLocation={false}
            showsMyLocationButton={false}
            onMapReady={onMapReadyInternal}
            onMapLoaded={onMapReadyInternal}
          >
            {children}
          </RNMaps.default>
        </MapRenderBoundary>
      </NativeMapRefContext.Provider>
    );
  },
);
MapView.displayName = "MapView";

const NativeCameraBridge = forwardRef((props: any, ref: any) => {
  const mapRef = useContext(NativeMapRefContext);
  const { map3dEnabled, navigationEnabled } = useMapProvider();
  const hasAppliedDefaultSettings = useRef(false);
  const lastModeRef = useRef<{
    map3dEnabled: boolean;
    navigationEnabled: boolean;
  } | null>(null);

  useImperativeHandle(ref, () => ({
    setCamera: ({
      centerCoordinate,
      zoomLevel,
      animationDuration,
      pitch,
      heading,
    }: {
      centerCoordinate?: [number, number];
      zoomLevel?: number;
      animationDuration?: number;
      pitch?: number;
      heading?: number;
    }) => {
      if (!mapRef?.current || !centerCoordinate) return;

      const resolvedZoom =
        typeof zoomLevel === "number"
          ? zoomLevel
          : navigationEnabled
            ? UBER_NAV_ZOOM_LEVEL
            : DEFAULT_MAP_ZOOM;
      const resolvedPitch =
        typeof pitch === "number"
          ? pitch
          : navigationEnabled
            ? UBER_NAV_PITCH
            : map3dEnabled
              ? MAP_3D_PITCH
              : 0;
      const resolvedHeading =
        typeof heading === "number" ? heading : navigationEnabled ? 20 : 0;

      if (typeof mapRef.current?.animateCamera === "function") {
        mapRef.current.animateCamera(
          {
            center: {
              latitude: centerCoordinate[1],
              longitude: centerCoordinate[0],
            },
            zoom: resolvedZoom,
            pitch: resolvedPitch,
            heading: resolvedHeading,
          },
          { duration: animationDuration || 1000 },
        );
        return;
      }

      const delta = zoomToDelta(resolvedZoom);
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

    const resolvedZoom =
      typeof ds.zoomLevel === "number"
        ? ds.zoomLevel
        : navigationEnabled
          ? UBER_NAV_ZOOM_LEVEL
          : DEFAULT_MAP_ZOOM;
    const resolvedPitch =
      typeof ds.pitch === "number"
        ? ds.pitch
        : navigationEnabled
          ? UBER_NAV_PITCH
          : map3dEnabled
            ? MAP_3D_PITCH
            : 0;
    const delta = zoomToDelta(resolvedZoom);

    const timer = setTimeout(() => {
      if (typeof mapRef.current?.animateCamera === "function") {
        mapRef.current.animateCamera(
          {
            center: {
              latitude: ds.centerCoordinate[1],
              longitude: ds.centerCoordinate[0],
            },
            zoom: resolvedZoom,
            pitch: resolvedPitch,
            heading: navigationEnabled ? 20 : 0,
          },
          { duration: 500 },
        );
        return;
      }

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
  }, [map3dEnabled, mapRef, navigationEnabled, props.defaultSettings]);

  useEffect(() => {
    const map = mapRef?.current;
    if (!map || typeof map.animateCamera !== "function") return;

    const previous = lastModeRef.current;
    if (
      previous &&
      previous.map3dEnabled === map3dEnabled &&
      previous.navigationEnabled === navigationEnabled
    ) {
      return;
    }

    lastModeRef.current = { map3dEnabled, navigationEnabled };

    const targetPitch = navigationEnabled
      ? UBER_NAV_PITCH
      : map3dEnabled
        ? MAP_3D_PITCH
        : 0;

    const timer = setTimeout(() => {
      map.animateCamera(
        {
          pitch: targetPitch,
          heading: navigationEnabled ? 20 : 0,
        },
        { duration: 360 },
      );
    }, 80);

    return () => clearTimeout(timer);
  }, [map3dEnabled, mapRef, navigationEnabled]);

  return null;
});
NativeCameraBridge.displayName = "NativeCameraBridge";

const MapboxCameraBridge = forwardRef((props: any, ref: any) => {
  const mapboxCameraRef = useContext(MapboxCameraRefContext);
  const { map3dEnabled, navigationEnabled } = useMapProvider();
  const lastModeRef = useRef<{
    map3dEnabled: boolean;
    navigationEnabled: boolean;
  } | null>(null);

  useImperativeHandle(ref, () => ({
    setCamera: ({
      centerCoordinate,
      zoomLevel,
      animationDuration,
      pitch,
      ...rest
    }: {
      centerCoordinate?: [number, number];
      zoomLevel?: number;
      animationDuration?: number;
      pitch?: number;
      [key: string]: any;
    }) => {
      const camera = mapboxCameraRef?.current;
      if (!camera) return;

      const resolvedZoom =
        typeof zoomLevel === "number"
          ? zoomLevel
          : navigationEnabled
            ? UBER_NAV_ZOOM_LEVEL
            : undefined;

      const resolvedPitch =
        typeof pitch === "number"
          ? pitch
          : navigationEnabled
            ? UBER_NAV_PITCH
            : map3dEnabled
              ? MAP_3D_PITCH
              : undefined;

      if (typeof camera.setCamera === "function") {
        camera.setCamera({
          centerCoordinate,
          zoomLevel: resolvedZoom,
          pitch: resolvedPitch,
          animationDuration,
          ...rest,
        });
        return;
      }

      if (
        Array.isArray(centerCoordinate) &&
        typeof camera.flyTo === "function"
      ) {
        camera.flyTo(centerCoordinate, animationDuration || 1000);
      }

      if (
        typeof resolvedZoom === "number" &&
        typeof camera.zoomTo === "function"
      ) {
        camera.zoomTo(resolvedZoom, animationDuration || 1000);
      }
    },
  }));

  const { defaultSettings, animationDuration, ...rest } = props;
  const followUserMode =
    Mapbox?.UserTrackingMode?.FollowWithCourse ||
    Mapbox?.UserTrackingMode?.FollowWithHeading ||
    "course";
  const defaultPitch = navigationEnabled
    ? UBER_NAV_PITCH
    : map3dEnabled
      ? MAP_3D_PITCH
      : 0;

  const resolvedDefaultSettings = {
    ...(defaultSettings || {}),
    zoomLevel:
      defaultSettings?.zoomLevel ??
      (navigationEnabled ? UBER_NAV_ZOOM_LEVEL : DEFAULT_MAP_ZOOM),
    pitch: Math.max(defaultPitch, Number(defaultSettings?.pitch || 0)),
  };

  useEffect(() => {
    if (!Mapbox?.Camera) return;

    const camera = mapboxCameraRef?.current;
    if (!camera || typeof camera.setCamera !== "function") return;

    const previous = lastModeRef.current;
    if (
      previous &&
      previous.map3dEnabled === map3dEnabled &&
      previous.navigationEnabled === navigationEnabled
    ) {
      return;
    }

    lastModeRef.current = { map3dEnabled, navigationEnabled };

    camera.setCamera({
      pitch: defaultPitch,
      heading: navigationEnabled ? 20 : 0,
      animationDuration: 360,
    });
  }, [defaultPitch, map3dEnabled, mapboxCameraRef, navigationEnabled]);

  if (!Mapbox?.Camera) return null;

  return (
    <Mapbox.Camera
      ref={(instance: any) => {
        mapboxCameraRef.current = instance;
      }}
      defaultSettings={resolvedDefaultSettings}
      animationDuration={animationDuration ?? 1000}
      followUserLocation={navigationEnabled}
      followUserMode={navigationEnabled ? followUserMode : undefined}
      followZoomLevel={navigationEnabled ? UBER_NAV_ZOOM_LEVEL : undefined}
      followPitch={navigationEnabled ? UBER_NAV_PITCH : defaultPitch}
      {...rest}
    />
  );
});
MapboxCameraBridge.displayName = "MapboxCameraBridge";

export const Camera = forwardRef(function CameraComponent(
  props: any,
  ref: any,
) {
  const { shouldUseMapboxCanvas } = useMapProvider();
  if (shouldUseMapboxCanvas) {
    return <MapboxCameraBridge ref={ref} {...props} />;
  }
  return <NativeCameraBridge ref={ref} {...props} />;
});
Camera.displayName = "Camera";

export function LocationPuck(props: any) {
  const { canRenderMaps, shouldUseMapboxCanvas, navigationEnabled } =
    useMapProvider();

  if (!canRenderMaps) return null;

  if (shouldUseMapboxCanvas) {
    if (Mapbox?.LocationPuck) {
      return (
        <Mapbox.LocationPuck
          visible
          puckBearingEnabled={navigationEnabled}
          puckBearing="heading"
          {...props}
        />
      );
    }

    if (Mapbox?.UserLocation) {
      return (
        <Mapbox.UserLocation
          visible
          showsUserHeadingIndicator={navigationEnabled}
          {...props}
        />
      );
    }

    return null;
  }

  return null;
}
LocationPuck.displayName = "LocationPuck";

export function Marker({ coordinate, ...props }: any) {
  const { canRenderMaps, shouldUseMapboxCanvas } = useMapProvider();
  if (!canRenderMaps) return null;

  const safeCoordinate = sanitizeLatLng(coordinate);
  if (!safeCoordinate) return null;

  if (shouldUseMapboxCanvas && Mapbox?.PointAnnotation) {
    const id = String(
      props.id ||
        props.identifier ||
        `marker-${safeCoordinate.latitude}-${safeCoordinate.longitude}`,
    );

    return (
      <Mapbox.PointAnnotation
        id={id}
        coordinate={[safeCoordinate.longitude, safeCoordinate.latitude]}
        onSelected={props.onPress}
      >
        {props.children}
      </Mapbox.PointAnnotation>
    );
  }

  if (!isNativeMapsAvailable) return null;
  return <RNMaps.Marker coordinate={safeCoordinate} {...props} />;
}
Marker.displayName = "SafeMarker";

export function Polyline({ coordinates, ...props }: any) {
  const { canRenderMaps, shouldUseMapboxCanvas } = useMapProvider();
  if (!canRenderMaps) return null;

  const safeCoordinates = Array.isArray(coordinates)
    ? coordinates
        .map((point) => sanitizeLatLng(point))
        .filter(
          (
            point,
          ): point is {
            latitude: number;
            longitude: number;
          } => Boolean(point),
        )
    : sanitizeRouteGeometry(coordinates);

  if (safeCoordinates.length < 2) return null;

  if (shouldUseMapboxCanvas && Mapbox?.ShapeSource && Mapbox?.LineLayer) {
    const lineCoordinates = safeCoordinates.map((point) => [
      point.longitude,
      point.latitude,
    ]);

    const baseId = String(
      props.id || `polyline-${lineCoordinates.length}-${lineCoordinates[0][0]}`,
    ).replace(/[^a-zA-Z0-9_-]/g, "");

    return (
      <Mapbox.ShapeSource
        id={`${baseId}-source`}
        shape={{
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: lineCoordinates,
          },
          properties: {},
        }}
      >
        <Mapbox.LineLayer
          id={`${baseId}-line`}
          style={{
            lineColor: props.strokeColor || "#042F40",
            lineWidth: props.strokeWidth || 4,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      </Mapbox.ShapeSource>
    );
  }

  if (!isNativeMapsAvailable) return null;
  return <RNMaps.Polyline coordinates={safeCoordinates} {...props} />;
}
Polyline.displayName = "SafePolyline";

export const Callout = isNativeMapsAvailable
  ? RNMaps.Callout
  : (_props: any) => null;

export function Circle({ center, ...props }: any) {
  const { canRenderMaps, shouldUseMapboxCanvas } = useMapProvider();
  if (!canRenderMaps) return null;

  const safeCenter = sanitizeLatLng(center);
  if (!safeCenter) return null;

  if (shouldUseMapboxCanvas && Mapbox?.ShapeSource && Mapbox?.CircleLayer) {
    const baseId = String(
      props.id || `circle-${safeCenter.latitude}-${safeCenter.longitude}`,
    ).replace(/[^a-zA-Z0-9_-]/g, "");

    const circleRadius =
      typeof props.radius === "number"
        ? Math.max(4, Math.min(72, props.radius / 25))
        : 12;

    return (
      <Mapbox.ShapeSource
        id={`${baseId}-source`}
        shape={{
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [safeCenter.longitude, safeCenter.latitude],
          },
          properties: {},
        }}
      >
        <Mapbox.CircleLayer
          id={`${baseId}-circle`}
          style={{
            circleColor: props.fillColor || "rgba(4, 47, 64, 0.2)",
            circleRadius,
            circleStrokeColor: props.strokeColor || "#042F40",
            circleStrokeWidth: props.strokeWidth || 1,
          }}
        />
      </Mapbox.ShapeSource>
    );
  }

  if (!isNativeMapsAvailable) return null;
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
    maxWidth: 340,
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
