const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier/flat");

/**
 * Physical (left/right) style props break in RTL. Use the logical ones:
 * marginStart/marginEnd, paddingStart/paddingEnd, start/end,
 * borderStartWidth, borderTopStartRadius, textAlign "auto" (PLAN.md §0 #53).
 */
const PHYSICAL_STYLE_PROPS =
  "/^((margin|padding)(Left|Right)|left|right|border(Left|Right)(Width|Color|Style)?|border(Top|Bottom)(Left|Right)Radius)$/";

module.exports = defineConfig([
  expoConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Property[key.name=${PHYSICAL_STYLE_PROPS}]`,
          message:
            "Physical left/right style props break in RTL: use start/end (marginStart, paddingEnd, start, borderStartWidth…).",
        },
        {
          selector: "Property[key.name='textAlign'] Literal[value=/^(left|right)$/]",
          message: 'textAlign left/right breaks in RTL: use "auto" (follows the text) or omit it.',
        },
      ],
    },
  },
  prettierConfig,
  { ignores: ["node_modules/**", "android/**", "ios/**", ".expo/**", "expo-env.d.ts"] },
]);
