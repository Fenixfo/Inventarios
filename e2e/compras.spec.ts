import { test, expect, type Page } from '@playwright/test'
import {
  ADMIN,
  hayCredenciales,
  iniciarSesionUI,
  llamar,
  prisma,
  tiendaDeAdmin,
  tokenDe,
  trabajarEnTienda,
} from './ayudas-compras'

/**
 * El módulo de compras por pantalla, como lo usaría la administradora de la
 * tienda de pruebas: menú, proveedores, nueva compra, anulación, historial en
 * la ficha del producto y uso en el celular.
 *
 * Los datos que crea llevan el prefijo E2E- o TEST- y no se borran.
 */

test.describe.configure({ mode: 'serial' })
test.skip(!hayCredenciales, 'Faltan las credenciales de las cuentas de prueba')

const MARCA = `E2E-${Date.now().toString().slice(-8)}`
let tiendaA: string
let token: string

test.beforeAll(async () => {
  tiendaA = await tiendaDeAdmin()
  token = await tokenDe(ADMIN)
})

test.beforeEach(async ({ page, context }) => {
  await trabajarEnTienda(context, tiendaA)
  await iniciarSesionUI(page, ADMIN)
})

// --- Datos de apoyo, creados directo para no depender de otras pantallas ---

let secuencia = 0
async function crearProducto(datos: { nombre?: string; stockActual?: number; costo?: number } = {}) {
  secuencia += 1
  const sufijo = `${MARCA}-${secuencia}`
  return prisma.producto.create({
    data: {
      tiendaId: tiendaA,
      sku: `${sufijo}`,
      // Un nombre sin palabras en común con el resto, para que no salten avisos de parecidos.
      nombre: datos.nombre ?? `Zq${Math.random().toString(36).slice(2, 10)}x ${Date.now()}`,
      categoria: 'ceramica',
      precioUnitario: 50000,
      stockActual: datos.stockActual ?? 0,
      costo: datos.costo ?? null,
      activo: true,
    },
  })
}

async function crearProveedor() {
  secuencia += 1
  return prisma.proveedor.create({ data: { tiendaId: tiendaA, nombre: `${MARCA} Proveedor ${secuencia}` } })
}

/** Registra una compra por la API (para tener algo que abrir o anular). */
async function compraPorApi(proveedorId: string, items: unknown[]) {
  const r = await llamar(token, tiendaA, '/api/compras', {
    method: 'POST',
    cuerpo: { proveedorId, fecha: '2026-10-03', items },
  })
  expect(r.status).toBe(201)
  return r.cuerpo.id as string
}

/** Que la página no se pueda desplazar de lado (RNF-7). */
async function sinDesplazamientoHorizontal(page: Page) {
  const { ancho, visible } = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    visible: window.innerWidth,
  }))
  expect(ancho, `la página mide ${ancho}px y la pantalla ${visible}px`).toBeLessThanOrEqual(visible + 1)
}

/** El botón que despliega "Más datos del producto" de la línea n (empezando en 0). */
const masDatos = (page: Page, n: number) => page.getByRole('button', { name: /Más datos del producto/ }).nth(n)

/**
 * Busca un proveedor en el selector y lo elige. El resultado tarda un instante
 * (la búsqueda espera una pausa) y el botón "+ Crear proveedor «nombre»" también
 * contiene el nombre: por eso se pide el que EMPIEZA por el nombre.
 */
async function elegirProveedor(page: Page, nombre: string, etiqueta = 'Proveedor *') {
  await page.getByLabel(etiqueta, { exact: true }).fill(nombre)
  await page.getByRole('button', { name: new RegExp(`^${nombre}`) }).click()
}

test.describe('menú y proveedores', () => {
  test('el menú tiene el grupo Compras con Compras y Proveedores, y se navega a ellos', async ({ page }) => {
    await page.goto('/admin')

    await page.getByRole('button', { name: /Compras/ }).click()
    await expect(page.getByRole('link', { name: /Proveedores/ })).toBeVisible()

    await page.getByRole('link', { name: /Proveedores/ }).click()
    await expect(page).toHaveURL(/\/admin\/proveedores$/)
    await expect(page.getByRole('heading', { name: 'Proveedores' })).toBeVisible()

    // Compras sigue en el mismo grupo, que se mantiene abierto en esta sección.
    await page.getByRole('link', { name: /^🧾?\s*Compras$/ }).click()
    await expect(page).toHaveURL(/\/admin\/compras$/)
    await expect(page.getByRole('heading', { name: 'Compras' })).toBeVisible()
  })

  test('crea un proveedor, lo encuentra buscándolo y un NIT repetido da error', async ({ page }) => {
    const nombre = `${MARCA} Proveedor creado`
    const nit = `NIT-${MARCA}`

    await page.goto('/admin/proveedores')
    await page.getByRole('button', { name: '+ Nuevo proveedor' }).click()
    await page.getByLabel('Nombre *').fill(nombre)
    await page.getByLabel('NIT').fill(nit)
    await page.getByRole('button', { name: 'Crear proveedor' }).click()

    // El formulario se cierra y el proveedor se encuentra buscándolo.
    await expect(page.getByRole('heading', { name: 'Nuevo proveedor' })).toBeHidden()
    await page.getByPlaceholder('Nombre o NIT').fill(nombre)
    await page.getByPlaceholder('Nombre o NIT').press('Enter')
    await expect(page.getByRole('cell', { name: nombre })).toBeVisible()

    // Otro con el mismo NIT: el servidor lo rechaza y el formulario sigue abierto.
    await page.getByRole('button', { name: '+ Nuevo proveedor' }).click()
    await page.getByLabel('Nombre *').fill(`${nombre} otro`)
    await page.getByLabel('NIT').fill(nit)
    await page.getByRole('button', { name: 'Crear proveedor' }).click()
    await expect(page.getByText('Ya hay un proveedor con ese NIT en esta tienda')).toBeVisible()
  })
})

test.describe('nueva compra', () => {
  test('registra una compra con un producto existente, uno nuevo y flete, y lleva al detalle', async ({ page }) => {
    const proveedor = await crearProveedor()
    const existente = await crearProducto({ stockActual: 5, costo: 1000 })
    const skuNuevo = `${MARCA}-NUEVO`

    page.on('dialog', (d) => d.accept())

    await page.goto('/admin/compras/nueva')

    // Encabezado: proveedor (se busca y se elige), fecha y factura.
    await elegirProveedor(page, proveedor.nombre)
    await expect(page.getByText(proveedor.nombre)).toBeVisible()
    await page.getByLabel('Número de factura del proveedor').fill(`${MARCA}-F`)

    // Línea 1: un producto que ya existe. Al salir del SKU se reconoce.
    await page.getByLabel('SKU *').nth(0).fill(existente.sku)
    await page.getByLabel('SKU *').nth(0).press('Tab')
    await expect(page.getByText('Existente', { exact: true })).toBeVisible()
    await page.getByLabel('Cantidad *').nth(0).fill('10')
    await page.getByLabel('Precio de factura (por unidad) *').nth(0).fill('2000')
    // El color está en la sección plegada "Más datos del producto".
    await masDatos(page, 0).click()
    await page.getByLabel('Color').nth(0).fill('Gris')

    // Línea 2: un producto nuevo.
    await page.getByRole('button', { name: '+ Agregar línea' }).click()
    await page.getByLabel('SKU *').nth(1).fill(skuNuevo)
    await page.getByLabel('SKU *').nth(1).press('Tab')
    await expect(page.getByText('Se creará', { exact: true })).toBeVisible()
    await page.getByLabel('Nombre del producto *').fill(`Zq${Math.random().toString(36).slice(2, 10)}x nuevo ${Date.now()}`)
    await page.getByPlaceholder('Escribe o elige una categoría').fill('ceramica')
    await page.getByPlaceholder('Escribe o elige una categoría').press('Enter')
    await page.getByLabel('Precio al público *').fill('9000')
    await page.getByLabel('Cantidad *').nth(1).fill('4')
    await page.getByLabel('Precio de factura (por unidad) *').nth(1).fill('3000')

    // Costos adicionales: 1.400 de flete, repartidos por valor.
    await page.getByRole('button', { name: '+ Agregar costo adicional' }).click()
    await page.getByLabel('Concepto').fill('Flete')
    await page.getByLabel('Valor', { exact: true }).fill('1400')

    // El costo final de cada línea se calcula solo: 2000 + 875/10 y 3000 + 525/4.
    await expect(page.getByLabel('Costo final por unidad').nth(0)).toHaveValue('2087.5')
    await expect(page.getByLabel('Costo final por unidad').nth(1)).toHaveValue('3131.25')

    // Se espera la respuesta del servidor: si algo falla, el cuerpo dice por qué.
    const [respuesta] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/compras') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Registrar compra' }).click(),
    ])
    expect(respuesta.status(), await respuesta.text()).toBe(201)

    await expect(page).toHaveURL(/\/admin\/compras\/[0-9a-f-]{36}$/, { timeout: 45000 })
    await expect(page.getByRole('heading', { name: new RegExp(`Compra a ${proveedor.nombre}`) })).toBeVisible()

    // Los efectos quedaron en la base.
    const actualizado = await prisma.producto.findUnique({ where: { id: existente.id } })
    expect(Number(actualizado!.stockActual)).toBe(15)
    expect(Number(actualizado!.costo)).toBe(2087.5)
    expect(actualizado!.color).toBe('Gris')

    const nuevo = await prisma.producto.findFirst({ where: { tiendaId: tiendaA, sku: skuNuevo } })
    expect(Number(nuevo!.stockActual)).toBe(4)
    expect(Number(nuevo!.costo)).toBe(3131.25)
    expect(nuevo!.imagenUrl).toBeNull()

    const compraId = page.url().split('/').pop()!
    expect(await prisma.inventarioMovimiento.count({ where: { referenciaTipo: 'compra', referenciaId: compraId } })).toBe(2)
  })

  test('una línea incompleta no se guarda y se señala qué falta', async ({ page }) => {
    const proveedor = await crearProveedor()
    const producto = await crearProducto()

    await page.goto('/admin/compras/nueva')
    await elegirProveedor(page, proveedor.nombre)

    await page.getByLabel('SKU *').fill(producto.sku)
    await page.getByLabel('SKU *').press('Tab')
    await expect(page.getByText('Existente', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Registrar compra' }).click()

    await expect(page.getByText('Revisa las líneas marcadas antes de guardar.')).toBeVisible()
    await expect(page.getByText('La cantidad debe ser mayor que cero')).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/compras\/nueva$/)
  })

  test('un nombre parecido al de otro producto pide decidir, y "Es este producto" usa ese producto', async ({ page }) => {
    const nombre = `Mosaico Ladrillo Verde ${Date.now()}`
    const parecido = await crearProducto({ nombre })

    await page.goto('/admin/compras/nueva')
    await page.getByLabel('SKU *').fill(`${MARCA}-OTRO-SKU`)
    await page.getByLabel('SKU *').press('Tab')
    await page.getByLabel('Nombre del producto *').fill(nombre)
    await page.getByLabel('Nombre del producto *').press('Tab')

    await expect(page.getByText(/se parece al de productos que ya tienes/i)).toBeVisible()
    await expect(page.getByText(parecido.sku)).toBeVisible()

    // Pueden salir también productos parecidos de ejecuciones anteriores: se elige la fila de este.
    await page
      .locator('div')
      .filter({ hasText: parecido.sku })
      .filter({ has: page.getByRole('button', { name: 'Es este producto' }) })
      .last()
      .getByRole('button', { name: 'Es este producto' })
      .click()

    await expect(page.getByText('Existente', { exact: true })).toBeVisible()
    await expect(page.getByLabel('SKU *')).toHaveValue(parecido.sku)
  })

  test('"No, crear uno nuevo" descarta el aviso y deja la línea como nueva', async ({ page }) => {
    const nombre = `Cenefa Dorada Fina ${Date.now()}`
    await crearProducto({ nombre })

    await page.goto('/admin/compras/nueva')
    await page.getByLabel('SKU *').fill(`${MARCA}-CENEFA`)
    await page.getByLabel('SKU *').press('Tab')
    await page.getByLabel('Nombre del producto *').fill(nombre)
    await page.getByLabel('Nombre del producto *').press('Tab')

    await page.getByRole('button', { name: 'No, crear uno nuevo' }).click()

    await expect(page.getByText('Se creará', { exact: true })).toBeVisible()
    await expect(page.getByText(/se parece al de productos que ya tienes/i)).toBeHidden()
  })

  test('un SKU que existe se reconoce y muestra lo que el producto ya tiene', async ({ page }) => {
    const producto = await crearProducto({ stockActual: 7, costo: 1234 })
    await prisma.producto.update({ where: { id: producto.id }, data: { color: 'Blanco' } })

    await page.goto('/admin/compras/nueva')
    await page.getByLabel('SKU *').fill(producto.sku)
    await page.getByLabel('SKU *').press('Tab')

    await expect(page.getByText(/Stock actual 7/)).toBeVisible()
    // Escribir otro color avisa que no se cambiará: abierto, con el detalle; plegado, en el resumen.
    await masDatos(page, 0).click()
    await page.getByLabel('Color').fill('Gris')
    await expect(page.getByText(/ya tiene «Blanco»; no se cambiará/)).toBeVisible()
    await masDatos(page, 0).click()
    await expect(masDatos(page, 0)).toContainText('1 diferencia')
  })
})

test.describe('detalle, anulación e historial', () => {
  test('el detalle muestra la compra y se anula con motivo devolviendo el stock', async ({ page }) => {
    const proveedor = await crearProveedor()
    const producto = await crearProducto({ stockActual: 3, costo: 50 })
    const compraId = await compraPorApi(proveedor.id, [
      { productoId: producto.id, sku: producto.sku, cantidad: 10, precioFactura: 200 },
    ])
    expect(Number((await prisma.producto.findUnique({ where: { id: producto.id } }))!.stockActual)).toBe(13)

    page.on('dialog', (d) => d.accept())
    await page.goto(`/admin/compras/${compraId}`)

    await expect(page.getByRole('heading', { name: new RegExp(`Compra a ${proveedor.nombre}`) })).toBeVisible()
    await expect(page.getByRole('link', { name: producto.nombre })).toBeVisible()

    await page.getByRole('button', { name: 'Anular compra' }).click()
    // Sin motivo no se anula.
    await page.getByRole('button', { name: 'Confirmar anulación' }).click()
    await expect(page.getByText('Escribe el motivo de la anulación.')).toBeVisible()

    await page.getByLabel('Motivo *').fill('Factura registrada dos veces')
    await page.getByRole('button', { name: 'Confirmar anulación' }).click()

    await expect(page.getByText('ANULADA')).toBeVisible({ timeout: 30000 })
    await expect(page.getByText(/Revisa el costo de los/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Anular compra' })).toBeHidden()

    expect(Number((await prisma.producto.findUnique({ where: { id: producto.id } }))!.stockActual)).toBe(3)
  })

  test('si lo comprado ya se vendió, la anulación se bloquea y dice cuánto falta', async ({ page }) => {
    const proveedor = await crearProveedor()
    const producto = await crearProducto({ stockActual: 0 })
    const compraId = await compraPorApi(proveedor.id, [
      { productoId: producto.id, sku: producto.sku, cantidad: 10, precioFactura: 100 },
    ])
    // Se "vendieron" 7: quedan 3 y no alcanza para devolver los 10.
    await prisma.producto.update({ where: { id: producto.id }, data: { stockActual: 3 } })

    page.on('dialog', (d) => d.accept())
    await page.goto(`/admin/compras/${compraId}`)
    await page.getByRole('button', { name: 'Anular compra' }).click()
    await page.getByLabel('Motivo *').fill('Prueba de stock insuficiente')
    await page.getByRole('button', { name: 'Confirmar anulación' }).click()

    await expect(page.getByText(/No se puede anular: ya no hay stock suficiente/)).toBeVisible()
    await expect(page.getByText(/faltan 7/)).toBeVisible()
    await expect(page.getByText('ANULADA')).toBeHidden()
    expect((await prisma.compra.findUnique({ where: { id: compraId } }))!.estado).toBe('registrada')
  })

  test('la lista muestra la compra y la ficha del producto trae su historial', async ({ page }) => {
    const proveedor = await crearProveedor()
    const producto = await crearProducto({ stockActual: 0 })
    const compraId = await compraPorApi(proveedor.id, [
      { productoId: producto.id, sku: producto.sku, cantidad: 2, precioFactura: 100 },
    ])

    // La lista, filtrada por ese proveedor.
    await page.goto('/admin/compras')
    await elegirProveedor(page, proveedor.nombre, 'Proveedor')
    await expect(page.getByRole('link', { name: 'Ver' })).toHaveAttribute('href', `/admin/compras/${compraId}`)

    // La ficha del producto.
    await page.goto(`/admin/productos/${producto.id}`)
    await expect(page.getByRole('heading', { name: 'Historial de compras' })).toBeVisible()
    await expect(page.getByRole('cell', { name: proveedor.nombre })).toBeVisible()
    await expect(page.getByRole('link', { name: /\d{2}\/\d{2}\/\d{4}/ })).toHaveAttribute('href', `/admin/compras/${compraId}`)
  })
})

test.describe('en el celular', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('la página de nueva compra, con dos líneas y costos adicionales, no se desplaza de lado', async ({ page }) => {
    const producto = await crearProducto()

    await page.goto('/admin/compras/nueva')
    await page.getByLabel('SKU *').nth(0).fill(producto.sku)
    await page.getByLabel('SKU *').nth(0).press('Tab')
    await expect(page.getByText('Existente', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: '+ Agregar línea' }).click()
    await page.getByLabel('SKU *').nth(1).fill(`${MARCA}-MOVIL`)
    await page.getByLabel('SKU *').nth(1).press('Tab')
    await expect(page.getByText('Se creará', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: '+ Agregar costo adicional' }).click()

    await sinDesplazamientoHorizontal(page)
    await page.screenshot({ path: 'test-results/compras-nueva-movil.png', fullPage: true })

    // Con lo opcional plegado la página es bastante más corta que cuando todo estaba abierto
    // (con dos líneas medía unos 4.600 px). El tope deja margen por diferencias de tipografía.
    const plegada = await page.evaluate(() => document.documentElement.scrollHeight)
    expect(plegada, `la página plegada mide ${plegada}px`).toBeLessThan(3400)

    // Abrir las dos secciones la alarga, y sigue sin desplazarse de lado.
    await masDatos(page, 0).click()
    await masDatos(page, 1).click()
    const abierta = await page.evaluate(() => document.documentElement.scrollHeight)
    expect(abierta).toBeGreaterThan(plegada + 400)
    await sinDesplazamientoHorizontal(page)
  })

  test('la lista, el detalle y los proveedores tampoco se desplazan de lado', async ({ page }) => {
    const proveedor = await crearProveedor()
    const producto = await crearProducto()
    const compraId = await compraPorApi(proveedor.id, [
      { productoId: producto.id, sku: producto.sku, cantidad: 2, precioFactura: 100 },
    ])

    for (const ruta of ['/admin/compras', `/admin/compras/${compraId}`, '/admin/proveedores']) {
      await page.goto(ruta)
      await expect(page.getByRole('heading').first()).toBeVisible()
      await sinDesplazamientoHorizontal(page)
    }
  })
})
