import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Logo from "@/components/Logo";
import { useAuthStore } from "@/store/useAuthStore";

export default function SplashScreen() {
  const router = useRouter();
  const { hydrate } = useAuthStore();

  const fadeIn = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(12)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  const [navTarget, setNavTarget] = useState<string | null>(null);

  useEffect(() => {
    if (navTarget) {
      router.replace(navTarget as any);
    }
  }, [navTarget]);

  useEffect(() => {
    const hydratePromise = hydrate().catch(() => {});

    // Quick, elegant entrance animation (~1s total)
    Animated.parallel([
      // Fade everything in
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Scale logo from 0.8 → 1
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Show text and progress bar
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(progressWidth, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start(async () => {
        try {
          await hydratePromise;
          const { user, token, isAuthenticated } = useAuthStore.getState();

          if (token && user && isAuthenticated) {
            setNavTarget("/lock");
            return;
          }

          // No valid session — check onboarding
          const hasSeen = await AsyncStorage.getItem(
            "@uniride_has_seen_onboarding",
          );
          if (hasSeen === "true") {
            setNavTarget("/auth/role-select");
          } else {
            setNavTarget("/welcome");
          }
        } catch {
          // Hydration or any error → go to auth
          setNavTarget("/auth/role-select");
        }
      });
    });
  }, []);

  return (
    <LinearGradient
      colors={["#042F40", "#0A4A63", "#042F40"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.container, { opacity: fadeIn }]}>
          {/* Logo */}
          <Animated.View
            style={{
              transform: [{ scale: logoScale }],
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <Logo width={100} height={61} color="#F0F1F3" />
          </Animated.View>

          {/* Brand + Tagline */}
          <Animated.View
            style={{
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
              alignItems: "center",
            }}
          >
            <Text style={styles.brandText}>UNIRIDE</Text>
            <View style={styles.divider} />
            <Text style={styles.tagline}>Campus Rides Made Safe</Text>
          </Animated.View>

          {/* Progress bar */}
          <Animated.View
            style={[styles.progressTrack, { opacity: contentOpacity }]}
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </Animated.View>
        </Animated.View>

        {/* Bottom watermark */}
        <Animated.View style={[styles.watermark, { opacity: contentOpacity }]}>
          <Text style={styles.watermarkText}>Secure · Verified · Reliable</Text>
        </Animated.View>
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
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  brandText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 6,
    marginBottom: 12,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: "#D4A017",
    borderRadius: 1,
    marginBottom: 12,
  },
  tagline: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  progressTrack: {
    position: "absolute",
    bottom: 80,
    width: 120,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#D4A017",
    borderRadius: 2,
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
