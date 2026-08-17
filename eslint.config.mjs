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
    // Vendored chart source, installed verbatim from the `@bklit` shadcn
    // registry by `shadcn add`. It is upstream code, not ours: editing it to
    // satisfy our lint rules would be silently reverted by the next
    // `shadcn add --overwrite`, and would make upstream diffs unreadable.
    // Our own chart composition lives in `components/charts/*-chart.tsx`
    // wrappers and in the pages, which are linted normally.
    "components/charts/**",
  ]),
]);

export default eslintConfig;
