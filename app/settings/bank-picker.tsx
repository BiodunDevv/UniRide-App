import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { driverApi } from "@/lib/driverApi";
import { eventBus } from "@/lib/eventBus";
import { FadeIn } from "@/components/ui/animations";
import { T, useTranslation } from "@/hooks/use-translation";

interface Bank {
  name: string;
  code: string;
}

export default function BankPickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ selected?: string }>();

  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const tSearchPlaceholder = useTranslation("Search banks...");

  useEffect(() => {
    (async () => {
      try {
        const res = await driverApi.getBankList();
        setBanks(res.data || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = banks.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = useCallback(
    (bank: Bank) => {
      eventBus.emit("bank-selected", bank);
      router.back();
    },
    [router],
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <FadeIn>
        <View className="flex-row items-center justify-between px-5 pt-3 pb-3 border-b border-gray-100">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-gray-50 items-center justify-center"
          >
            <Ionicons name="close" size={18} color="#042F40" />
          </Pressable>
          <Text className="text-primary text-[15px] font-bold">
            <T>Select Bank</T>
          </Text>
          <View className="w-9" />
        </View>
      </FadeIn>

      {/* Search */}
      <FadeIn delay={60}>
        <View className="mx-5 mt-4 mb-3 flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-3">
          <Ionicons name="search" size={16} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            className="flex-1 py-3 px-2.5 text-sm text-black"
            placeholder={tSearchPlaceholder}
            placeholderTextColor="#9CA3AF"
            autoFocus
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </Pressable>
          ) : null}
        </View>
      </FadeIn>

      {/* List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#042F40" />
          <Text className="text-gray-400 text-xs mt-3">
            <T>Loading banks...</T>
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => `${item.code}-${index}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const isSelected =
              params.selected?.toLowerCase() === item.name.toLowerCase();
            return (
              <Pressable
                onPress={() => handleSelect(item)}
                className={`flex-row items-center px-5 py-3.5 border-b border-gray-50 active:bg-gray-50 ${
                  isSelected ? "bg-primary/5" : ""
                }`}
              >
                <View
                  className={`w-9 h-9 rounded-xl items-center justify-center mr-3 ${
                    isSelected ? "bg-primary" : "bg-gray-100"
                  }`}
                >
                  <Ionicons
                    name="business"
                    size={15}
                    color={isSelected ? "#fff" : "#6B7280"}
                  />
                </View>
                <Text
                  className={`text-sm flex-1 ${
                    isSelected ? "text-primary font-semibold" : "text-gray-700"
                  }`}
                >
                  {item.name}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={18} color="#042F40" />
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons name="search-outline" size={36} color="#D1D5DB" />
              <Text className="text-gray-400 text-sm mt-3">
                <T>No banks found</T>
              </Text>
              <Text className="text-gray-300 text-xs mt-1">
                <T>Try a different search term</T>
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
