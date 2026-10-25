import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { FONT_FILES } from "@/theme/fonts";

/** The faces the sheet uses: regular text, and bold for headings and marks. */
const FACES = [
  { file: "PlexArabic-Regular", weight: 400 },
  { file: "PlexArabic-Bold", weight: 700 },
] as const;

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  // In chunks: one call with every byte would overflow the call stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

let cached: Promise<string> | null = null;

/**
 * `@font-face` rules with IBM Plex Sans Arabic embedded as data, so a printed
 * or shared PDF shows the app's font on any printer or phone, with no
 * network. Read once from the app's bundled fonts, then kept.
 */
export function embeddedFontCss(): Promise<string> {
  cached ??= Promise.all(
    FACES.map(async ({ file, weight }) => {
      const asset = await Asset.fromModule(FONT_FILES[file]).downloadAsync();
      const bytes = await new File(asset.localUri ?? asset.uri).bytes();
      return `@font-face{font-family:"Plex Arabic";font-weight:${weight};src:url(data:font/ttf;base64,${toBase64(bytes)}) format("truetype");}`;
    }),
  )
    .then((rules) => rules.join(""))
    .catch((error: unknown) => {
      // Without it the sheet falls back to the system's Arabic font.
      cached = null;
      console.error("Couldn't embed the print font", error);
      return "";
    });
  return cached;
}
