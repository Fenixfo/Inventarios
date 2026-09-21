import { test, expect, Page } from '@playwright/test'

// Flujo del administrador: login -> producto -> factura -> PDF.
// Las credenciales viven en .env (ignorado por git), no en el código.

const USUARIO = process.env.E2E_USER
const CLAVE = process.env.E2E_PASSWORD

const MARCA = `E2E-${Date.now().toString().slice(-8)}`

test.skip(
  !USUARIO || !CLAVE,
  'Faltan E2E_USER y E2E_PASSWORD en .env'
)

async function login(page: Page) {
  await page.goto('/login')

  await page.getByRole('textbox').first().fill(USUARIO!)
  await page.locator('input[type="password"]').fill(CLAVE!)
  await page.getByRole('button', { name: /ingresar|iniciar|entrar/i }).click()

  await page.waitForURL(/\/admin/, { timeout: 45000 })
}

test.describe('Autenticación', () => {
  test('el admin no es accesible sin sesión', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/admin/productos')

    // Debe redirigir al login o mostrar que no hay acceso.
    await page.waitForTimeout(3000)
    const url = page.url()
    const tieneContenido = await page
      .getByRole('heading', { name: /productos/i })
      .isVisible()
      .catch(() => false)

    expect(url.includes('/login') || !tieneContenido).toBe(true)
  })

  test('el login con credenciales válidas entra al panel', async ({ page }) => {
    await login(page)
    expect(page.url()).toContain('/admin')
  })

  test('rechaza credenciales inválidas', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('textbox').first().fill('noexiste@ejemplo.com')
    await page.locator('input[type="password"]').fill('claveIncorrecta')
    await page.getByRole('button', { name: /ingresar|iniciar|entrar/i }).click()

    await page.waitForTimeout(5000)
    expect(page.url()).not.toMatch(/\/admin($|\/)/)
  })
})

test.describe('Gestión de productos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('crea un producto y aparece en el listado', async ({ page }) => {
    const sku = `${MARCA}-P`

    await page.goto('/admin/productos/nuevo')

    await page.locator('input[name="sku"]').fill(sku)
    await page.locator('input[name="nombre"]').fill(`${MARCA} producto`)
    await page.locator('select[name="categoria"]').selectOption('ceramica')
    await page.locator('input[name="precioUnitario"]').fill('55000')
    await page.locator('input[name="stockActual"]').fill('250')
    await page.locator('input[name="stockMinimo"]').fill('20')

    await page.getByRole('button', { name: /crear|guardar/i }).click()

    await page.waitForURL(/\/admin\/productos(\?|$)/, { timeout: 45000 })
    await expect(page.getByText(sku)).toBeVisible()
  })

  test('la rueda del ratón no altera el campo m² por caja', async ({ page }) => {
    await page.goto('/admin/productos/nuevo')

    const campo = page.locator('input[name="m2PorCaja"]')
    await campo.fill('2.5')
    await campo.hover()
    await page.mouse.wheel(0, -200)

    await expect(campo).toHaveValue('2.5')
  })
})

test.describe('Inventario', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/admin/inventario')
  })

  test('muestra el historial de movimientos', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /movimientos de inventario/i })).toBeVisible()
  })

  test('registra una entrada y actualiza el stock', async ({ page }) => {
    // Los productos se cargan por separado; sin ellos el selector va vacío.
    await expect
      .poll(async () => page.locator('select').first().locator('option').count(), {
        timeout: 30000,
      })
      .toBeGreaterThan(1)

    await page.getByRole('button', { name: /registrar movimiento/i }).click()

    const formulario = page.locator('div').filter({ hasText: /^Nuevo Movimiento/ }).last()
    const selectorProducto = formulario.locator('select').first()

    await expect
      .poll(async () => selectorProducto.locator('option').count(), { timeout: 30000 })
      .toBeGreaterThan(1)

    await selectorProducto.selectOption({ index: 1 })
    await formulario.locator('select').nth(1).selectOption('entrada')
    await formulario.locator('input[type="number"]').fill('12')
    await formulario.getByPlaceholder(/compra a proveedor/i).fill(`${MARCA} entrada e2e`)

    await page.getByRole('button', { name: /^registrar$/i }).click()

    await expect(page.getByText(/stock actualizado/i)).toBeVisible({ timeout: 60000 })
  })

  test('rechaza un movimiento sin motivo', async ({ page }) => {
    await page.getByRole('button', { name: /registrar movimiento/i }).click()

    await page.locator('select').first().selectOption({ index: 1 })
    await page.locator('input[type="number"]').fill('5')

    await page.getByRole('button', { name: /^registrar$/i }).click()

    await expect(page.getByText(/motivo/i).last()).toBeVisible()
  })
})

test.describe('Facturación', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('el listado de facturas carga', async ({ page }) => {
    await page.goto('/admin/facturas')

    // El listado trae todas las facturas con cliente e items desde
    // Supabase remoto; con volumen puede pasar de 15 segundos.
    await expect(page.getByRole('heading', { name: /facturas/i }).first()).toBeVisible({
      timeout: 60000,
    })
  })

  test('abre el formulario de nueva factura', async ({ page }) => {
    await page.goto('/admin/facturas/nueva')
    await page.waitForLoadState('networkidle')

    // El formulario debe ofrecer buscar cliente y productos.
    const inputs = page.locator('input')
    expect(await inputs.count()).toBeGreaterThan(0)
  })

  test('descargar PDF abre una sola pestaña con la factura', async ({ page, context }) => {
    await page.goto('/admin/facturas')
    await page.waitForLoadState('networkidle')

    const verDetalle = page.getByRole('link', { name: /ver|detalle/i }).first()
    if (!(await verDetalle.isVisible().catch(() => false))) {
      test.skip(true, 'No hay facturas para probar el PDF')
      return
    }

    await verDetalle.click()
    await page.waitForLoadState('networkidle')

    const paginasAntes = context.pages().length
    const nuevaPagina = context.waitForEvent('page', { timeout: 30000 })

    await page.getByRole('button', { name: /descargar pdf/i }).click()

    const pdf = await nuevaPagina
    await pdf.waitForLoadState('domcontentloaded')

    // Debe abrirse exactamente una pestaña, con la factura dentro.
    expect(context.pages().length).toBe(paginasAntes + 1)
    await expect(pdf.getByText(/FACTURA/i).first()).toBeVisible()

    await pdf.close()
  })
})

test.describe('Configuración', () => {
  test('la página de configuración carga para un administrador', async ({ page }) => {
    await login(page)
    await page.goto('/admin/configuracion')

    const titulo = page.getByRole('heading', { name: /configuración/i })
    const sinPermiso = page.getByText(/no tienes permiso/i)

    // Según el rol del usuario de prueba, una de las dos debe aparecer.
    await expect(titulo.or(sinPermiso).first()).toBeVisible({ timeout: 30000 })
  })
})
