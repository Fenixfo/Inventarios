import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// El alias se define aquí en vez de leerlo del tsconfig: ese archivo excluye
// la carpeta de tests para que el build de Next no la type-checkee.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // Los tests de integración golpean Supabase remoto, que tarda
    // varios segundos por operación; el default de 5s no alcanza.
    testTimeout: 60000,
    hookTimeout: 60000,
    // Evita que dos tests escriban sobre el mismo stock a la vez.
    fileParallelism: false,
    // Los e2e corren con Playwright, no con Vitest.
    exclude: ['**/node_modules/**', '**/.next/**', '**/e2e/**'],
  },
})
