import { SafeAreaView } from "react-native-safe-area-context";
import ComingSoon from "@/components/ui/ComingSoon";
import { useTranslations } from "@/hooks/use-translation";

export default function RidesScreen() {
  const [tTitle, tSubtitle] = useTranslations([
    "Rides",
    "Book and manage your campus rides. Request a driver, set your destination, and ride safely.",
  ]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ComingSoon title={tTitle} subtitle={tSubtitle} />
    </SafeAreaView>
  );
}
