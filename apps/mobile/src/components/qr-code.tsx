import { useMemo } from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { qrShape, qrViewBox } from "@qct/core/shared/qr";

/**
 * A QR code drawn from the code's matrix (offline, the same shape as the
 * web's and the printed sheets'). Always black on white, whatever the theme.
 */
export function QrCode({
  value,
  label,
  size,
}: Readonly<{ value: string; label: string; size: number }>) {
  const shape = useMemo(() => qrShape(value), [value]);
  const { origin, box, viewBox } = qrViewBox(shape.size);
  return (
    <Svg
      width={size}
      height={size}
      viewBox={viewBox}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID="qr-code"
    >
      <Rect x={origin} y={origin} width={box} height={box} fill="#fff" />
      <Path d={shape.path} fill="#000" />
    </Svg>
  );
}
