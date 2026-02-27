import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import useTranslatorStore, { LanguageOption } from "@/store/useTranslatorStore";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

const ONBOARDING_LANGUAGE_KEY = "@uniride_language_onboarded";

const FLAG_MAP: Record<string, string> = {
  en: "🇬🇧",
  yo: "🇳🇬",
  ha: "🇳🇬",
  ig: "🇳🇬",
  fr: "🇫🇷",
  ar: "🇸🇦",
  sw: "🇰🇪",
  pt: "🇵🇹",
};

/**
 * First-time language selection full-screen modal.
 * Shows once per install when user first reaches the dashboard.
 */
export default function LanguageOnboarding() {
  const router = useRouter();
  const {
    language,
    setLanguage,
    availableLanguages,
    setAvailableLanguages,
    initialize,
  } = useTranslatorStore();
  const { isAuthenticated } = useAuthStore();

  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState(language);
  const [saving, setSaving] = useState(false);
  const [languages, setLanguages] = useState<LanguageOption[]>(
    availableLanguages.length > 0
      ? availableLanguages
      : [
          {
            code: "en",
            name: "English",
            native_name: "English",
            is_default: true,
          },
          { code: "yo", name: "Yoruba", native_name: "Yorùbá" },
          { code: "ha", name: "Hausa", native_name: "Hausa" },
          { code: "ig", name: "Igbo", native_name: "Igbo" },
        ],
  );

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    await initialize();
    const done = await AsyncStorage.getItem(ONBOARDING_LANGUAGE_KEY);
    if (done === "true") return;

    // Fetch languages from backend
    try {
      const res = await authApi.getAvailableLanguages();
      if (res.data?.length) {
        setLanguages(res.data);
        setAvailableLanguages(res.data);
      }
    } catch {
      // Use defaults
    }

    setVisible(true);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await setLanguage(selected);
      await AsyncStorage.setItem(ONBOARDING_LANGUAGE_KEY, "true");

      // Sync to backend if logged in
      if (isAuthenticated) {
        try {
          await authApi.updateLanguagePreference(selected);
        } catch {
          // Non-critical
        }
      }
    } finally {
      setSaving(false);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <View className="flex-1 bg-white">
        <View className="flex-1 px-6 pt-16 pb-6">
          {/* Header */}
          <Animated.View
            entering={FadeIn.duration(400)}
            className="items-center mb-8"
          >
            <View className="w-16 h-16 rounded-full bg-primary/5 items-center justify-center mb-4">
              <Ionicons name="globe-outline" size={34} color="#042F40" />
            </View>
            <Text className="text-primary text-2xl font-bold mb-2 text-center">
              Choose Your Language
            </Text>
            <Text className="text-gray-400 text-sm text-center leading-5 max-w-[280px]">
              Select a language for the app. You can change this anytime in your
              profile settings.
            </Text>
          </Animated.View>

          {/* Language Options */}
          <View className="flex-1 gap-2.5">
            {languages.map((lang, index) => {
              const isActive = selected === lang.code;
              return (
                <Animated.View
                  key={lang.code}
                  entering={FadeInDown.delay(100 + index * 60).duration(350)}
                >
                  <Pressable
                    onPress={() => setSelected(lang.code)}
                    className={`rounded-2xl p-4 border-2 flex-row items-center ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-gray-100 bg-white"
                    }`}
                  >
                    <View
                      className={`w-11 h-11 rounded-xl items-center justify-center mr-3.5 ${
                        isActive ? "bg-primary" : "bg-gray-50"
                      }`}
                    >
                      <Text className="text-xl">
                        {FLAG_MAP[lang.code] || "🌐"}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-[15px] font-bold ${isActive ? "text-primary" : "text-gray-800"}`}
                      >
                        {lang.name}
                      </Text>
                      {lang.native_name && lang.native_name !== lang.name && (
                        <Text className="text-gray-400 text-xs mt-0.5">
                          {lang.native_name}
                        </Text>
                      )}
                    </View>
                    <View
                      className={`w-[22px] h-[22px] rounded-full border-2 items-center justify-center ${
                        isActive
                          ? "border-primary bg-primary"
                          : "border-gray-200"
                      }`}
                    >
                      {isActive && (
                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                      )}
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          {/* Confirm */}
          <Animated.View entering={FadeInDown.delay(500).duration(350)}>
            <Pressable
              onPress={handleConfirm}
              disabled={saving}
              className={`rounded-full py-4 items-center shadow-lg mt-4 ${
                saving ? "bg-primary/60" : "bg-primary active:opacity-90"
              }`}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text className="text-white text-base font-bold">
                    Continue
                  </Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}
