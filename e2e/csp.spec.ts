import { test, expect, Page } from '@playwright/test'

// La CSP con nonce (proxy.ts, lib/csp.ts): si algo queda fuera de la
// política, el navegador lo bloquea sin romper la carga y solo lo avisa en
// la consola. Estas pruebas recorren las páginas y fallan ante cualquier
// aviso de CSP, además de comprobar que la página llegó a funcionar.

const USUARIO = process.env.E2E_USER
const CLAVE = process.env.E2E_PASSWORD

/** Junta los avisos de CSP de la consola mientras dura la prueba. */
function vigilarCsp(page: Page) {
  const violaciones: string[] = []
  page.on('console', (mensaje) => {
    const texto = mensaje.text()
    if (/content security policy|refused to/i.test(texto)) violaciones.push(texto)
  })
  return violaciones
}

test.describe('CSP en las páginas públicas', () => {
  test('la portada trae la CSP con nonce y el catálogo funciona', async ({ page }) => {
    const violaciones = vigilarCsp(page)
    const respuesta = await page.goto('/')

    const csp = respuesta?.headers()['content-security-policy'] || ''
    expect(csp).toMatch(/script-src [^;]*'nonce-[^']+'/)
    expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/)

    // Los productos llegan por fetch después de hidratar: si los scripts de
    // Next.js estuvieran bloqueados, la rejilla nunca aparecería.
    await expect(page.getByTestId('productos')).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()
    await expect(page.locator('.popup-in').getByRole('spinbutton')).toBeVisible()

    expect(violaciones).toEqual([])
  })

  test('cada visita recibe un nonce distinto', async ({ request }) => {
    const nonce = async () =>
      (await request.get('/login')).headers()['content-security-policy']?.match(/'nonce-([^']+)'/)?.[1]

    const primero = await nonce()
    expect(primero).toBeTruthy()
    expect(await nonce()).not.toBe(primero)
  })

  test('los scripts de la página llevan el nonce de la cabecera', async ({ page }) => {
    const respuesta = await page.goto('/login')
    const nonce = respuesta?.headers()['content-security-policy']?.match(/'nonce-([^']+)'/)?.[1]

    const html = await respuesta!.text()
    const scripts = html.match(/<script\b[^>]*>/g) || []
    expect(scripts.length).toBeGreaterThan(0)
    for (const etiqueta of scripts) expect(etiqueta).toContain(`nonce="${nonce}"`)
  })

  test('login y carrito cargan sin avisos de CSP', async ({ page }) => {
    const violaciones = vigilarCsp(page)

    await page.goto('/login')
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await page.goto('/carrito')
    await expect(page.getByRole('heading').first()).toBeVisible()

    expect(violaciones).toEqual([])
  })
})

test.describe('CSP en el panel', () => {
  test.skip(!USUARIO || !CLAVE, 'Faltan E2E_USER y E2E_PASSWORD en .env')

  test('el login contra Supabase y las pantallas del panel funcionan', async ({ page }) => {
    const violaciones = vigilarCsp(page)

    await page.goto('/login')
    await page.getByRole('textbox').first().fill(USUARIO!)
    await page.locator('input[type="password"]').fill(CLAVE!)
    await page.getByRole('button', { name: /ingresar|iniciar|entrar/i }).click()
    await page.waitForURL(/\/admin/, { timeout: 45000 })

    // Solo lectura: se abren y se espera a que muestren sus datos.
    const pantallas: [string, RegExp][] = [
      ['/admin/productos', /productos/i],
      ['/admin/facturas', /facturas/i],
      ['/admin/usuarios', /gestión de usuarios/i],
      ['/admin/reportes', /reportes/i],
    ]
    for (const [ruta, titulo] of pantallas) {
      await page.goto(ruta)
      await expect(page.getByRole('heading', { name: titulo }).first()).toBeVisible({
        timeout: 30000,
      })
    }

    expect(violaciones).toEqual([])
  })
})
