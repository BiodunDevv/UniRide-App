import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Logo from "@/components/Logo";
import { FadeIn } from "@/components/ui/animations";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export interface ComingSoonProps {
  /** Page title shown above the coming soon badge */
  title?: string;
  /** Subtitle / description shown below the heading */
  subtitle?: string;
  /** Optional Ionicons icon name to show instead of the logo */
  icon?: IoniconsName;
}

export default function ComingSoon({
  title = "Coming Soon",
  subtitle = "We're building something great. This feature will be available in a future update.",
  icon,
}: ComingSoonProps) {
  return (
    <View className="flex-1 bg-white items-center justify-center px-8">
      {/* Logo mark or custom icon */}
      <FadeIn delay={0} duration={400}>
        <View className="mb-6 items-center">
          <View className="w-20 h-20 rounded-full bg-primary/5 items-center justify-center">
            {icon ? (
              <Ionicons name={icon} size={36} color="#042F40" />
            ) : (
              <Logo width={40} height={24} color="#042F40" />
            )}
          </View>
        </View>
      </FadeIn>

      {/* Badge */}
      <FadeIn delay={100} duration={400}>
        <View className="bg-accent/10 px-4 py-1.5 rounded-full mb-5">
          <Text className="text-accent text-xs font-semibold tracking-widest uppercase">
            Under Development
          </Text>
        </View>
      </FadeIn>

      {/* Heading */}
      <FadeIn delay={200} duration={400}>
        <Text className="text-primary text-2xl font-bold text-center mb-3">
          {title}
        </Text>
      </FadeIn>

      {/* Description */}
      <FadeIn delay={300} duration={400}>
        <Text className="text-gray-400 text-sm text-center leading-6 max-w-[280px]">
          {subtitle}
        </Text>
      </FadeIn>

      {/* Decorative divider */}
      <FadeIn delay={400} duration={400}>
        <View className="w-12 h-0.5 bg-primary/10 rounded-full mt-8" />
      </FadeIn>
    </View>
  );
}
