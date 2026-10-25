import QRCode from "qrcode";

/** White border around the code, in modules, so readers find its edges. */
export const QR_QUIET_ZONE = 2;

export interface QrShape {
  /** Modules per side, without the quiet zone. */
  size: number;
  /** One SVG path of all dark modules, one unit per module. */
  path: string;
}

/**
 * A QR code as an SVG path drawn from the code's matrix (no network: works
 * offline and on paper). The web draws it in its own SVG, the app with
 * react-native-svg, and the printed sheets inline in their HTML.
 */
export function qrShape(value: string): QrShape {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  let path = "";
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.data[y * modules.size + x]) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size: modules.size, path };
}

/** The viewBox that shows the code with its quiet zone. */
export function qrViewBox(size: number): { origin: number; box: number; viewBox: string } {
  const box = size + QR_QUIET_ZONE * 2;
  const origin = -QR_QUIET_ZONE;
  return { origin, box, viewBox: `${origin} ${origin} ${box} ${box}` };
}

/** Standalone SVG markup, always black on white (for printed HTML). */
export function qrSvgMarkup(value: string, label: string): string {
  const { size, path } = qrShape(value);
  const { origin, box, viewBox } = qrViewBox(size);
  const escapedLabel = label.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapedLabel}" viewBox="${viewBox}" shape-rendering="crispEdges">` +
    `<rect x="${origin}" y="${origin}" width="${box}" height="${box}" fill="#fff"/>` +
    `<path d="${path}" fill="#000"/></svg>`
  );
}
