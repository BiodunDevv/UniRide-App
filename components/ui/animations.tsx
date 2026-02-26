import { Image, Modal, Pressable, type ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

/* ─── FadeIn ───────────────────────────────────────────────────────────────── *
 * Reanimated fade + slide-up wrapper.  Consistent with auth page animations. *
 * Use `delay` to stagger multiple instances.                                 *
 * ────────────────────────────────────────────────────────────────────────── */
export function FadeIn({
  delay = 0,
  duration = 380,
  translateY: _ty = 10,
  style,
  children,
}: {
  delay?: number;
  duration?: number;
  translateY?: number;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(duration)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/* ─── ImagePreviewModal ────────────────────────────────────────────────────── *
 * Full-screen tap-to-dismiss image viewer (dark overlay).                    *
 * ────────────────────────────────────────────────────────────────────────── */
export function ImagePreviewModal({
  visible,
  uri,
  onClose,
}: {
  visible: boolean;
  uri: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/90 items-center justify-center"
      >
        <Pressable
          onPress={onClose}
          className="absolute top-14 right-5 z-10 w-10 h-10 rounded-full bg-white/20 items-center justify-center"
        >
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <Image
          source={{ uri }}
          className="w-full"
          style={{ aspectRatio: 1 }}
          resizeMode="contain"
        />
      </Pressable>
    </Modal>
  );
}
