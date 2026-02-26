import { ActivityIndicator, Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface ProfileRowProps {
  icon: IoniconsName;
  label: string;
  value?: string;
  onPress?: () => void;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitch?: (v: boolean) => void;
  danger?: boolean;
  accent?: boolean;
  loading?: boolean;
}

export default function ProfileRow({
  icon,
  label,
  value,
  onPress,
  isSwitch,
  switchValue,
  onSwitch,
  danger,
  accent,
  loading,
}: ProfileRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={isSwitch || loading}
      className="flex-row items-center py-3.5 px-4 active:bg-gray-50"
    >
      <View
        className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${
          danger ? "bg-red-50" : accent ? "bg-[#D4A017]/10" : "bg-primary/5"
        }`}
      >
        <Ionicons
          name={icon}
          size={17}
          color={danger ? "#EF4444" : accent ? "#D4A017" : "#042F40"}
        />
      </View>
      <View className="flex-1">
        <Text
          className={`text-sm font-medium ${danger ? "text-red-500" : "text-primary"}`}
        >
          {label}
        </Text>
        {value ? (
          <Text className="text-xs text-gray-400 mt-0.5">{value}</Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color="#042F40" />
      ) : isSwitch && onSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitch}
          trackColor={{ false: "#E5E7EB", true: "#042F40" }}
          thumbColor="#FFFFFF"
        />
      ) : !isSwitch ? (
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      ) : null}
    </Pressable>
  );
}
