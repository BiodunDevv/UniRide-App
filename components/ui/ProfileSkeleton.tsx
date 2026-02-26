import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

function Shimmer({
  w,
  h,
  rounded = "rounded-lg",
  className = "",
}: {
  w: string | number;
  h: number;
  rounded?: string;
  className?: string;
}) {
  const opacity = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity, width: w as any, height: h }}
      className={`bg-gray-200 ${rounded} ${className}`}
    />
  );
}

function FadeInRow({
  delay,
  children,
}: {
  delay: number;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 350,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

export default function ProfileSkeleton({
  isDriver = false,
}: {
  isDriver?: boolean;
}) {
  return (
    <View className="flex-1 bg-white">
      {/* Avatar / Header */}
      <FadeInRow delay={0}>
        <View className="items-center pt-6 pb-5 px-6">
          <Shimmer w={80} h={80} rounded="rounded-full" className="mb-4" />
          <Shimmer w={140} h={18} className="mb-2" />
          <Shimmer w={180} h={12} className="mb-3" />
          <View className="flex-row gap-2">
            <Shimmer w={70} h={24} rounded="rounded-full" />
            <Shimmer w={70} h={24} rounded="rounded-full" />
          </View>
        </View>
      </FadeInRow>

      {/* Toggle (driver only) */}
      {isDriver && (
        <FadeInRow delay={80}>
          <View className="mx-4 mb-6">
            <Shimmer w="100%" h={64} rounded="rounded-2xl" />
          </View>
        </FadeInRow>
      )}

      {/* Vehicle card (driver only) */}
      {isDriver && (
        <FadeInRow delay={120}>
          <View className="mx-4 mb-6">
            <Shimmer w="100%" h={130} rounded="rounded-2xl" />
          </View>
        </FadeInRow>
      )}

      {/* Section rows */}
      {[0, 1, 2].map((i) => (
        <FadeInRow key={i} delay={160 + i * 60}>
          <View className="mb-6">
            <View className="px-6 pb-2">
              <Shimmer w={80} h={10} />
            </View>
            <View className="mx-4 rounded-2xl border border-gray-100 overflow-hidden">
              {[0, 1].map((j) => (
                <View key={j}>
                  {j > 0 && <View className="h-px bg-gray-100 mx-4" />}
                  <View className="flex-row items-center px-4 py-3.5">
                    <Shimmer
                      w={36}
                      h={36}
                      rounded="rounded-full"
                      className="mr-3"
                    />
                    <View className="flex-1">
                      <Shimmer w="55%" h={13} className="mb-1.5" />
                      <Shimmer w="80%" h={10} />
                    </View>
                    <Shimmer w={18} h={18} rounded="rounded-md" />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </FadeInRow>
      ))}

      {/* Sign out skeleton */}
      <FadeInRow delay={400}>
        <View className="mx-4 mb-4">
          <View className="rounded-2xl border border-gray-100">
            <View className="flex-row items-center px-4 py-3.5">
              <Shimmer w={36} h={36} rounded="rounded-full" className="mr-3" />
              <Shimmer w={80} h={14} />
            </View>
          </View>
        </View>
      </FadeInRow>
    </View>
  );
}
