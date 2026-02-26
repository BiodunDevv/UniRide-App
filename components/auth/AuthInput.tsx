import { useState } from "react";
import { TextInput, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface AuthInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "email-address" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  secureTextEntry?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
}

export default function AuthInput({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  autoCapitalize = "none",
  secureTextEntry = false,
  icon,
  error,
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View className="mb-4">
      <Text className="text-gray-700 text-sm font-semibold mb-2">{label}</Text>
      <View
        className={`flex-row items-center bg-gray-50 rounded-lg border ${
          error ? "border-red-400" : "border-gray-200"
        } px-4`}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color="#9CA3AF"
            style={{ marginRight: 10 }}
          />
        )}
        <TextInput
          className="flex-1 py-3 text-sm text-black"
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={isPassword && !showPassword}
        />
        {isPassword && (
          <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#9CA3AF"
            />
          </Pressable>
        )}
      </View>
      {error && <Text className="text-red-500 text-xs mt-1 ml-1">{error}</Text>}
    </View>
  );
}
