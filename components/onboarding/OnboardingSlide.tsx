import { View, Text, Dimensions } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface SlideData {
  id: string;
  title: string;
  description: string;
}

interface OnboardingSlideProps {
  item: SlideData;
}

export default function OnboardingSlide({ item }: OnboardingSlideProps) {
  return (
    <View style={{ width: SCREEN_WIDTH }} className="px-8">
      <Text className="text-primary text-2xl font-bold text-center mb-4 leading-tight">
        {item.title}
      </Text>
      <Text className="text-gray-500 text-sm text-center leading-6">
        {item.description}
      </Text>
    </View>
  );
}
