/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ── UniRide Brand Colors (matching web) ──────────────────────
        primary: {
          DEFAULT: "#042F40",
          light: "#063d54",
          dark: "#021e2a",
          foreground: "#F0F1F3",
        },
        accent: {
          DEFAULT: "#D4A017",
          light: "#E8B82E",
          foreground: "#042F40",
        },
        muted: {
          DEFAULT: "#F5F5F5",
          foreground: "#737373",
        },
        destructive: {
          DEFAULT: "#DC2626",
        },
        success: {
          DEFAULT: "#16A34A",
        },
        border: "#E5E5E5",
        input: "#E5E5E5",
        ring: "#042F40",
      },
    },
  },
  plugins: [],
};
