import { SafeAreaView } from "react-native-safe-area-context";
import ComingSoon from "@/components/ui/ComingSoon";
import { useTranslation } from "@/hooks/use-translation";

export default function ActivityScreen() {
  const title = useTranslation("Activity");
  const subtitle = useTranslation(
    "View your ride history, receipts, and trip details. All your past journeys in one place.",
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ComingSoon title={title} subtitle={subtitle} />
    </SafeAreaView>
  );
}
