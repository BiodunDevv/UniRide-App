import { SafeAreaView } from "react-native-safe-area-context";
import ComingSoon from "@/components/ui/ComingSoon";

export default function RidesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ComingSoon
        title="Rides"
        subtitle="Book and manage your campus rides. Request a driver, set your destination, and ride safely."
      />
    </SafeAreaView>
  );
}
