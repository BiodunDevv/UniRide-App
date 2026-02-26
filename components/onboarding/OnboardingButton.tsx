import { Pressable, Text } from "react-native";

interface OnboardingButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  className?: string;
}

export default function OnboardingButton({
  label,
  onPress,
  variant = "primary",
  className = "",
}: OnboardingButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full py-4 items-center justify-center active:opacity-80 ${
        isPrimary ? "bg-primary shadow-lg" : "bg-gray-200"
      } ${className}`}
    >
      <Text
        className={`text-base font-bold ${
          isPrimary ? "text-white" : "text-primary"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
