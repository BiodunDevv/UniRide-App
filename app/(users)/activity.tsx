import { SafeAreaView } from "react-native-safe-area-context";
import ComingSoon from "@/components/ui/ComingSoon";

export default function ActivityScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ComingSoon
        title="Activity"
        subtitle="View your ride history, receipts, and trip details. All your past journeys in one place."
      />
    </SafeAreaView>
  );
}
