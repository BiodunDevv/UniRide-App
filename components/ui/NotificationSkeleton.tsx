import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

function ShimmerBlock({
  width,
  height,
  className = "",
}: {
  width: string | number;
  height: number;
  className?: string;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity, width: width as any, height }}
      className={`bg-gray-200 rounded-lg ${className}`}
    />
  );
}

function SkeletonItem({ delay = 0 }: { delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      delay,
      useNativeDriver: true,
    }).start();
  }, [opacity, delay]);

  return (
    <Animated.View style={{ opacity }} className="flex-row px-6 py-4">
      {/* Icon circle */}
      <ShimmerBlock width={40} height={40} className="rounded-full mr-3" />
      <View className="flex-1">
        {/* Title row */}
        <View className="flex-row items-center justify-between mb-2">
          <ShimmerBlock width="60%" height={14} />
          <ShimmerBlock width={40} height={10} />
        </View>
        {/* Message lines */}
        <ShimmerBlock width="90%" height={10} className="mb-1.5" />
        <ShimmerBlock width="45%" height={10} />
      </View>
    </Animated.View>
  );
}

export default function NotificationSkeleton({
  count = 8,
}: {
  count?: number;
}) {
  return (
    <View className="flex-1">
      {/* Header skeleton */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-3">
        <View>
          <ShimmerBlock width={140} height={22} className="mb-1.5" />
          <ShimmerBlock width={60} height={12} />
        </View>
        <View className="flex-row gap-2">
          <ShimmerBlock width={60} height={28} className="rounded-full" />
          <ShimmerBlock width={80} height={28} className="rounded-full" />
        </View>
      </View>
      {/* Notification items */}
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>
          <SkeletonItem delay={i * 60} />
          {i < count - 1 && <View className="h-px bg-gray-50 mx-6" />}
        </View>
      ))}
    </View>
  );
}
