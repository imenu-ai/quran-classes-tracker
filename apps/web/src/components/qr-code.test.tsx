// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { QrCode } from "./qr-code";

describe("QrCode", () => {
  it("draws every dark module of the code, with a white quiet zone", () => {
    const value = "https://app.test/parent?s=01928c5e-7b3a-7cde-8f00-00000000bb01";
    render(<QrCode value={value} label="رابط ولي الأمر" />);
    const svg = screen.getByRole("img", { name: "رابط ولي الأمر" });
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    const dark = Array.from(modules.data).filter(Boolean).length;

    expect(svg.getAttribute("viewBox")).toBe(`-2 -2 ${modules.size + 4} ${modules.size + 4}`);
    expect(svg.querySelector("path")?.getAttribute("d")?.match(/M/g)).toHaveLength(dark);
    expect(svg.querySelector("rect")?.getAttribute("fill")).toBe("#fff");
  });
});
