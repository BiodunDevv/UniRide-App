const {
  withAndroidManifest,
  createRunOncePlugin,
} = require("@expo/config-plugins");

const PLUGIN_NAME = "withAdiRegistrationToken";
const META_NAME = "ADI_REGISTRATION_TOKEN";

function withAdiRegistrationToken(config) {
  const token =
    process.env.ADI_REGISTRATION_TOKEN ||
    process.env.EXPO_PUBLIC_ADI_REGISTRATION_TOKEN ||
    "";

  if (!token) {
    return config;
  }

  return withAndroidManifest(config, (configMod) => {
    const application = configMod.modResults?.manifest?.application?.[0];
    if (!application) {
      return configMod;
    }

    if (!Array.isArray(application["meta-data"])) {
      application["meta-data"] = [];
    }

    const existing = application["meta-data"].find(
      (item) => item?.$?.["android:name"] === META_NAME,
    );

    if (existing?.$) {
      existing.$["android:value"] = token;
    } else {
      application["meta-data"].push({
        $: {
          "android:name": META_NAME,
          "android:value": token,
        },
      });
    }

    return configMod;
  });
}

module.exports = createRunOncePlugin(withAdiRegistrationToken, PLUGIN_NAME, "1.0.0");
