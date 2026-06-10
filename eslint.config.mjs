import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // La règle React 19 `set-state-in-effect` (preset core-web-vitals) est un
    // garde-fou perf agressif. Nos cas actuels (sidebar : fermer le drawer au
    // changement de route ; team-view : resync des props serveur après
    // router.refresh()) sont volontaires et documentés. On la rétrograde en
    // avertissement : elle reste visible mais ne casse pas la CI (issue #18).
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
