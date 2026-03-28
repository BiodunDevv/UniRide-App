import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@/store/useAuthStore";
import type { DashboardRoute } from "@/store/useBootstrapStore";

const TRACE_KEY = "@uniride_bootstrap_trace";
const MAX_TRACE_ENTRIES = 40;

export function getDashboardRoute(user: Pick<User, "role"> | null | undefined) {
  return user?.role === "driver" ? "/(drivers)" : "/(users)";
}

export async function recordBootstrapTrace(stage: string, detail?: string) {
  const entry = `${new Date().toISOString()} ${stage}${detail ? ` :: ${detail}` : ""}`;
  console.log(`[Bootstrap] ${entry}`);

  try {
    const existing = await AsyncStorage.getItem(TRACE_KEY);
    const parsed = existing ? (JSON.parse(existing) as string[]) : [];
    parsed.push(entry);
    const recent = parsed.slice(-MAX_TRACE_ENTRIES);
    await AsyncStorage.setItem(TRACE_KEY, JSON.stringify(recent));
  } catch {
    // Best-effort diagnostics only.
  }
}

export async function clearBootstrapTrace() {
  try {
    await AsyncStorage.removeItem(TRACE_KEY);
  } catch {
    // Best-effort diagnostics only.
  }
}

export async function getBootstrapTrace() {
  try {
    const existing = await AsyncStorage.getItem(TRACE_KEY);
    return existing ? (JSON.parse(existing) as string[]) : [];
  } catch {
    return [];
  }
}

export function isDashboardRoute(route: string | null | undefined): route is DashboardRoute {
  return route === "/(users)" || route === "/(drivers)";
}
