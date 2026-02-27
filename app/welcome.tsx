import { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  Text,
  View,
  ViewToken,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Logo from "@/components/Logo";
import { T } from "@/hooks/use-translation";

const { width } = Dimensions.get("window");
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── Onboarding Data (source-of-truth English) ───────────────────────────────
const onboardingData = [
  {
    id: "1",
    title: "Safe Campus Rides",
    description:
      "Every driver is verified and approved through UniRide. Travel across campus with complete peace of mind.",
  },
  {
    id: "2",
    title: "Real-Time Tracking",
    description:
      "Follow your ride live on the map. Share your trip details with friends and family for instant peace of mind.",
  },
  {
    id: "3",
    title: "Seamless Booking",
    description:
      "Book a ride in seconds with just a few taps. Smart routing finds the fastest path to get you there.",
  },
  {
    id: "4",
    title: "Trusted Community",
    description:
      "Join thousands of students riding together. Rate, review, and build campus trust with every trip.",
  },
];

// ─── Slide ────────────────────────────────────────────────────────────────────
function OnboardingSlide({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={{ width }} className="px-8">
      <Text className="text-primary text-2xl font-bold text-center mb-4 leading-tight">
        <T>{title}</T>
      </Text>
      <Text className="text-gray-500 text-sm text-center leading-6">
        <T>{description}</T>
      </Text>
    </View>
  );
}

// ─── Welcome Screen ───────────────────────────────────────────────────────────
export default function WelcomeScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleNext = async () => {
    if (currentIndex < onboardingData.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      await completeOnboarding();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex - 1,
        animated: true,
      });
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem("@uniride_has_seen_onboarding", "true");
    } catch (error) {
      console.error("Error saving onboarding status:", error);
    }
    router.replace("/auth/role-select");
  };

  const isLast = currentIndex === onboardingData.length - 1;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <SafeAreaView className="flex-1 bg-primary" edges={["top"]}>
        <View className="flex-1">
          {/* ── Top Bar ────────────────────────────────────────────── */}
          <Animated.View
            entering={FadeIn.delay(300).duration(500)}
            className="flex-row justify-end items-center px-6 pt-4 pb-2"
          >
            <Pressable onPress={completeOnboarding} className="py-2 px-4">
              <Text className="text-white text-base font-medium">
                <T>Skip</T>
              </Text>
            </Pressable>
          </Animated.View>

          {/* ── Dark Section with Logo ─────────────────────────────── */}
          <View className="flex-1 items-center justify-center px-6">
            <Animated.View
              entering={FadeIn.delay(100).duration(500)}
              className="items-center"
            >
              <View className="w-72 h-72 items-center justify-center mb-8">
                <Logo width={200} height={122} color="#F0F1F3" />
              </View>
            </Animated.View>
          </View>

          {/* ── UNIRIDE Pill (overlaps white card) ─────────────────── */}
          <Animated.View
            entering={FadeIn.delay(350).duration(400)}
            className="items-center"
            style={{ marginBottom: -18, zIndex: 10 }}
          >
            <View className="bg-primary px-8 py-2 rounded-full shadow-lg">
              <Text className="text-white text-xl font-bold tracking-widest">
                UNIRIDE
              </Text>
            </View>
          </Animated.View>

          {/* ── White Bottom Card ───────────────────────────────────── */}
          <Animated.View
            entering={SlideInDown.delay(250).duration(500)}
            className="bg-white rounded-t-[40px] pt-10"
          >
            {/* Carousel */}
            <View style={{ height: 120 }}>
              <FlatList
                ref={flatListRef}
                data={onboardingData}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <OnboardingSlide
                    title={item.title}
                    description={item.description}
                  />
                )}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                scrollEventThrottle={16}
                bounces={false}
              />
            </View>

            {/* Pagination Dots */}
            <View className="flex-row justify-center mb-8 px-8">
              {onboardingData.map((_, index) => (
                <View
                  key={index}
                  className={`h-2 rounded-full mx-1 ${
                    index === currentIndex
                      ? "w-8 bg-primary"
                      : "w-2 bg-gray-300"
                  }`}
                />
              ))}
            </View>

            {/* Navigation Buttons */}
            <View className="px-8">
              {currentIndex > 0 ? (
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={handleBack}
                    className="flex-1 bg-gray-200 rounded-full py-4 items-center active:opacity-80"
                  >
                    <Text className="text-primary text-base font-bold">
                      <T>Back</T>
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleNext}
                    className="flex-1 bg-primary rounded-full py-4 items-center active:opacity-90 shadow-lg"
                  >
                    <Text className="text-white text-base font-bold">
                      {isLast ? <T>Get Started</T> : <T>Next</T>}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={handleNext}
                  className="bg-primary rounded-full py-4 items-center active:opacity-90 shadow-lg"
                >
                  <Text className="text-white text-base font-bold">
                    <T>Next</T>
                  </Text>
                </Pressable>
              )}
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}
