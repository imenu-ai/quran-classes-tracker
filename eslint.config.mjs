import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import eslintConfigPrettier from "eslint-config-prettier/flat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * Only inline-axis (left/right) classes depend on text direction. Block-axis
 * (top/bottom) and size classes are identical in RTL and LTR, so they are
 * ignored. The pattern skips variant prefixes (`md:`, `rtl:`), negative values
 * (`-mt-2`) and the important modifier (`mt-2!`).
 */
const DIRECTION_NEUTRAL_CLASSES =
  "^(?:[^:]+:)*-?(?:p[tb]|m[tb]|scroll-[mp][tb]|top|bottom|border-[tb]|(?:min-|max-)?[wh]|size)(?:-.*)?!?$";

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs}"],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": { entryPoint: "src/app/globals.css" },
    },
    rules: {
      // Physical direction classes (ml-, pr-, left-, text-right, …) are not
      // allowed; the app must work in RTL and LTR. Use ms-/pe-/start-/text-end.
      "better-tailwindcss/enforce-logical-properties": [
        "error",
        { ignore: [DIRECTION_NEUTRAL_CLASSES] },
      ],
      // `dir` must come from getDirection(locale), or be "auto" for user text.
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dir'] Literal[value=/^(rtl|ltr)$/i]",
          message:
            'Do not hardcode dir="rtl"/"ltr". Use getDirection(locale), or dir="auto" for user-entered text.',
        },
      ],
    },
  },
  eslintConfigPrettier,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "public/sw.js",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
