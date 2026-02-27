import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import useTranslatorStore, { LanguageOption } from "@/store/useTranslatorStore";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FLAG_MAP: Record<string, string> = {
  en: "🇬🇧",
  yo: "🇳🇬",
  ha: "🇳🇬",
  ig: "🇳🇬",
  fr: "🇫🇷",
  ar: "🇸🇦",
  zu: "🇿🇦",
  sw: "🇰🇪",
  pt: "🇵🇹",
  es: "🇪🇸",
  de: "🇩🇪",
  zh: "🇨🇳",
};

export default function LanguagePickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const { language, setLanguage, availableLanguages, setAvailableLanguages } =
    useTranslatorStore();
  const { user, isAuthenticated } = useAuthStore();

  const [selected, setSelected] = useState(language);
  const [loading, setLoading] = useState(false);
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
    fetchLanguages();
  }, []);

  const fetchLanguages = async () => {
    setLoading(true);
    try {
      const res = await authApi.getAvailableLanguages();
      if (res.data?.length) {
        setLanguages(res.data);
        setAvailableLanguages(res.data);
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await setLanguage(selected);

      // Sync to backend if logged in
      if (isAuthenticated && user) {
        try {
          await authApi.updateLanguagePreference(selected);
        } catch {
          // Non-critical — local language still applied
        }
      }

      router.back();
    } catch {
      // Fallback
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(300)}
        className="flex-row items-center justify-between px-6 pt-2 pb-4"
      >
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
        >
          <Ionicons name="close" size={22} color="#042F40" />
        </Pressable>
        <Text className="text-primary text-lg font-bold">Language</Text>
        <View className="w-10" />
      </Animated.View>

      {/* Illustration */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(350)}
        className="items-center px-6 mb-6"
      >
        <View className="w-16 h-16 rounded-full bg-primary/5 items-center justify-center mb-3">
          <Ionicons name="globe-outline" size={32} color="#042F40" />
        </View>
        <Text className="text-gray-400 text-sm text-center leading-5 max-w-[260px]">
          Choose your preferred language. All text in the app will be translated
          automatically.
        </Text>
      </Animated.View>

      {/* Language List */}
      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-2.5 pb-4"
      >
        {loading && languages.length <= 4 ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="small" color="#042F40" />
          </View>
        ) : (
          languages.map((lang, index) => {
            const isActive = selected === lang.code;
            return (
              <AnimatedPressable
                key={lang.code}
                entering={FadeInDown.delay(120 + index * 50).duration(350)}
                onPress={() => setSelected(lang.code)}
                className={`rounded-2xl p-4 border-2 flex-row items-center ${
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-gray-100 bg-white"
                }`}
              >
                {/* Flag */}
                <View
                  className={`w-11 h-11 rounded-xl items-center justify-center mr-3.5 ${
                    isActive ? "bg-primary" : "bg-gray-50"
                  }`}
                >
                  <Text className="text-xl">{FLAG_MAP[lang.code] || "🌐"}</Text>
                </View>

                {/* Label */}
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

                {/* Default badge */}
                {lang.is_default && (
                  <View className="bg-green-50 px-2 py-0.5 rounded-full mr-2">
                    <Text className="text-green-600 text-[10px] font-semibold">
                      Default
                    </Text>
                  </View>
                )}

                {/* Radio */}
                <View
                  className={`w-[22px] h-[22px] rounded-full border-2 items-center justify-center ${
                    isActive ? "border-primary bg-primary" : "border-gray-200"
                  }`}
                >
                  {isActive && (
                    <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                  )}
                </View>
              </AnimatedPressable>
            );
          })
        )}
      </ScrollView>

      {/* Confirm Button */}
      <Animated.View
        entering={FadeInDown.delay(400).duration(350)}
        className="px-6 pt-3 pb-4"
      >
        <Pressable
          onPress={handleConfirm}
          disabled={saving}
          className={`rounded-full py-4 items-center shadow-lg ${
            saving ? "bg-primary/60" : "bg-primary active:opacity-90"
          }`}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text className="text-white text-base font-bold">
                {selected === language ? "Done" : "Apply Language"}
              </Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}
