// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import nextConfig from '../../next.config'

// Auditoría ECC, puntos 5 y 6: cabeceras de seguridad y proxy de Next.js 16.
describe('cabeceras de seguridad', () => {
  it('se aplican a todas las rutas', async () => {
    const reglas = await nextConfig.headers!()
    const todas = reglas.find((r) => r.source === '/(.*)')
    const nombres = (todas?.headers || []).map((h) => h.key)

    expect(nombres).toEqual(
      expect.arrayContaining([
        'X-Frame-Options',
        'Content-Security-Policy',
        'X-Content-Type-Options',
        'Referrer-Policy',
      ])
    )
  })

  it('la app no se puede meter en un iframe ajeno', async () => {
    const reglas = await nextConfig.headers!()
    const cabeceras = reglas.flatMap((r) => r.headers)

    expect(cabeceras.find((h) => h.key === 'X-Frame-Options')?.value).toBe('DENY')
    expect(cabeceras.find((h) => h.key === 'Content-Security-Policy')?.value).toContain("frame-ancestors 'none'")
  })
})

describe('proxy de Next.js 16', () => {
  it('se llama proxy.ts: middleware.ts está obsoleto', () => {
    expect(existsSync(join(process.cwd(), 'proxy.ts'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'middleware.ts'))).toBe(false)
  })
})
