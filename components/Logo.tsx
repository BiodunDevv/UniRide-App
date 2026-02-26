import React from "react";
import Svg, { G, Path, Rect, Defs, ClipPath } from "react-native-svg";

interface LogoProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function Logo({
  width = 144,
  height = 88,
  color = "#F0F1F3",
}: LogoProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 144 88" fill="none">
      <G clipPath="url(#clip0_0_2576)">
        <Path
          d="M106.08 59.0068C103.18 65.5675 98.36 71.3363 91.8446 75.3487C74.7389 85.8909 52.4411 80.3787 42.0436 63.037C36.3476 53.5388 35.4055 42.4614 38.5252 32.6535L33.0395 30.3C29.21 41.8376 30.2396 54.9456 36.9654 66.1647C49.0673 86.351 75.0194 92.7657 94.9293 80.4982C104.485 74.6099 110.909 65.4878 113.674 55.3615L106.08 59.0068ZM54.1893 12.5513C69.7615 2.95582 89.6363 6.66748 100.919 20.4922L109.143 21.868C109.117 21.8282 109.095 21.7796 109.069 21.7398C96.9667 1.55344 71.0146 -4.86566 51.1047 7.40628C49.2119 8.56976 47.4417 9.86597 45.7986 11.2684L54.0404 12.6486C54.0886 12.6176 54.1411 12.5823 54.1893 12.5513Z"
          fill={color}
        />
        <Path
          d="M60.8408 74.0525L144.45 33.9011L109.143 37.9711L83.3402 45.3236L60.8408 74.0525Z"
          fill={color}
        />
        <Path
          d="M83.3403 45.3237L144.45 33.9011L0.589844 9.82178L83.3403 45.3237Z"
          fill={color}
        />
      </G>
      <Defs>
        <ClipPath id="clip0_0_2576">
          <Rect width="144" height="88" fill="white" />
        </ClipPath>
      </Defs>
    </Svg>
  );
}
