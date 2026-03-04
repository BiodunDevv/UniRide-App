/**
 * useInAppNotifications
 * ─────────────────────
 * Starts / stops the backend notification poller whenever the user is
 * authenticated and loads the persisted "seen" IDs so already-shown toasts
 * don't re-appear after an app restart.
 *
 * Returns `routeBase` — the tab group prefix used by the toast for navigation.
 */
import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useNotificationStore } from "@/store/useNotificationStore";

const POLL_INTERVAL_MS = 15_000; // every 15 s

export function useInAppNotifications() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { startPolling, stopPolling, loadSeenIds } =
    useNotificationStore.getState();

  useEffect(() => {
    if (!token) {
      stopPolling();
      return;
    }

    // Load persisted seen IDs first so we don't re-show old notifications,
    // then kick off the poller.
    loadSeenIds().then(() => {
      startPolling(POLL_INTERVAL_MS);
    });

    return () => {
      stopPolling();
    };
  }, [token]);

  // Determine which tab group this user belongs to
  const routeBase: "(users)" | "(drivers)" =
    user?.role === "driver" ? "(drivers)" : "(users)";

  return { routeBase };
}
