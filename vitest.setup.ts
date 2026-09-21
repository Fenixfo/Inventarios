import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Los tests de integración corren con environment node, donde no hay DOM
// ni localStorage: la limpieza solo aplica a los que usan jsdom.
const hayDOM = typeof window !== 'undefined'

afterEach(async () => {
  if (!hayDOM) return

  const { cleanup } = await import('@testing-library/react')
  cleanup()
  localStorage.clear()
})
