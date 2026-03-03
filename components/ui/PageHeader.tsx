import React from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BackButton from "./BackButton";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Optional right-side content */
  rightContent?: React.ReactNode;
  /** Whether to include safe area top padding */
  useSafeArea?: boolean;
  /** Back button variant */
  backVariant?: "light" | "solid" | "transparent";
  /** Custom back handler */
  onBack?: () => void;
}

export default function PageHeader({
  title,
  subtitle,
  rightContent,
  useSafeArea = true,
  backVariant = "light",
  onBack,
}: PageHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-white border-b border-gray-100 px-5 pb-4"
      style={useSafeArea ? { paddingTop: insets.top + 8 } : { paddingTop: 16 }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <BackButton variant={backVariant} onPress={onBack} />
          <View className="ml-3 flex-1">
            <Text
              className="text-xl font-bold"
              style={{ color: "#042F40" }}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {rightContent ? <View className="ml-3">{rightContent}</View> : null}
      </View>
    </View>
  );
}
