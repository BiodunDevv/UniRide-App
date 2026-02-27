import { SafeAreaView } from "react-native-safe-area-context";
import ComingSoon from "@/components/ui/ComingSoon";
import { useTranslation } from "@/hooks/use-translation";

export default function RidesScreen() {
  const title = useTranslation("Rides");
  const subtitle = useTranslation(
    "Book and manage your campus rides. Request a driver, set your destination, and ride safely.",
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ComingSoon title={title} subtitle={subtitle} />
    </SafeAreaView>
  );
}
