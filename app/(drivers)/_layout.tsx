import { Tabs } from "expo-router";
import React from "react";
import AnimatedTabBar from "@/components/navigation/AnimatedTabBar";

export default function DriverTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="rides" />
      <Tabs.Screen name="earnings" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
