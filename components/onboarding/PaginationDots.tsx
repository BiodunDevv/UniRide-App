import { View, Animated, Dimensions } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PaginationDotsProps {
  /** Total number of dots */
  count: number;
  /** Animated scroll X value from FlatList */
  scrollX: Animated.Value;
  /** Active dot color */
  activeColor?: string;
  /** Inactive dot color */
  inactiveColor?: string;
}

export default function PaginationDots({
  count,
  scrollX,
  activeColor = "#042F40",
  inactiveColor = "#042F40",
}: PaginationDotsProps) {
  return (
    <View className="flex-row justify-center items-center gap-2">
      {Array.from({ length: count }).map((_, index) => {
        const inputRange = [
          (index - 1) * SCREEN_WIDTH,
          index * SCREEN_WIDTH,
          (index + 1) * SCREEN_WIDTH,
        ];

        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 28, 8],
          extrapolate: "clamp",
        });

        const dotOpacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.2, 1, 0.2],
          extrapolate: "clamp",
        });

        return (
          <Animated.View
            key={index}
            style={{
              width: dotWidth,
              opacity: dotOpacity,
              height: 8,
              borderRadius: 4,
              backgroundColor: activeColor,
            }}
          />
        );
      })}
    </View>
  );
}
