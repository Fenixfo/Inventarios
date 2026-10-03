import { test, expect, type Page } from '@playwright/test'
import {
  ADMIN,
  BASE,
  CUENTA_B,
  fijarPermisos,
  hayCredenciales,
  iniciarSesionUI,
  llamar,
  prisma,
  tiendaDeAdmin,
  tiendaPropiaDe,
  tokenDe,
  trabajarEnTienda,
} from './ayudas-compras'

/**
 * Permisos y aislamiento entre tiendas del módulo de compras, con la cuenta B:
 *
 *  - En la tienda de pruebas A, B es una persona más y la administradora le va
 *    dando distintos permisos: sin ninguno, solo ver, ver y registrar (sin poder
 *    crear productos), y todos.
 *  - B además es dueña de su propia tienda, así que con una sola cuenta se puede
 *    pedir lo de A estando "en" la otra tienda: nada de A debe verse ni tocarse.
 *
 * Requiere haber corrido antes compras-preparacion.spec.ts.
 * Los datos que crea llevan el prefijo E2E- y no se borran.
 */

test.describe.configure({ mode: 'serial' })
test.skip(!hayCredenciales, 'Faltan las credenciales de las cuentas de prueba')

const MARCA = `E2E-${Date.now().toString().slice(-8)}`
const SIN_COMPRAS: string[] = []
const SOLO_VER = ['compras.ver']
const VER_Y_REGISTRAR = ['compras.ver', 'compras.crear'] // sin productos.crear
const TODOS = ['compras.ver', 'compras.crear', 'compras.anular', 'productos.crear']

let tiendaA: string
let tiendaB: string
let usuarioB: string
let tokenAdmin: string
let tokenB: string

// Lo que existe en la tienda A, creado por la administradora.
let proveedorA: { id: string; nombre: string }
let productoA: { id: string; sku: string }
let compraA: string

let secuencia = 0
async function productoNuevoEnA() {
  secuencia += 1
  return prisma.producto.create({
    data: {
      tiendaId: tiendaA,
      sku: `${MARCA}-P${secuencia}`,
      nombre: `Zq${Math.random().toString(36).slice(2, 10)}x ${Date.now()}`,
      categoria: 'ceramica',
      precioUnitario: 50000,
      stockActual: 0,
      activo: true,
    },
  })
}

/** Una línea de producto nuevo con un nombre que no se parece a nada. */
const lineaNueva = (sku: string) => ({
  sku,
  nombre: `Zq${Math.random().toString(36).slice(2, 10)}x ${Date.now()}`,
  categoria: 'ceramica',
  precioUnitario: 9000,
  cantidad: 2,
  precioFactura: 1000,
})

async function comoB(permisos: string[]) {
  await fijarPermisos(tokenAdmin, tiendaA, usuarioB, permisos)
}

// Un PNG de 1×1, para probar la subida de imágenes sin depender de ningún archivo.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

async function subirImagen(token: string, tiendaId: string) {
  const form = new FormData()
  form.append('archivo', new File([PNG_1X1], 'prueba.png', { type: 'image/png' }))
  form.append('carpeta', 'productos')

  const res = await fetch(`${BASE}/api/upload/imagen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-tienda-id': tiendaId },
    body: form,
  })
  return { status: res.status, cuerpo: await res.json().catch(() => null) }
}

async function borrarImagenSubida(token: string, tiendaId: string, ruta: string) {
  const res = await fetch(`${BASE}/api/upload/imagen?ruta=${encodeURIComponent(ruta)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'x-tienda-id': tiendaId },
  })
  return res.status
}

test.beforeAll(async () => {
  tiendaA = await tiendaDeAdmin()
  const propia = await tiendaPropiaDe(CUENTA_B)
  if (!propia) throw new Error('B no tiene su tienda: corre primero compras-preparacion.spec.ts')
  tiendaB = propia

  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: CUENTA_B.email! }, select: { id: true } })
  usuarioB = usuario.id

  const miembro = await prisma.usuarioTienda.findFirst({ where: { usuarioId: usuarioB, tiendaId: tiendaA } })
  if (!miembro) throw new Error('B no es miembro de A: corre primero compras-preparacion.spec.ts')

  tokenAdmin = await tokenDe(ADMIN)
  tokenB = await tokenDe(CUENTA_B)

  // Lo de la tienda A que B no debería poder tocar desde la otra tienda.
  proveedorA = await prisma.proveedor.create({
    data: { tiendaId: tiendaA, nombre: `${MARCA} Proveedor de A` },
    select: { id: true, nombre: true },
  })
  productoA = await productoNuevoEnA()
  const r = await llamar(tokenAdmin, tiendaA, '/api/compras', {
    method: 'POST',
    cuerpo: {
      proveedorId: proveedorA.id,
      fecha: '2026-10-03',
      items: [{ productoId: productoA.id, sku: productoA.sku, cantidad: 5, precioFactura: 100 }],
    },
  })
  expect(r.status).toBe(201)
  compraA = r.cuerpo.id
})

test.afterAll(async () => {
  // Mínimo privilegio: B no queda con permisos de compras en A.
  await comoB(SIN_COMPRAS)
})

async function entrarComoB(page: Page, tienda: string) {
  await trabajarEnTienda(page.context(), tienda)
  await iniciarSesionUI(page, CUENTA_B)
}

test.describe('sin ningún permiso de compras', () => {
  test.beforeAll(async () => {
    await comoB(SIN_COMPRAS)
  })

  test('el menú no muestra Compras y la API responde 403', async ({ page }) => {
    await entrarComoB(page, tiendaA)
    await page.goto('/admin')
    await expect(page.getByRole('link', { name: /Dashboard/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Compras/ })).toHaveCount(0)

    // Tampoco se entra escribiendo la dirección a mano.
    await page.goto('/admin/compras')
    await expect(page.getByRole('heading', { name: 'Compras' })).toHaveCount(0)

    for (const [ruta, metodo] of [
      ['/api/compras', 'GET'],
      ['/api/proveedores', 'GET'],
      [`/api/compras/${compraA}`, 'GET'],
      [`/api/productos/${productoA.id}/compras`, 'GET'],
    ] as const) {
      expect((await llamar(tokenB, tiendaA, ruta, { method: metodo })).status, `${metodo} ${ruta}`).toBe(403)
    }
  })

  test('no puede subir imágenes de productos', async () => {
    expect((await subirImagen(tokenB, tiendaA)).status).toBe(403)
  })
})

test.describe('solo compras.ver', () => {
  test.beforeAll(async () => {
    await comoB(SOLO_VER)
  })

  test('ve el menú, la lista y el detalle, pero no los botones de crear ni de anular', async ({ page }) => {
    await entrarComoB(page, tiendaA)
    await page.goto('/admin')

    await page.getByRole('button', { name: /Compras/ }).click()
    await expect(page.getByRole('link', { name: /Proveedores/ })).toBeVisible()

    await page.goto('/admin/compras')
    await expect(page.getByRole('heading', { name: 'Compras' })).toBeVisible()
    await expect(page.getByRole('link', { name: '+ Nueva compra' })).toHaveCount(0)

    await page.goto(`/admin/compras/${compraA}`)
    await expect(page.getByRole('heading', { name: new RegExp(`Compra a ${proveedorA.nombre}`) })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Anular compra' })).toHaveCount(0)

    await page.goto('/admin/proveedores')
    await expect(page.getByRole('heading', { name: 'Proveedores' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Nuevo proveedor' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0)
  })

  test('la API deja leer y rechaza registrar, anular y crear proveedores con 403', async () => {
    expect((await llamar(tokenB, tiendaA, '/api/compras')).status).toBe(200)
    expect((await llamar(tokenB, tiendaA, `/api/compras/${compraA}`)).status).toBe(200)
    expect((await llamar(tokenB, tiendaA, `/api/productos/${productoA.id}/compras`)).status).toBe(200)

    const intento = await llamar(tokenB, tiendaA, '/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId: proveedorA.id,
        fecha: '2026-10-03',
        items: [{ productoId: productoA.id, sku: productoA.sku, cantidad: 1, precioFactura: 10 }],
      },
    })
    expect(intento.status).toBe(403)

    expect((await llamar(tokenB, tiendaA, `/api/compras/${compraA}/anular`, { method: 'POST', cuerpo: { motivo: 'x' } })).status).toBe(403)
    expect((await llamar(tokenB, tiendaA, '/api/proveedores', { method: 'POST', cuerpo: { nombre: `${MARCA} no debe crearse` } })).status).toBe(403)
    expect((await llamar(tokenB, tiendaA, '/api/compras/verificar', { method: 'POST', cuerpo: { lineas: [{ sku: 'X' }] } })).status).toBe(403)

    // Lo rechazado no dejó nada: el stock sigue como estaba y el proveedor no existe.
    expect(Number((await prisma.producto.findUnique({ where: { id: productoA.id } }))!.stockActual)).toBe(5)
    expect(await prisma.proveedor.count({ where: { tiendaId: tiendaA, nombre: `${MARCA} no debe crearse` } })).toBe(0)
  })
})

test.describe('compras.ver y compras.crear, sin poder crear productos', () => {
  test.beforeAll(async () => {
    await comoB(VER_Y_REGISTRAR)
  })

  test('ve "Nueva compra" pero no "Anular compra"', async ({ page }) => {
    await entrarComoB(page, tiendaA)

    await page.goto('/admin/compras')
    await expect(page.getByRole('link', { name: '+ Nueva compra' })).toBeVisible()

    await page.goto(`/admin/compras/${compraA}`)
    await expect(page.getByRole('heading', { name: new RegExp(`Compra a ${proveedorA.nombre}`) })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Anular compra' })).toHaveCount(0)

    await page.goto('/admin/proveedores')
    await expect(page.getByRole('button', { name: '+ Nuevo proveedor' })).toBeVisible()
  })

  test('puede registrar una compra de un producto que ya existe', async () => {
    const producto = await productoNuevoEnA()
    const r = await llamar(tokenB, tiendaA, '/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId: proveedorA.id,
        fecha: '2026-10-03',
        items: [{ productoId: producto.id, sku: producto.sku, cantidad: 3, precioFactura: 100 }],
      },
    })

    expect(r.status).toBe(201)
    expect(Number((await prisma.producto.findUnique({ where: { id: producto.id } }))!.stockActual)).toBe(3)
  })

  test('no puede registrar una compra que crea un producto nuevo (403) y no queda nada', async () => {
    const sku = `${MARCA}-SIN-PERMISO`
    const compras = await prisma.compra.count({ where: { tiendaId: tiendaA } })

    const r = await llamar(tokenB, tiendaA, '/api/compras', {
      method: 'POST',
      cuerpo: { proveedorId: proveedorA.id, fecha: '2026-10-03', items: [lineaNueva(sku)] },
    })

    expect(r.status).toBe(403)
    expect(r.cuerpo.error).toMatch(/permiso de crear productos/)
    expect(await prisma.producto.findFirst({ where: { tiendaId: tiendaA, sku } })).toBeNull()
    expect(await prisma.compra.count({ where: { tiendaId: tiendaA } })).toBe(compras)
  })

  test('la pantalla avisa que no puede crear productos y no deja registrar la compra', async ({ page }) => {
    const proveedor = await prisma.proveedor.create({ data: { tiendaId: tiendaA, nombre: `${MARCA} Proveedor pantalla` } })

    await entrarComoB(page, tiendaA)
    await page.goto('/admin/compras/nueva')

    await page.getByLabel('Proveedor *', { exact: true }).fill(proveedor.nombre)
    await page.getByRole('button', { name: new RegExp(`^${proveedor.nombre}`) }).click()

    await page.getByLabel('SKU *').fill(`${MARCA}-PANTALLA`)
    await page.getByLabel('SKU *').press('Tab')
    await expect(page.getByText('Se creará', { exact: true })).toBeVisible()
    await expect(page.getByText(/crear productos nuevos exige el permiso de crear productos/)).toBeVisible()

    await page.getByLabel('Nombre del producto *').fill(`Zq${Math.random().toString(36).slice(2, 10)}x pantalla`)
    await page.getByPlaceholder('Escribe o elige una categoría').fill('ceramica')
    await page.getByPlaceholder('Escribe o elige una categoría').press('Enter')
    await page.getByLabel('Precio al público *').fill('9000')
    await page.getByLabel('Cantidad *').fill('2')
    await page.getByLabel('Precio de factura (por unidad) *').fill('1000')
    await page.getByRole('button', { name: 'Registrar compra' }).click()

    await expect(page.getByText(/crear productos exige un permiso que no tienes/)).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/compras\/nueva$/)
  })

  test('quien solo registra compras puede subir una imagen y borrar la que acaba de subir', async () => {
    const subida = await subirImagen(tokenB, tiendaA)
    expect(subida.status).toBe(200)
    expect(subida.cuerpo.ruta).toMatch(/^productos\//)

    // Borra solo lo recién subido (es su propia imagen de prueba).
    expect(await borrarImagenSubida(tokenB, tiendaA, subida.cuerpo.ruta)).toBe(200)

    // Pero no puede borrar cualquier imagen, ni salirse de la carpeta.
    expect(await borrarImagenSubida(tokenB, tiendaA, 'productos/../logos/x.png')).toBe(403)
    expect(await borrarImagenSubida(tokenB, tiendaA, 'productos/abc-def.png')).toBe(403)
  })
})

test.describe('con todos los permisos de compras y productos.crear', () => {
  test.beforeAll(async () => {
    await comoB(TODOS)
  })

  test('puede registrar con un producto nuevo y anularla devolviendo el stock', async () => {
    const sku = `${MARCA}-CON-PERMISO`
    const r = await llamar(tokenB, tiendaA, '/api/compras', {
      method: 'POST',
      cuerpo: { proveedorId: proveedorA.id, fecha: '2026-10-03', items: [lineaNueva(sku)] },
    })
    expect(r.status).toBe(201)

    const creado = await prisma.producto.findFirst({ where: { tiendaId: tiendaA, sku } })
    expect(Number(creado!.stockActual)).toBe(2)

    const anulada = await llamar(tokenB, tiendaA, `/api/compras/${r.cuerpo.id}/anular`, {
      method: 'POST',
      cuerpo: { motivo: 'Prueba de permisos' },
    })
    expect(anulada.status).toBe(200)
    expect(Number((await prisma.producto.findUnique({ where: { id: creado!.id } }))!.stockActual)).toBe(0)
  })

  test('ve el botón de anular en una compra registrada', async ({ page }) => {
    await entrarComoB(page, tiendaA)
    await page.goto(`/admin/compras/${compraA}`)
    await expect(page.getByRole('button', { name: 'Anular compra' })).toBeVisible()
  })
})

test.describe('aislamiento entre tiendas: B en su propia tienda pide lo de A', () => {
  test('lo de A no se ve ni se toca desde la otra tienda', async () => {
    const enB = (ruta: string, opciones: { method?: string; cuerpo?: unknown } = {}) => llamar(tokenB, tiendaB, ruta, opciones)

    // Control: en A, con permiso, se ve.
    await comoB(SOLO_VER)
    expect((await llamar(tokenB, tiendaA, `/api/compras/${compraA}`)).status).toBe(200)

    // En B, que es dueña, tiene todos los permisos, pero la compra y el proveedor son de A.
    expect((await enB(`/api/compras/${compraA}`)).status).toBe(404)
    expect((await enB(`/api/proveedores/${proveedorA.id}`)).status).toBe(404)
    expect((await enB(`/api/proveedores/${proveedorA.id}`, { method: 'PATCH', cuerpo: { nombre: `${MARCA} cambiado` } })).status).toBe(404)
    expect((await enB(`/api/productos/${productoA.id}/compras`)).status).toBe(404)
    expect((await enB(`/api/compras/${compraA}/anular`, { method: 'POST', cuerpo: { motivo: 'desde otra tienda' } })).status).toBe(404)

    // Las listas de B no traen nada de A.
    const lista = await enB('/api/compras?limite=50')
    expect(lista.status).toBe(200)
    expect(lista.cuerpo.compras.map((c: { id: string }) => c.id)).not.toContain(compraA)
    const proveedores = await enB('/api/proveedores?limite=50')
    expect(proveedores.cuerpo.proveedores.map((p: { id: string }) => p.id)).not.toContain(proveedorA.id)

    // No se puede registrar una compra de B con el proveedor ni el producto de A.
    const conProveedorAjeno = await enB('/api/compras', {
      method: 'POST',
      cuerpo: { proveedorId: proveedorA.id, fecha: '2026-10-03', items: [lineaNueva(`${MARCA}-AJENO-1`)] },
    })
    expect(conProveedorAjeno.status).toBe(404)

    const proveedorB = await prisma.proveedor.create({ data: { tiendaId: tiendaB, nombre: `${MARCA} Proveedor de B` } })
    const conProductoAjeno = await enB('/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId: proveedorB.id,
        fecha: '2026-10-03',
        items: [{ productoId: productoA.id, sku: productoA.sku, cantidad: 1, precioFactura: 10 }],
      },
    })
    expect(conProductoAjeno.status).toBe(409)

    // Un SKU de A, visto desde B, no existe: no revela productos ajenos.
    const verificar = await enB('/api/compras/verificar', { method: 'POST', cuerpo: { lineas: [{ sku: productoA.sku }] } })
    expect(verificar.cuerpo.resultados[0].estado).toBe('nuevo')

    // Nada de lo intentado cambió lo de A.
    expect((await prisma.compra.findUnique({ where: { id: compraA } }))!.estado).toBe('registrada')
    expect((await prisma.proveedor.findUnique({ where: { id: proveedorA.id } }))!.nombre).toBe(proveedorA.nombre)
    expect(Number((await prisma.producto.findUnique({ where: { id: productoA.id } }))!.stockActual)).toBe(5)
  })

  test('en la pantalla, la compra de A no se abre desde la tienda B', async ({ page }) => {
    await entrarComoB(page, tiendaB)
    await page.goto(`/admin/compras/${compraA}`)

    await expect(page.getByText('Compra no encontrada')).toBeVisible()
    await expect(page.getByText(proveedorA.nombre)).toHaveCount(0)
  })
})
