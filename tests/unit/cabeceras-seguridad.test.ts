// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import nextConfig from '../../next.config'
import { proxy } from '../../proxy'
import { politicaDeSeguridad } from '@/lib/csp'

// Auditoría ECC, puntos 5 y 6: cabeceras de seguridad y proxy de Next.js 16.
describe('cabeceras de seguridad', () => {
  it('se aplican a todas las rutas', async () => {
    const reglas = await nextConfig.headers!()
    const todas = reglas.find((r) => r.source === '/(.*)')
    const nombres = (todas?.headers || []).map((h) => h.key)

    expect(nombres).toEqual(
      expect.arrayContaining(['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy'])
    )
  })

  it('la app no se puede meter en un iframe ajeno', async () => {
    const reglas = await nextConfig.headers!()
    const cabeceras = reglas.flatMap((r) => r.headers)

    expect(cabeceras.find((h) => h.key === 'X-Frame-Options')?.value).toBe('DENY')
  })

  it('la API lleva una CSP corta que no permite nada', async () => {
    const reglas = await nextConfig.headers!()
    const api = reglas.find((r) => r.source === '/api/(.*)')
    const csp = api?.headers.find((h) => h.key === 'Content-Security-Policy')?.value

    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })
})

describe('CSP de las páginas', () => {
  const base = { nonce: 'abc123', desarrollo: false, supabaseUrl: 'https://xyz.supabase.co' }
  const directiva = (csp: string, nombre: string) =>
    csp.split('; ').find((d) => d.startsWith(nombre + ' ')) || ''

  it('solo ejecuta scripts con el nonce de la petición', () => {
    const scripts = directiva(politicaDeSeguridad(base), 'script-src')

    expect(scripts).toContain("'nonce-abc123'")
    expect(scripts).toContain("'strict-dynamic'")
    expect(scripts).not.toContain("'unsafe-inline'")
    expect(scripts).not.toContain("'unsafe-eval'")
  })

  it('permite eval solo en desarrollo', () => {
    const scripts = directiva(politicaDeSeguridad({ ...base, desarrollo: true }), 'script-src')
    expect(scripts).toContain("'unsafe-eval'")
  })

  it('los estilos en línea funcionan: sin nonce, que anularía unsafe-inline', () => {
    const estilos = directiva(politicaDeSeguridad(base), 'style-src')

    expect(estilos).toContain("'unsafe-inline'")
    expect(estilos).not.toContain('nonce-')
  })

  it('deja hablar con Supabase por https y por websocket', () => {
    const conexiones = directiva(politicaDeSeguridad(base), 'connect-src')

    expect(conexiones).toContain('https://xyz.supabase.co')
    expect(conexiones).toContain('wss://xyz.supabase.co')
  })

  it('sin URL de Supabase válida solo se conecta al propio sitio', () => {
    const conexiones = directiva(
      politicaDeSeguridad({ ...base, supabaseUrl: 'no es una url' }),
      'connect-src'
    )
    expect(conexiones).toBe("connect-src 'self'")
  })

  it('bloquea iframes ajenos, plugins y el cambio de <base>', () => {
    const csp = politicaDeSeguridad(base)

    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
  })
})

describe('proxy de Next.js 16', () => {
  it('se llama proxy.ts: middleware.ts está obsoleto', () => {
    expect(existsSync(join(process.cwd(), 'proxy.ts'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'middleware.ts'))).toBe(false)
  })

  const nonceDe = (csp: string | null) => csp?.match(/'nonce-([^']+)'/)?.[1]

  it('pone la CSP en la página y le pasa el mismo nonce a Next.js', () => {
    const respuesta = proxy(new NextRequest('http://localhost/'))
    const csp = respuesta.headers.get('content-security-policy')

    expect(nonceDe(csp)).toBeTruthy()
    // NextResponse.next({ request: { headers } }) deja las cabeceras de la
    // petición reescrita en x-middleware-request-*: de ahí la lee el render.
    expect(respuesta.headers.get('x-middleware-request-content-security-policy')).toBe(csp)
  })

  it('cada visita lleva un nonce distinto', () => {
    const csp = () =>
      proxy(new NextRequest('http://localhost/admin')).headers.get('content-security-policy')

    expect(nonceDe(csp())).not.toBe(nonceDe(csp()))
  })

  it('a la API no le pone la CSP con nonce', () => {
    const respuesta = proxy(new NextRequest('http://localhost/api/productos/catalogo'))
    expect(respuesta.headers.get('content-security-policy')).toBeNull()
  })
})
