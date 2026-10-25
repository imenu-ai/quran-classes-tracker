import { describe, expect, it } from "vitest";
import { qrShape, qrSvgMarkup, qrViewBox } from "./qr";

describe("QR codes", () => {
  it("draws the matrix as one path of unit squares", () => {
    const { size, path } = qrShape("https://example.test/parent?s=abc");
    expect(size).toBeGreaterThanOrEqual(21);
    expect(path.startsWith("M0 0h1v1h-1z")).toBe(true);
  });

  it("frames it in a white quiet zone and escapes the label", () => {
    expect(qrViewBox(25).viewBox).toBe("-2 -2 29 29");
    const svg = qrSvgMarkup("https://example.test", 'Scan "me" & <go>');
    expect(svg).toContain('aria-label="Scan &#34;me&#34; &#38; &#60;go&#62;"');
    expect(svg).toContain('fill="#fff"');
  });
});
