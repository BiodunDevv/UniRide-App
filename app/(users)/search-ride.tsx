import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  BackHandler,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";

import { useRideStore, CampusLocation } from "@/store/useRideStore";
import { T } from "@/hooks/use-translation";

const CATEGORIES = [
  { key: "all", label: "All", icon: "grid" },
  { key: "academic", label: "Academic", icon: "school" },
  { key: "hostel", label: "Hostels", icon: "bed" },
  { key: "cafeteria", label: "Cafeteria", icon: "restaurant" },
  { key: "admin_building", label: "Admin", icon: "business" },
  { key: "religious", label: "Religious", icon: "heart" },
  { key: "library", label: "Library", icon: "library" },
  { key: "market", label: "Markets", icon: "cart" },
  { key: "other", label: "Other", icon: "location" },
] as const;

export default function SearchRideScreen() {
  const router = useRouter();
  const {
    campusLocations,
    groupedLocations,
    isLoadingLocations,
    selectedPickup,
    selectedDestination,
    setSelectedPickup,
    setSelectedDestination,
    fetchLocations,
  } = useRideStore();

  const [mode, setMode] = useState<"pickup" | "destination">(
    selectedPickup ? "destination" : "pickup",
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    if (campusLocations.length === 0) fetchLocations();
  }, []);

  // ── Back handler ──────────────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selectedPickup && mode === "destination") {
        setMode("pickup");
        return true;
      }
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [mode, selectedPickup]);

  // ── Filtered locations ────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = campusLocations.filter((l) => l.is_active);
    if (category !== "all") list = list.filter((l) => l.category === category);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.short_name?.toLowerCase().includes(q) ||
          l.address?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [campusLocations, category, query]);

  // ── Select location ───────────────────────────────────────────────
  const selectLocation = useCallback(
    (loc: CampusLocation) => {
      if (mode === "pickup") {
        setSelectedPickup(loc);
        setMode("destination");
        setQuery("");
      } else {
        setSelectedDestination(loc);
        router.push("/(users)/available-rides" as any);
      }
    },
    [mode],
  );

  const clearPickup = () => {
    setSelectedPickup(null);
    setMode("pickup");
    setQuery("");
  };
  const clearDest = () => {
    setSelectedDestination(null);
    setMode("destination");
    setQuery("");
  };

  // ═════════════════════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* ── Header ─────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="px-5 pt-3 pb-2"
        >
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={20} color="#042F40" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-gray-900 flex-1">
              <T>Find a Ride</T>
            </Text>
          </View>

          {/* ── Route Summary ──────────────────────────────────── */}
          <View className="bg-gray-50 rounded-2xl p-4 mb-3">
            <TouchableOpacity
              onPress={() => {
                setMode("pickup");
                setQuery("");
              }}
              className={`flex-row items-center mb-2 pb-2 border-b border-gray-200 ${mode === "pickup" ? "opacity-100" : "opacity-60"}`}
            >
              <View className="w-3 h-3 rounded-full bg-green-500 mr-3" />
              <Text className="flex-1 text-sm" numberOfLines={1}>
                {selectedPickup ? (
                  selectedPickup.short_name || selectedPickup.name
                ) : (
                  <T>Choose pickup</T>
                )}
              </Text>
              {selectedPickup && (
                <TouchableOpacity onPress={clearPickup}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setMode("destination");
                setQuery("");
              }}
              className={`flex-row items-center ${mode === "destination" ? "opacity-100" : "opacity-60"}`}
            >
              <View className="w-3 h-3 rounded-full bg-red-500 mr-3" />
              <Text className="flex-1 text-sm" numberOfLines={1}>
                {selectedDestination ? (
                  selectedDestination.short_name || selectedDestination.name
                ) : (
                  <T>Choose destination</T>
                )}
              </Text>
              {selectedDestination && (
                <TouchableOpacity onPress={clearDest}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Search + Mode ──────────────────────────────────── */}
          <View className="mb-2">
            <Text className="text-xs font-semibold text-accent mb-2 uppercase tracking-wider">
              {mode === "pickup" ? (
                <T>Select Pickup</T>
              ) : (
                <T>Select Destination</T>
              )}
            </Text>
            <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-2.5">
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search locations..."
                placeholderTextColor="#9CA3AF"
                className="flex-1 ml-2 text-sm text-gray-800"
                autoCapitalize="none"
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>

        {/* ── Category Chips ─────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(100).duration(300)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-5 mb-2 max-h-10"
          >
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.key}
                onPress={() => setCategory(c.key)}
                className={`mr-2 px-3 py-1.5 rounded-full flex-row items-center ${category === c.key ? "bg-primary" : "bg-gray-100"}`}
              >
                <Ionicons
                  name={c.icon as any}
                  size={12}
                  color={category === c.key ? "#fff" : "#6B7280"}
                />
                <Text
                  className={`ml-1.5 text-xs font-medium ${category === c.key ? "text-white" : "text-gray-600"}`}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* ── Location List ──────────────────────────────────────── */}
        {isLoadingLocations ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#042F40" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 40,
              paddingTop: 8,
            }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="items-center mt-10">
                <Ionicons name="location-outline" size={40} color="#D1D5DB" />
                <Text className="text-sm text-gray-400 mt-3">
                  <T>No locations found</T>
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const isSelected =
                (mode === "pickup" && selectedPickup?._id === item._id) ||
                (mode === "destination" &&
                  selectedDestination?._id === item._id);
              return (
                <Animated.View
                  entering={FadeInDown.delay(index * 30).duration(250)}
                >
                  <TouchableOpacity
                    onPress={() => selectLocation(item)}
                    className={`flex-row items-center py-3.5 px-3 rounded-xl mb-1 ${isSelected ? "bg-primary/10" : "bg-white"}`}
                    activeOpacity={0.7}
                  >
                    <View
                      className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${isSelected ? "bg-primary" : "bg-gray-100"}`}
                    >
                      <Ionicons
                        name={isSelected ? "checkmark" : ("location" as any)}
                        size={16}
                        color={isSelected ? "#fff" : "#042F40"}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-sm font-semibold text-gray-800"
                        numberOfLines={1}
                      >
                        {item.short_name || item.name}
                      </Text>
                      {item.address ? (
                        <Text
                          className="text-xs text-gray-400 mt-0.5"
                          numberOfLines={1}
                        >
                          {item.address}
                        </Text>
                      ) : null}
                    </View>
                    {item.is_popular && (
                      <View className="bg-accent/10 rounded-full px-2 py-0.5">
                        <Text className="text-[10px] text-accent font-semibold">
                          <T>Popular</T>
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
