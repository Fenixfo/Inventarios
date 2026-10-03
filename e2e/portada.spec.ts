import { test, expect } from '@playwright/test'

/**
 * La portada pública muestra por defecto los productos de una sola tienda:
 * LAMINADOS Y CERAMICAS BERACA JJ. Se elige por id (no por nombre, porque otra
 * tienda también tiene "Beraca" en el suyo) y el visitante puede cambiar a
 * "Todas las tiendas" o a otra.
 *
 * No necesita cuentas: la portada es pública y esta prueba solo la lee.
 */

const TIENDA_PRINCIPAL = '4fdb5356-4b10-4120-a183-c2a59979878f'

test('la portada arranca con los productos de la tienda principal', async ({ page }) => {
  const pedido = page.waitForRequest(
    (r) => r.url().includes('/api/productos/catalogo?') && r.url().includes(`tienda=${TIENDA_PRINCIPAL}`),
    { timeout: 60000 }
  )
  await page.goto('/')
  const peticion = await pedido

  // Pide los productos de esa tienda por tandas, no la muestra de todas las tiendas.
  const params = new URL(peticion.url()).searchParams
  expect(params.get('tienda')).toBe(TIENDA_PRINCIPAL)
  expect(params.has('limitePorTienda')).toBe(false)

  // El desplegable de tiendas la tiene elegida, y "Todas las tiendas" sigue disponible.
  const selector = page.locator('select', { hasText: 'Todas las tiendas' })
  await expect(selector).toHaveValue(TIENDA_PRINCIPAL)
  await expect(selector.locator('option', { hasText: 'Todas las tiendas' })).toHaveCount(1)

  // Y todo lo que se muestra es de esa tienda.
  const respuesta = await (await peticion.response())!.json()
  expect(respuesta.productos.length).toBeGreaterThan(0)
  for (const producto of respuesta.productos) {
    expect(producto.tienda.id).toBe(TIENDA_PRINCIPAL)
  }
})

test('elegir "Todas las tiendas" muestra la muestra de varias tiendas y no se vuelve a imponer la principal', async ({ page }) => {
  await page.goto('/')
  const selector = page.locator('select', { hasText: 'Todas las tiendas' })
  await expect(selector).toHaveValue(TIENDA_PRINCIPAL)

  const pedido = page.waitForRequest((r) => r.url().includes('/api/productos/catalogo?') && r.url().includes('limitePorTienda'))
  await selector.selectOption('')
  await pedido

  // Sigue en "Todas" aunque se vuelvan a cargar los filtros.
  await page.waitForTimeout(1500)
  await expect(selector).toHaveValue('')
})
