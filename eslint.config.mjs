import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Las pantallas cargan sus datos en un useEffect que marca "cargando"
      // antes de pedirlos. La regla lo señala por rendimiento, no por error;
      // cambiarlo es migrar a TanStack Query o Server Components, que la
      // auditoría (docs/auditoria_ecc.md) decidió hacer pantalla por
      // pantalla. Queda como aviso para no perderlo de vista.
      "react-hooks/set-state-in-effect": "warn",
      // Hay ~170 `any` heredados (auditoría, punto 10). Aviso y no error
      // mientras se van tipando, para que la CI pueda correr lint ya.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Scripts de mantenimiento en Node (CommonJS): require es lo normal ahí.
    files: ["scripts/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Resultados de las pruebas.
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
