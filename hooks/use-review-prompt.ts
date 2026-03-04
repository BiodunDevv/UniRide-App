import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { useAuthStore } from "@/store/useAuthStore";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || "http://localhost:3000";
const REVIEW_PROMPT_KEY = "@uniride_last_review_prompt";
const REVIEW_DISMISSED_KEY = "@uniride_review_dismissed";
const PROMPT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Shows a review prompt alert every 7 days when the user opens the home screen.
 * If the user dismisses 3 times, stop asking permanently.
 */
export function useReviewPrompt(isLoggedIn: boolean) {
  const prompted = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || prompted.current) return;
    prompted.current = true;

    const checkPrompt = async () => {
      try {
        const dismissed = await AsyncStorage.getItem(REVIEW_DISMISSED_KEY);
        if (dismissed && parseInt(dismissed) >= 3) return; // Stop after 3 dismissals

        const lastPrompt = await AsyncStorage.getItem(REVIEW_PROMPT_KEY);
        const now = Date.now();

        if (lastPrompt && now - parseInt(lastPrompt) < PROMPT_INTERVAL_MS) {
          return; // Not time yet
        }

        // Wait a bit before showing (don't show immediately on app launch)
        setTimeout(() => {
          Alert.alert(
            "Enjoying UniRide? ⭐",
            "We'd love to hear your feedback! Leave a quick review to help other students discover UniRide.",
            [
              {
                text: "Not Now",
                style: "cancel",
                onPress: async () => {
                  await AsyncStorage.setItem(REVIEW_PROMPT_KEY, String(now));
                  const prev = await AsyncStorage.getItem(REVIEW_DISMISSED_KEY);
                  const count = prev ? parseInt(prev) + 1 : 1;
                  await AsyncStorage.setItem(
                    REVIEW_DISMISSED_KEY,
                    String(count),
                  );
                },
              },
              {
                text: "Leave a Review",
                onPress: async () => {
                  await AsyncStorage.setItem(REVIEW_PROMPT_KEY, String(now));
                  // Reset dismiss count on engagement
                  await AsyncStorage.setItem(REVIEW_DISMISSED_KEY, "0");
                  const authToken = useAuthStore.getState().token;
                  const reviewUrl = authToken
                    ? `${WEB_URL}/reviews?token=${authToken}`
                    : `${WEB_URL}/reviews`;
                  WebBrowser.openBrowserAsync(reviewUrl, {
                    presentationStyle:
                      WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                    controlsColor: "#042F40",
                    toolbarColor: "#FFFFFF",
                  });
                },
              },
            ],
          );
        }, 3000); // 3 second delay
      } catch {
        // Silently fail
      }
    };

    checkPrompt();
  }, [isLoggedIn]);
}
