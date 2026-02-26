import { useEffect, useRef } from "react";
import { Animated, View, type ViewStyle } from "react-native";

interface LoadingDotsProps {
  /** Number of dots */
  count?: number;
  /** Dot color (Tailwind bg class, e.g. "bg-accent") */
  color?: string;
  /** Dot size in pixels */
  size?: number;
  /** Container style override */
  style?: ViewStyle;
}

function Dot({
  delay,
  color,
  size,
}: {
  delay: number;
  color: string;
  size: number;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [delay, opacity]);

  return (
    <Animated.View
      style={{ opacity, width: size, height: size, borderRadius: size / 2 }}
      className={color}
    />
  );
}

export default function LoadingDots({
  count = 3,
  color = "bg-accent",
  size = 6,
  style,
}: LoadingDotsProps) {
  return (
    <View style={style} className="flex-row items-center gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Dot key={i} delay={i * 200} color={color} size={size} />
      ))}
    </View>
  );
}
