import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      // Shared by the web and mobile apps: no UI framework, platform storage or
      // app code here (PLAN.md §0 #47).
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-*", "react/*", "next", "next/*", "next-*", "dexie*", "expo*"],
              message: "@qct/core is React-free and platform-free.",
            },
            { group: ["@/*", "@qct/web*"], message: "Use relative imports inside @qct/core." },
          ],
        },
      ],
    },
  },
  {
    // Node globals are typed for the node:sqlite test driver only.
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts", "src/**/testing/**", "src/test/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...["process", "Buffer", "global", "__dirname", "require"].map((name) => ({
          name,
          message: "@qct/core also runs in React Native: no Node globals.",
        })),
      ],
    },
  },
  eslintConfigPrettier,
  { ignores: ["node_modules/**"] },
);
