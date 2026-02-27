import { SafeAreaView } from "react-native-safe-area-context";
import ComingSoon from "@/components/ui/ComingSoon";
import { useTranslations } from "@/hooks/use-translation";

export default function ActivityScreen() {
  const [tTitle, tSubtitle] = useTranslations([
    "Activity",
    "View your ride history, receipts, and trip details. All your past journeys in one place.",
  ]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ComingSoon title={tTitle} subtitle={tSubtitle} />
    </SafeAreaView>
  );
}
