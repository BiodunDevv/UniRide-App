import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import Logo from "@/components/Logo";
import { useTranslation } from "@/hooks/use-translation";
import useTranslatorStore from "@/store/useTranslatorStore";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || "http://localhost:3000";

export default function RoleSelectScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<"rider" | "driver" | null>(null);
  const { language, initialize } = useTranslatorStore();

  // Initialize translator store on first mount
  useEffect(() => {
    initialize();
  }, []);

  // ─── Translated strings ─────────────────────────────────────────────
  const welcomeText = useTranslation("Welcome to UniRide");
  const subtitleText = useTranslation("Choose how you'd like to get started.");
  const needRideText = useTranslation("I need a ride");
  const riderDescText = useTranslation(
    "Book campus rides, track drivers live, and travel with confidence.",
  );
  const driverText = useTranslation("I'm a driver");
  const driverDescText = useTranslation(
    "Sign in to your driver account or apply to join our team.",
  );
  const applyDriverText = useTranslation("Apply as a new driver");
  const checkStatusText = useTranslation("Check application status");
  const signInAsDriverText = useTranslation("Sign In as Driver");
  const signInAsRiderText = useTranslation("Sign In as Rider");
  const continueAsText = useTranslation("Continue as...");
  const newHereText = useTranslation("New here?");
  const createAccountText = useTranslation("Create an account");
  const termsIntroText = useTranslation(
    "By continuing, you agree to UniRide's",
  );
  const termsText = useTranslation("Terms of Service");
  const privacyText = useTranslation("Privacy Policy");
  const andText = useTranslation("and");
  const helpText = useTranslation("Need help? Contact support");

  const LANG_LABEL: Record<string, string> = {
    en: "EN",
    yo: "YO",
    ha: "HA",
    ig: "IG",
    fr: "FR",
    ar: "AR",
  };

  const openWeb = async (path: string) => {
    await WebBrowser.openBrowserAsync(`${WEB_URL}${path}`, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      controlsColor: "#042F40",
      toolbarColor: "#FFFFFF",
    });
  };

  const handleContinue = () => {
    if (!selected) return;
    router.push({
      pathname: "/auth/login",
      params: { role: selected === "rider" ? "user" : "driver" },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <View className="flex-1 px-6">
        {/* Language Button — top right */}
        <Animated.View
          entering={FadeIn.delay(60).duration(300)}
          className="flex-row justify-between items-center mt-2"
        >
          {/* Help & Support */}
          <Pressable
            onPress={() =>
              WebBrowser.openBrowserAsync(`${WEB_URL}/support`, {
                presentationStyle:
                  WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                controlsColor: "#042F40",
                toolbarColor: "#FFFFFF",
              })
            }
            className="flex-row items-center px-3 py-2 rounded-full bg-gray-50 active:opacity-70"
          >
            <Ionicons name="help-circle-outline" size={16} color="#6B7280" />
            <Text className="text-gray-500 text-[11px] font-medium ml-1">
              {helpText}
            </Text>
          </Pressable>

          {/* Language Picker */}
          <Pressable
            onPress={() => router.push("/language-picker")}
            className="flex-row items-center px-3 py-2 rounded-full bg-primary/5 border border-primary/10 active:opacity-70"
          >
            <Ionicons name="globe-outline" size={16} color="#042F40" />
            <Text className="text-primary text-xs font-bold ml-1.5">
              {LANG_LABEL[language] || language.toUpperCase()}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color="#042F40"
              style={{ marginLeft: 2 }}
            />
          </Pressable>
        </Animated.View>

        {/* Header */}
        <View className="items-center mt-10 mb-12">
          <Animated.View
            entering={FadeIn.delay(80).duration(400)}
            className="w-14 h-14 rounded-2xl bg-primary items-center justify-center mb-6"
          >
            <Logo width={28} height={17} color="#FFFFFF" />
          </Animated.View>
          <Animated.Text
            entering={FadeInDown.delay(150).duration(400)}
            className="text-primary text-[26px] font-bold mb-2 tracking-tight"
          >
            {welcomeText}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(220).duration(400)}
            className="text-gray-400 text-[15px] text-center leading-[22px] max-w-[280px]"
          >
            {subtitleText}
          </Animated.Text>
        </View>

        {/* Role Cards */}
        <View className="gap-3">
          {/* Rider Card */}
          <AnimatedPressable
            entering={FadeInDown.delay(300).duration(400)}
            onPress={() => setSelected("rider")}
            className={`rounded-2xl p-5 border-2 ${
              selected === "rider"
                ? "border-primary bg-gray-50"
                : "border-gray-100 bg-white"
            }`}
          >
            <View className="flex-row items-center">
              <View
                className={`w-12 h-12 rounded-xl items-center justify-center mr-4 ${
                  selected === "rider" ? "bg-primary" : "bg-gray-50"
                }`}
              >
                <Ionicons
                  name="person"
                  size={22}
                  color={selected === "rider" ? "#FFFFFF" : "#9CA3AF"}
                />
              </View>
              <View className="flex-1 mr-2">
                <Text className="text-primary text-[15px] font-bold mb-0.5">
                  {needRideText}
                </Text>
                <Text className="text-gray-400 text-xs leading-[18px]">
                  {riderDescText}
                </Text>
              </View>
              <View
                className={`w-[22px] h-[22px] rounded-full border-2 items-center justify-center ${
                  selected === "rider"
                    ? "border-primary bg-primary"
                    : "border-gray-200"
                }`}
              >
                {selected === "rider" && (
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                )}
              </View>
            </View>
          </AnimatedPressable>

          {/* Driver Card */}
          <AnimatedPressable
            entering={FadeInDown.delay(380).duration(400)}
            onPress={() => setSelected("driver")}
            className={`rounded-2xl p-5 border-2 ${
              selected === "driver"
                ? "border-accent bg-gray-50"
                : "border-gray-100 bg-white"
            }`}
          >
            <View className="flex-row items-center">
              <View
                className={`w-12 h-12 rounded-xl items-center justify-center mr-4 ${
                  selected === "driver" ? "bg-accent" : "bg-gray-50"
                }`}
              >
                <Ionicons
                  name="car-sport-outline"
                  size={22}
                  color={selected === "driver" ? "#FFFFFF" : "#9CA3AF"}
                />
              </View>
              <View className="flex-1 mr-2">
                <Text className="text-primary text-[15px] font-bold mb-0.5">
                  {driverText}
                </Text>
                <Text className="text-gray-400 text-xs leading-[18px]">
                  {driverDescText}
                </Text>
              </View>
              <View
                className={`w-[22px] h-[22px] rounded-full border-2 items-center justify-center ${
                  selected === "driver"
                    ? "border-accent bg-accent"
                    : "border-gray-200"
                }`}
              >
                {selected === "driver" && (
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                )}
              </View>
            </View>
          </AnimatedPressable>
        </View>

        {/* Driver Quick Actions — visible when driver is selected */}
        {selected === "driver" && (
          <Animated.View
            entering={FadeInDown.delay(100).duration(300)}
            className="mt-4 gap-2.5"
          >
            <Pressable
              onPress={() => openWeb("/driver-apply")}
              className="flex-row items-center bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 active:opacity-70"
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color="#D4A017"
              />
              <Text className="text-primary text-[13px] font-semibold ml-3 flex-1">
                {applyDriverText}
              </Text>
              <Ionicons name="open-outline" size={14} color="#9CA3AF" />
            </Pressable>
            <Pressable
              onPress={() => openWeb("/driver-apply/check-status")}
              className="flex-row items-center bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 active:opacity-70"
            >
              <Ionicons name="search-outline" size={18} color="#6B7280" />
              <Text className="text-primary text-[13px] font-semibold ml-3 flex-1">
                {checkStatusText}
              </Text>
              <Ionicons name="open-outline" size={14} color="#9CA3AF" />
            </Pressable>
          </Animated.View>
        )}

        {/* Continue Button + footer */}
        <View className="flex-1 justify-end pb-6">
          <Animated.View entering={FadeInUp.delay(450).duration(400)}>
            <Pressable
              onPress={handleContinue}
              disabled={!selected}
              className={`rounded-full py-4 items-center shadow-lg mb-5 ${
                selected ? "bg-primary active:opacity-90" : "bg-gray-200"
              }`}
            >
              <View className="flex-row items-center gap-2">
                <Text
                  className={`text-base font-bold ${
                    selected ? "text-white" : "text-gray-400"
                  }`}
                >
                  {selected
                    ? selected === "driver"
                      ? signInAsDriverText
                      : signInAsRiderText
                    : continueAsText}
                </Text>
                {selected && (
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                )}
              </View>
            </Pressable>

            {/* Register link for riders */}
            {selected === "rider" && (
              <Text className="text-gray-400 text-[12px] text-center mb-4">
                {newHereText}{" "}
                <Text
                  className="text-primary font-bold"
                  onPress={() =>
                    router.push({
                      pathname: "/auth/register",
                      params: { role: "user" },
                    })
                  }
                >
                  {createAccountText}
                </Text>
              </Text>
            )}

            <Text className="text-gray-300 text-[11px] text-center leading-4">
              {termsIntroText}{" "}
              <Text
                className="text-gray-400 font-medium underline"
                onPress={() => router.push("/auth/terms")}
              >
                {termsText}
              </Text>{" "}
              {andText}{" "}
              <Text
                className="text-gray-400 font-medium underline"
                onPress={() => router.push("/auth/privacy")}
              >
                {privacyText}
              </Text>
            </Text>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}
