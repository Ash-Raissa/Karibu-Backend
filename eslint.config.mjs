import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

// ESLint config for project JavaScript files.
export default defineConfig([
  // Use recommended JS rules and browser globals for frontend scripts.
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
]);
