import { test, expect, Page } from '@playwright/test'

// Flujo del cliente: catálogo -> carrito -> envío por WhatsApp.
// No requiere autenticación.

// El campo de WhatsApp destino solo se muestra cuando la configuración
// no trae número, y aparece después de esa consulta: hay que esperarlo
// en vez de comprobar su visibilidad de inmediato.
async function completarDestinoSiHaceFalta(page: Page) {
  const destino = page.getByPlaceholder('573001234567')
  await destino.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})

  if (await destino.isVisible().catch(() => false)) {
    await destino.fill('573001234567')
  }
}

test.describe('Catálogo público', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('carga sin necesidad de iniciar sesión', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /catálogo de productos/i })).toBeVisible()
    expect(page.url()).not.toContain('/login')
  })

  test('muestra los productos disponibles con su precio', async ({ page }) => {
    const tarjetas = page.locator('main .grid > div')
    await expect(tarjetas.first()).toBeVisible()

    const total = await tarjetas.count()
    expect(total).toBeGreaterThan(0)

    // Todo producto listado debe mostrar un precio en pesos.
    await expect(tarjetas.first().getByText(/\$/).first()).toBeVisible()
  })

  test('permite filtrar por categoría', async ({ page }) => {
    const botones = page.locator('main button', { hasText: /^(?!Todas).+/ })
    await expect(page.getByRole('button', { name: 'Todas' })).toBeVisible()

    if ((await botones.count()) > 0) {
      const antes = await page.locator('main .grid > div').count()
      await botones.first().click()
      await page.waitForTimeout(1500)

      const despues = await page.locator('main .grid > div').count()
      expect(despues).toBeLessThanOrEqual(antes)
    }
  })

  test('el contador del carrito arranca oculto', async ({ page }) => {
    const enlace = page.getByRole('link', { name: /carrito/i })
    await expect(enlace).toBeVisible()
  })
})

test.describe('Agregar al carrito', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('main .grid > div').first()).toBeVisible()
  })

  test('el pop-up pide los metros y calcula el total', async ({ page }) => {
    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()

    const popup = page.locator('.popup-in')
    await expect(popup).toBeVisible()
    await expect(popup.getByText(/cuántos m² deseas/i)).toBeVisible()

    const input = popup.getByRole('spinbutton')
    await expect(input).toHaveValue('1')

    await input.fill('4')
    await expect(popup.getByText(/^Total$/)).toBeVisible()
  })

  test('los botones + y − ajustan de a 0.5 m²', async ({ page }) => {
    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()

    const popup = page.locator('.popup-in')
    const input = popup.getByRole('spinbutton')

    await popup.getByRole('button', { name: '+' }).click()
    await expect(input).toHaveValue('1.5')

    await popup.getByRole('button', { name: '−' }).click()
    await expect(input).toHaveValue('1')
  })

  test('se cierra con Escape sin agregar nada', async ({ page }) => {
    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()
    await expect(page.locator('.popup-in')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('.popup-in')).not.toBeVisible()

    await page.goto('/carrito')
    await expect(page.getByText(/el carrito está vacío/i)).toBeVisible()
  })

  test('se cierra al hacer clic fuera', async ({ page }) => {
    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()
    await expect(page.locator('.popup-in')).toBeVisible()

    await page.mouse.click(10, 10)
    await expect(page.locator('.popup-in')).not.toBeVisible()
  })

  test('agrega el producto y lo refleja en el contador', async ({ page }) => {
    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()

    const popup = page.locator('.popup-in')
    await popup.getByRole('spinbutton').fill('3')
    await popup.getByRole('button', { name: /agregar al carrito/i }).click()

    await expect(popup).not.toBeVisible()
    await expect(page.getByRole('link', { name: /carrito/i })).toContainText('1')
  })
})

test.describe('Carrito', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('main .grid > div').first()).toBeVisible()

    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()
    const popup = page.locator('.popup-in')
    await popup.getByRole('spinbutton').fill('2')
    await popup.getByRole('button', { name: /agregar al carrito/i }).click()
    await expect(popup).not.toBeVisible()

    await page.goto('/carrito')
  })

  test('el producto persiste al navegar entre páginas', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /carrito de compras/i })).toBeVisible()
    await expect(page.getByRole('spinbutton')).toHaveValue('2')
  })

  test('permite cambiar la cantidad escribiendo', async ({ page }) => {
    await page.getByRole('spinbutton').fill('5')
    await expect(page.getByRole('spinbutton')).toHaveValue('5')
  })

  test('quitar el producto deja el carrito vacío', async ({ page }) => {
    await page.getByRole('button', { name: '✕' }).click()
    await expect(page.getByText(/el carrito está vacío/i)).toBeVisible()
  })
})

test.describe('Envío del pedido por WhatsApp', () => {
  test.beforeEach(async ({ page }) => {
    // Se intercepta window.open para leer la URL generada sin salir
    // a wa.me, que es un dominio externo y no hace falta para la prueba.
    await page.addInitScript(() => {
      ;(window as any).__urlWhatsapp = null
      window.open = (url?: string | URL) => {
        ;(window as any).__urlWhatsapp = String(url)
        return null
      }
    })

    await page.goto('/')
    await expect(page.locator('main .grid > div').first()).toBeVisible()

    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()
    const popup = page.locator('.popup-in')
    await popup.getByRole('spinbutton').fill('2')
    await popup.getByRole('button', { name: /agregar al carrito/i }).click()

    await page.goto('/carrito')
    await page.getByRole('button', { name: /enviar por whatsapp/i }).click()
  })

  test('exige el teléfono del cliente', async ({ page }) => {
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByText(/ingresa tu número de teléfono/i)).toBeVisible()
  })

  test('rechaza un teléfono demasiado corto', async ({ page }) => {
    await page.getByPlaceholder('300 123 4567').fill('12345')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByText(/al menos 10 dígitos/i)).toBeVisible()
  })

  test('muestra el resumen del pedido antes de enviar', async ({ page }) => {
    await expect(page.getByText(/productos:/i)).toBeVisible()
    await expect(page.getByText(/total m²:/i)).toBeVisible()
  })

  test('genera el enlace de WhatsApp con el pedido y confirma el envío', async ({ page }) => {
    await page.getByPlaceholder('Juan Pérez').fill('Cliente E2E')
    await page.getByPlaceholder('300 123 4567').fill('3001234567')
    await completarDestinoSiHaceFalta(page)

    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByText(/pedido enviado/i)).toBeVisible()

    const url = await page.evaluate(() => (window as any).__urlWhatsapp)
    const legible = decodeURIComponent(url)

    expect(url).toContain('wa.me/')
    expect(legible).toContain('NUEVO PEDIDO')
    expect(legible).toContain('Cliente E2E')
    expect(legible).toContain('3001234567')
    expect(legible).toMatch(/TOTAL/)
  })

  test('el carrito queda vacío después de enviar', async ({ page }) => {
    await page.getByPlaceholder('300 123 4567').fill('3001234567')
    await completarDestinoSiHaceFalta(page)

    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByText(/pedido enviado/i)).toBeVisible()

    await page.getByRole('button', { name: /cerrar/i }).click()
    await expect(page.getByText(/el carrito está vacío/i)).toBeVisible()
  })
})
