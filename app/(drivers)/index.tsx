import ComingSoon from "@/components/ui/ComingSoon";
import LanguageOnboarding from "@/components/LanguageOnboarding";
import { View } from "react-native";

export default function DriverHomeScreen() {
  return (
    <View className="flex-1">
      <ComingSoon
        title="Driver Dashboard"
        subtitle="Your trip requests and driving stats will appear here"
        icon="speedometer-outline"
      />
      <LanguageOnboarding />
    </View>
  );
}
