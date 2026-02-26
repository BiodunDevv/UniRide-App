import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Logo from "@/components/Logo";

type Role = "user" | "driver";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function RoleSelectScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Role | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    router.push({ pathname: "/auth/login", params: { role: selected } });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <View className="flex-1 px-6">
        {/* Header */}
        <View className="items-center mt-16 mb-12">
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
            Welcome to UniRide
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(220).duration(400)}
            className="text-gray-400 text-[15px] text-center leading-[22px] max-w-[280px]"
          >
            Choose how you'd like to get started.
          </Animated.Text>
        </View>

        {/* Role Cards */}
        <View className="gap-3">
          {/* Rider Card */}
          <AnimatedPressable
            entering={FadeInDown.delay(300).duration(400)}
            onPress={() => setSelected("user")}
            className={`rounded-2xl p-5 border-2 ${
              selected === "user"
                ? "border-primary bg-gray-50"
                : "border-gray-100 bg-white"
            }`}
          >
            <View className="flex-row items-center">
              <View
                className={`w-12 h-12 rounded-xl items-center justify-center mr-4 ${
                  selected === "user" ? "bg-primary" : "bg-gray-50"
                }`}
              >
                <Ionicons
                  name="person"
                  size={22}
                  color={selected === "user" ? "#FFFFFF" : "#9CA3AF"}
                />
              </View>
              <View className="flex-1 mr-2">
                <Text className="text-primary text-[15px] font-bold mb-0.5">
                  I need a ride
                </Text>
                <Text className="text-gray-400 text-xs leading-[18px]">
                  Book campus rides, track drivers live, and travel with
                  confidence.
                </Text>
              </View>
              <View
                className={`w-[22px] h-[22px] rounded-full border-2 items-center justify-center ${
                  selected === "user"
                    ? "border-primary bg-primary"
                    : "border-gray-200"
                }`}
              >
                {selected === "user" && (
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
                  I'm a driver
                </Text>
                <Text className="text-gray-400 text-xs leading-[18px]">
                  Accept ride requests, set your availability, and earn on
                  campus.
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
                  Continue as{" "}
                  {selected === "driver"
                    ? "Driver"
                    : selected === "user"
                      ? "Rider"
                      : "..."}
                </Text>
                {selected && (
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
            <Text className="text-gray-300 text-[11px] text-center leading-4">
              By continuing, you agree to UniRide's{" "}
              <Text
                className="text-gray-400 font-medium underline"
                onPress={() => router.push("/auth/terms")}
              >
                Terms of Service
              </Text>{" "}
              and{" "}
              <Text
                className="text-gray-400 font-medium underline"
                onPress={() => router.push("/auth/privacy")}
              >
                Privacy Policy
              </Text>
            </Text>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}
