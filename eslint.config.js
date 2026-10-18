import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dist-single", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    // 日本語の文の中の全角の空白は、表示のために使っている
    rules: { "no-irregular-whitespace": ["error", { skipStrings: true, skipTemplates: true, skipComments: true }] },
  },
);
