/**
 * UniRide Design System Colors
 * Matching the web platform brand identity (#042F40 primary, #D4A017 accent)
 */

import { Platform } from "react-native";

const tintColorLight = "#042F40";
const tintColorDark = "#F0F1F3";

export const Colors = {
  light: {
    text: "#0a0a0a",
    background: "#ffffff",
    tint: tintColorLight,
    icon: "#737373",
    tabIconDefault: "#737373",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#F0F1F3",
    background: "#0a0a0a",
    tint: tintColorDark,
    icon: "#a3a3a3",
    tabIconDefault: "#a3a3a3",
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
