const fs = require("fs");
const path = require("path");
const appJson = require("./app.json");

function upsertPlugin(plugins, pluginName, options) {
  const index = plugins.findIndex((entry) =>
    Array.isArray(entry) ? entry[0] === pluginName : entry === pluginName,
  );

  if (index === -1) {
    plugins.push(options ? [pluginName, options] : pluginName);
    return;
  }

  const existing = plugins[index];
  if (!Array.isArray(existing)) {
    plugins[index] = options ? [pluginName, options] : pluginName;
    return;
  }

  const existingOptions =
    existing[1] && typeof existing[1] === "object" ? existing[1] : {};

  plugins[index] = [pluginName, { ...existingOptions, ...(options || {}) }];
}

module.exports = () => {
  const expo = appJson.expo;
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "";
  const googleMapsConfigured = Boolean(googleMapsApiKey);

  const mapboxDownloadsToken =
    process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN ||
    process.env.MAPBOX_DOWNLOADS_TOKEN ||
    process.env.RNMAPBOX_DOWNLOADS_TOKEN ||
    "";
  const mapboxPublicToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "";

  const hasDeprecatedMapboxTokenVar = Boolean(
    process.env.MAPBOX_DOWNLOADS_TOKEN || process.env.RNMAPBOX_DOWNLOADS_TOKEN,
  );

  const googleServicesFilePath = (
    process.env.GOOGLE_SERVICES_JSON || "./google-services.json"
  ).trim();
  const hasGoogleServicesFile = fs.existsSync(
    path.resolve(process.cwd(), googleServicesFilePath),
  );

  if (!mapboxDownloadsToken) {
    console.warn(
      "[Config] RNMAPBOX_MAPS_DOWNLOAD_TOKEN is missing. Add it as an EAS secret for native Mapbox Android/iOS builds.",
    );
  }

  if (
    !process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN &&
    hasDeprecatedMapboxTokenVar
  ) {
    console.warn(
      "[Config] Deprecated Mapbox token env var detected. Use RNMAPBOX_MAPS_DOWNLOAD_TOKEN instead of MAPBOX_DOWNLOADS_TOKEN/RNMAPBOX_DOWNLOADS_TOKEN.",
    );
  }

  if (!hasGoogleServicesFile) {
    console.warn(
      `[Config] ${googleServicesFilePath} was not found. Expo push on Android still needs FCM credentials (even without Firebase SDK in app code), so Play Store push delivery may fail.`,
    );
  }

  const plugins = [...(expo.plugins || [])];

  if (googleMapsConfigured) {
    upsertPlugin(plugins, "react-native-maps", {
      androidGoogleMapsApiKey: googleMapsApiKey,
    });
  }

  upsertPlugin(plugins, "expo-notifications", {
    icon: "./assets/images/icon.png",
    color: "#042F40",
    defaultChannel: "default",
  });

  upsertPlugin(plugins, "@rnmapbox/maps");

  if (!plugins.includes("./plugins/withAdiRegistrationToken")) {
    plugins.push("./plugins/withAdiRegistrationToken");
  }

  const androidPermissions = Array.from(
    new Set([
      ...(expo.android?.permissions || []),
      "POST_NOTIFICATIONS",
      "VIBRATE",
      "WAKE_LOCK",
      "RECEIVE_BOOT_COMPLETED",
    ]),
  );

  return {
    expo: {
      ...expo,
      android: {
        ...expo.android,
        permissions: androidPermissions,
        ...(hasGoogleServicesFile
          ? { googleServicesFile: googleServicesFilePath }
          : {}),
        config: googleMapsConfigured
          ? {
              ...(expo.android?.config || {}),
              googleMaps: {
                apiKey: googleMapsApiKey,
              },
            }
          : expo.android?.config,
      },
      plugins,
      extra: {
        ...expo.extra,
        googleMapsConfigured,
        mapboxNativeConfigured: Boolean(mapboxDownloadsToken),
        mapboxPublicTokenConfigured: Boolean(mapboxPublicToken),
        androidPushCredentialsConfigured: hasGoogleServicesFile,
      },
    },
  };
};
