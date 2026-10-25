import { useMemo } from "react";
import { qrShape, qrViewBox } from "@qct/core/shared/qr";

/**
 * A QR code as an SVG drawn from the code's matrix (no network, works
 * offline and on paper). Always black on white, whatever the theme.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  /** What it opens, for screen readers. */
  label: string;
  className?: string;
}) {
  const { size, path } = useMemo(() => qrShape(value), [value]);
  const { origin, box, viewBox } = qrViewBox(size);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={viewBox}
      shapeRendering="crispEdges"
      className={className}
      data-qr-value={value}
    >
      <rect x={origin} y={origin} width={box} height={box} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
