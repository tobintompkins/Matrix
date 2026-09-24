import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated validation/preview trees — linting them hangs npm run lint.
    ".next-ui-preview/**",
    ".next-validate/**",
    ".next-validate-*/**",
    ".matrix-backups/**",
  ]),
]);

export default eslintConfig;
