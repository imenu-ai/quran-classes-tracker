import QRCode from "qrcode";
import { useMemo } from "react";

/** White border around the code, in modules, so readers find its edges. */
const QUIET = 2;

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
  const { size, path } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    let d = "";
    for (let y = 0; y < modules.size; y++) {
      for (let x = 0; x < modules.size; x++) {
        if (modules.data[y * modules.size + x]) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { size: modules.size, path: d };
  }, [value]);

  const box = size + QUIET * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-QUIET} ${-QUIET} ${box} ${box}`}
      shapeRendering="crispEdges"
      className={className}
      data-qr-value={value}
    >
      <rect x={-QUIET} y={-QUIET} width={box} height={box} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
