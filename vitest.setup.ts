import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import dotenv from 'dotenv'

// Vitest no lee el .env por su cuenta y los tests de integración necesitan
// DATABASE_URL para conectarse.
dotenv.config()

// Los tests de integración corren con environment node, donde no hay DOM
// ni localStorage: la limpieza solo aplica a los que usan jsdom.
const hayDOM = typeof window !== 'undefined'

afterEach(async () => {
  if (!hayDOM) return

  const { cleanup } = await import('@testing-library/react')
  cleanup()
  localStorage.clear()
})
