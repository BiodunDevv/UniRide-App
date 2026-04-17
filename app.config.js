const appJson = require("./app.json");

module.exports = () => {
  const expo = appJson.expo;
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "";
  const googleMapsConfigured = Boolean(googleMapsApiKey);

  const plugins = [...(expo.plugins || [])];

  return {
    expo: {
      ...expo,
      android: {
        ...expo.android,
        config: googleMapsConfigured
          ? {
              ...(expo.android?.config || {}),
              googleMaps: {
                apiKey: googleMapsApiKey,
              },
            }
          : expo.android?.config,
      },
      plugins: googleMapsConfigured
        ? [
            ...plugins,
            [
              "react-native-maps",
              {
                androidGoogleMapsApiKey: googleMapsApiKey,
              },
            ],
          ]
        : plugins,
      extra: {
        ...expo.extra,
        googleMapsConfigured,
      },
    },
  };
};
