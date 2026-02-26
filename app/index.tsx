import { useEffect, useRef } from "react";
import { Animated, Easing, View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Logo from "@/components/Logo";
import LoadingDots from "@/components/ui/LoadingDots";
import { useAuthStore } from "@/store/useAuthStore";

export default function SplashScreen() {
  const router = useRouter();
  const { hydrate } = useAuthStore();

  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(15)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start hydrating user data in parallel with animations
    const hydratePromise = hydrate().catch(() => {});

    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(lineWidth, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(taglineTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(dotsOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(600),
    ]).start(async () => {
      try {
        // Wait for hydrate to finish (likely already done by now)
        await hydratePromise;

        // Read the hydrated state
        const { user, token } = useAuthStore.getState();

        if (token && user) {
          // Hydrate succeeded — user data is ready, go to lock screen
          router.replace("/lock");
          return;
        }

        // No valid session → check onboarding
        const hasSeen = await AsyncStorage.getItem(
          "@uniride_has_seen_onboarding",
        );
        if (hasSeen === "true") {
          router.replace("/auth/role-select");
        } else {
          router.replace("/welcome");
        }
      } catch {
        router.replace("/welcome");
      }
    });
  }, []);

  return (
    <LinearGradient
      colors={["#042F40", "#063d54", "#042F40"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View className="flex-1 items-center justify-center px-8">
          {/* Decorative circles */}
          <View style={[styles.circle, styles.circleTopRight]} />
          <View style={[styles.circle, styles.circleBottomLeft]} />

          {/* Logo */}
          <Animated.View
            style={{
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 32,
            }}
          >
            <Logo width={120} height={73} color="#F0F1F3" />
          </Animated.View>

          {/* Brand Name */}
          <Animated.View
            style={{
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <Text style={styles.brandText}>UNIRIDE</Text>
          </Animated.View>

          {/* Gold Divider */}
          <Animated.View
            style={{
              width: lineWidth.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 48],
              }),
              height: 2,
              backgroundColor: "#D4A017",
              borderRadius: 1,
              marginBottom: 16,
            }}
          />

          {/* Tagline */}
          <Animated.View
            style={{
              opacity: taglineOpacity,
              transform: [{ translateY: taglineTranslateY }],
              alignItems: "center",
            }}
          >
            <Text style={styles.tagline}>Campus Rides Made Safe</Text>
          </Animated.View>

          {/* Loading dots */}
          <Animated.View
            style={{
              opacity: dotsOpacity,
              position: "absolute",
              bottom: 64,
            }}
          >
            <LoadingDots color="bg-accent" size={6} />
          </Animated.View>
        </View>

        {/* Bottom watermark */}
        <View style={styles.watermark}>
          <Text style={styles.watermarkText}>Secure · Verified · Reliable</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  circle: {
    position: "absolute",
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  circleTopRight: {
    width: 260,
    height: 260,
    top: -80,
    right: -80,
  },
  circleBottomLeft: {
    width: 320,
    height: 320,
    bottom: -120,
    left: -100,
  },
  brandText: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: 6,
  },
  tagline: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  watermark: {
    alignItems: "center",
    paddingBottom: 16,
  },
  watermarkText: {
    color: "rgba(255,255,255,0.15)",
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
