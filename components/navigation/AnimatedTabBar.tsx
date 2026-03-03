import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect, useRef } from "react";
import { Dimensions, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function AnimatedTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const tabWidth = SCREEN_WIDTH / state.routes.length;

  const slideAnim = useSharedValue(0);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      slideAnim.value = state.index * tabWidth;
      isInitialMount.current = false;
    } else {
      slideAnim.value = withSpring(state.index * tabWidth, {
        damping: 18,
        stiffness: 180,
        mass: 0.5,
        overshootClamping: false,
      });
    }
  }, [state.index, tabWidth, slideAnim]);

  const getIconName = (routeName: string, focused: boolean): string => {
    const icons: Record<string, { focused: string; unfocused: string }> = {
      index: { focused: "home", unfocused: "home-outline" },
      rides: { focused: "car", unfocused: "car-outline" },
      activity: { focused: "time", unfocused: "time-outline" },
      drive: { focused: "car-sport", unfocused: "car-sport-outline" },
      notifications: {
        focused: "notifications",
        unfocused: "notifications-outline",
      },
      earnings: { focused: "wallet", unfocused: "wallet-outline" },
      profile: { focused: "person", unfocused: "person-outline" },
    };
    const icon = icons[routeName] || icons.index;
    return focused ? icon.focused : icon.unfocused;
  };

  const getLabel = (routeName: string): string => {
    const labels: Record<string, string> = {
      index: "Home",
      rides: "Rides",
      activity: "Activity",
      drive: "Drive",
      notifications: "Alerts",
      earnings: "Earnings",
      profile: "Profile",
    };
    return labels[routeName] || routeName;
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideAnim.value }],
  }));

  return (
    <SafeAreaView edges={["bottom"]} className="bg-white">
      <View
        className=" border-t border-gray-100"
        style={{
          shadowColor: "#042F40",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 12,
        }}
      >
        {/* Sliding indicator */}
        <Animated.View
          className="absolute top-0 bg-primary rounded-full"
          style={[
            {
              height: 3,
              width: tabWidth * 0.35,
              marginLeft: tabWidth * 0.325,
            },
            animatedStyle,
          ]}
        />

        {/* Tab buttons */}
        <View className="flex-row items-center justify-around pt-2 pb-1">
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            const iconName = getIconName(route.name, isFocused);
            const label = getLabel(route.name);

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={onPress}
                onLongPress={onLongPress}
                className="flex-1 items-center justify-center py-1"
              >
                <View
                  className={`items-center justify-center rounded-xl px-3 py-1.5 ${
                    isFocused ? "bg-primary/5" : ""
                  }`}
                >
                  <View className="mb-0.5">
                    <Ionicons
                      name={iconName as any}
                      size={22}
                      color={isFocused ? "#042F40" : "#9CA3AF"}
                    />
                  </View>
                  <Text
                    className={`text-[10px] font-semibold ${
                      isFocused ? "text-primary" : "text-gray-400"
                    }`}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}
