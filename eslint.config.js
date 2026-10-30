import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist", "node_modules"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-unreachable": "warn",
      "no-control-regex": "warn",
    },
  },
  {
    // scripts and build configuration run in Node
    files: ["*.js", "drizzle/**/*.js", "src/test/**/*.js", "src/test/**/*.jsx"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // server-side verification function runs on Deno
    files: ["supabase/functions/**/*.js"],
    languageOptions: { globals: { ...globals.browser, Deno: "readonly" } },
  },
  {
    files: ["src/lib/obfuscation-worker.js"],
    languageOptions: { globals: { ...globals.worker } },
  },
];
