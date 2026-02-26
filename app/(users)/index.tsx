import { SafeAreaView } from "react-native-safe-area-context";
import ComingSoon from "@/components/ui/ComingSoon";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ComingSoon
        title="Home"
        subtitle="Your campus ride-hailing dashboard is on its way. Book rides, track in real-time, and travel safely."
      />
    </SafeAreaView>
  );
}
