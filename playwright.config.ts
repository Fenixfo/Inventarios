import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// Playwright no lee el .env por su cuenta; las credenciales de prueba
// viven allí para no quedar en el código.
dotenv.config()

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  // Los flujos tocan stock compartido, así que corren de a uno.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // El dev server contra Supabase remoto responde lento.
    actionTimeout: 20000,
    navigationTimeout: 45000,
  },

  timeout: 90000,
  expect: { timeout: 15000 },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Reutiliza el servidor si ya está levantado; si no, lo arranca.
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180000,
  },
})
