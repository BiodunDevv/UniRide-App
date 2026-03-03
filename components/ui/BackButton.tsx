import React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

interface BackButtonProps {
  /** Optional custom onPress handler */
  onPress?: () => void;
  /** Icon color */
  color?: string;
  /** Background style variant */
  variant?: "light" | "solid" | "transparent";
  /** Size of the button */
  size?: "sm" | "md";
}

export default function BackButton({
  onPress,
  color = "#042F40",
  variant = "light",
  size = "md",
}: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  const sizeClass = size === "sm" ? "w-9 h-9" : "w-10 h-10";
  const iconSize = size === "sm" ? 18 : 20;

  const bgClass =
    variant === "solid"
      ? "bg-primary"
      : variant === "transparent"
        ? "bg-transparent"
        : "bg-gray-50";

  const iconColor = variant === "solid" ? "#fff" : color;

  return (
    <Pressable
      onPress={handlePress}
      className={`${sizeClass} rounded-full ${bgClass} items-center justify-center active:opacity-70`}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="arrow-back" size={iconSize} color={iconColor} />
    </Pressable>
  );
}
