// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

// Pruebas de integración del módulo de compras. Corren contra la BD real y el
// servidor de desarrollo, SOLO con la cuenta y la tienda de pruebas. Nada se
// limpia ni se borra: lo que crean lleva el prefijo TEST- y queda como registro.
// Necesitan `compras.sql` ya ejecutado y que la cuenta tenga los permisos
// compras.* en su tienda (o sea administradora).
//
//   npm run test:integration -- tests/integration/compras.test.ts

const prisma = new PrismaClient()
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'
const MARCA = `TEST-${new Date().toISOString().slice(0, 16)}`

let HEADERS: Record<string, string>
let tiendaId: string

async function iniciarSesion(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = process.env.E2E_USER
  const password = process.env.E2E_PASSWORD

  if (!url || !anon || !email || !password) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL, la clave anónima, E2E_USER o E2E_PASSWORD')
  }

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon },
    body: JSON.stringify({ email, password }),
  })

  const datos = await res.json()
  if (!res.ok || !datos.access_token) {
    throw new Error(`No se pudo iniciar sesión como ${email}: ${datos.error_description || res.status}`)
  }

  return datos.access_token
}

async function api(ruta: string, opciones: { method?: string; cuerpo?: unknown } = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    method: opciones.method || 'GET',
    headers: HEADERS,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  })
  const cuerpo = await res.json().catch(() => null)
  return { status: res.status, cuerpo }
}

const nitUnico = () => `NIT-${Date.now()}-${Math.floor(Math.random() * 10000)}`

beforeAll(async () => {
  const token = await iniciarSesion()
  HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // La tienda en la que trabaja la cuenta: la misma que elegiría el servidor.
  const accesos = await prisma.usuarioTienda.findMany({
    where: { usuario: { email: process.env.E2E_USER } },
    include: { permisos: true },
    orderBy: { createdAt: 'asc' },
  })
  if (accesos.length === 0) throw new Error(`${process.env.E2E_USER} no tiene acceso a ninguna tienda`)

  const capacidad = (a: (typeof accesos)[number]) => (a.esOwner ? 1000 : a.esAdmin ? 500 : a.permisos.length)
  tiendaId = [...accesos].sort((x, y) => capacidad(y) - capacidad(x))[0].tiendaId
})

// Un producto propio de las pruebas, para no depender del catálogo real. Se
// crea directo en la base de la tienda de pruebas, con prefijo TEST-, y no se borra.
let secuencia = 0
async function crearProducto(datos: { sku?: string; nombre?: string; stockActual?: number; costo?: number } = {}) {
  secuencia += 1
  const sufijo = `${Date.now().toString().slice(-7)}${secuencia}`
  return prisma.producto.create({
    data: {
      tiendaId,
      sku: datos.sku ?? `TEST-C${sufijo}`,
      nombre: datos.nombre ?? `${MARCA} producto compra ${sufijo}`,
      categoria: 'ceramica',
      precioUnitario: 50000,
      stockActual: datos.stockActual ?? 0,
      costo: datos.costo ?? null,
      activo: true,
    },
  })
}

// ---------------------------------------------------------------------------
// TASK-4 — Proveedores
// ---------------------------------------------------------------------------
describe('proveedores', () => {
  it('crea un proveedor con solo el nombre y lo deja en la tienda de la sesión', async () => {
    const r = await api('/api/proveedores', {
      method: 'POST',
      // Un tiendaId en el cuerpo se descarta: la tienda sale de la sesión.
      cuerpo: { nombre: `${MARCA} Solo nombre`, tiendaId: '00000000-0000-4000-8000-000000000000' },
    })

    expect(r.status).toBe(201)
    expect(r.cuerpo.nit).toBeNull()
    expect(r.cuerpo.telefono).toBeNull()
    expect(r.cuerpo.tiendaId).toBe(tiendaId)
  })

  it('rechaza un nombre vacío', async () => {
    const r = await api('/api/proveedores', { method: 'POST', cuerpo: { nombre: '   ' } })
    expect(r.status).toBe(400)
  })

  it('un NIT repetido en la misma tienda responde 409', async () => {
    const nit = nitUnico()
    const primero = await api('/api/proveedores', { method: 'POST', cuerpo: { nombre: `${MARCA} NIT A`, nit } })
    expect(primero.status).toBe(201)

    const repetido = await api('/api/proveedores', { method: 'POST', cuerpo: { nombre: `${MARCA} NIT B`, nit } })
    expect(repetido.status).toBe(409)
    expect(repetido.cuerpo.error).toMatch(/NIT/)
  })

  it('varios proveedores sin NIT, o con NIT en blanco, no chocan entre sí', async () => {
    const a = await api('/api/proveedores', { method: 'POST', cuerpo: { nombre: `${MARCA} Sin NIT 1`, nit: '' } })
    const b = await api('/api/proveedores', { method: 'POST', cuerpo: { nombre: `${MARCA} Sin NIT 2`, nit: '   ' } })
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)
    expect(b.cuerpo.nit).toBeNull()
  })

  it('edita un proveedor y un NIT repetido al editar responde 409', async () => {
    const nitA = nitUnico()
    const nitB = nitUnico()
    const a = await api('/api/proveedores', { method: 'POST', cuerpo: { nombre: `${MARCA} Editar A`, nit: nitA } })
    const b = await api('/api/proveedores', { method: 'POST', cuerpo: { nombre: `${MARCA} Editar B`, nit: nitB } })

    const editado = await api(`/api/proveedores/${a.cuerpo.id}`, {
      method: 'PATCH',
      cuerpo: { nombre: `${MARCA} Editar A2`, nit: nitA, telefono: '3001234567' },
    })
    expect(editado.status).toBe(200)
    expect(editado.cuerpo.nombre).toBe(`${MARCA} Editar A2`)
    expect(editado.cuerpo.telefono).toBe('3001234567')

    const choque = await api(`/api/proveedores/${b.cuerpo.id}`, {
      method: 'PATCH',
      cuerpo: { nombre: `${MARCA} Editar B`, nit: nitA },
    })
    expect(choque.status).toBe(409)
  })

  it('un proveedor que no existe responde 404 al leer y al editar', async () => {
    const inventado = '11111111-2222-4333-8444-555555555555'
    expect((await api(`/api/proveedores/${inventado}`)).status).toBe(404)
    expect(
      (await api(`/api/proveedores/${inventado}`, { method: 'PATCH', cuerpo: { nombre: 'X' } })).status
    ).toBe(404)
    // Un identificador que ni siquiera es uuid tampoco debe dar 500.
    expect((await api('/api/proveedores/no-es-un-uuid')).status).toBe(404)
  })

  it('lista los proveedores de la tienda y busca por nombre', async () => {
    const nombre = `${MARCA} Buscable ${Date.now().toString().slice(-6)}`
    await api('/api/proveedores', { method: 'POST', cuerpo: { nombre } })

    const lista = await api('/api/proveedores?limite=50')
    expect(lista.status).toBe(200)
    expect(Array.isArray(lista.cuerpo.proveedores)).toBe(true)
    expect(lista.cuerpo.total).toBeGreaterThan(0)

    const busqueda = await api(`/api/proveedores?busqueda=${encodeURIComponent(nombre.toLowerCase())}`)
    expect(busqueda.cuerpo.proveedores.map((p: { nombre: string }) => p.nombre)).toContain(nombre)
  })

  it('sin sesión responde 401', async () => {
    const res = await fetch(`${BASE}/api/proveedores`)
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// TASK-5 — Clasificar las líneas
// ---------------------------------------------------------------------------
describe('verificar líneas de compra', () => {
  it('un SKU de la tienda se clasifica como existente y trae el producto', async () => {
    const producto = await crearProducto({ nombre: `${MARCA} Porcelanato Marfil existente` })

    const r = await api('/api/compras/verificar', {
      method: 'POST',
      cuerpo: { lineas: [{ sku: producto.sku }] },
    })

    expect(r.status).toBe(200)
    expect(r.cuerpo.resultados[0].estado).toBe('existente')
    expect(r.cuerpo.resultados[0].producto.id).toBe(producto.id)
    // Los Decimal llegan como números, no como texto.
    expect(typeof r.cuerpo.resultados[0].producto.precioUnitario).toBe('number')
  })

  it('un SKU nuevo con nombre parecido al de otro producto avisa del parecido', async () => {
    const nombre = `${MARCA} Cerámica Dorada Especial`
    const producto = await crearProducto({ nombre })

    const r = await api('/api/compras/verificar', {
      method: 'POST',
      cuerpo: { lineas: [{ sku: `TEST-OTRO-${Date.now()}`, nombre }] },
    })

    expect(r.cuerpo.resultados[0].estado).toBe('nuevo_con_parecidos')
    expect(r.cuerpo.resultados[0].parecidos.map((p: { id: string }) => p.id)).toContain(producto.id)
  })

  it('un SKU nuevo sin nada parecido se clasifica como nuevo', async () => {
    const r = await api('/api/compras/verificar', {
      method: 'POST',
      cuerpo: { lineas: [{ sku: `TEST-NUEVO-${Date.now()}`, nombre: `Zzxq inexistente ${Date.now()}` }] },
    })
    expect(r.cuerpo.resultados[0].estado).toBe('nuevo')
  })

  it('clasifica varias líneas a la vez y conserva el orden', async () => {
    const producto = await crearProducto()
    const r = await api('/api/compras/verificar', {
      method: 'POST',
      cuerpo: {
        lineas: [
          { sku: `TEST-A-${Date.now()}`, nombre: `Qwzx uno ${Date.now()}` },
          { sku: producto.sku },
        ],
      },
    })
    expect(r.cuerpo.resultados.map((x: { estado: string }) => x.estado)).toEqual(['nuevo', 'existente'])
    expect(r.cuerpo.resultados[1].sku).toBe(producto.sku)
  })

  it('un producto inactivo no cuenta como existente: su SKU está libre', async () => {
    const producto = await crearProducto()
    await prisma.producto.update({ where: { id: producto.id }, data: { activo: false } })

    const r = await api('/api/compras/verificar', {
      method: 'POST',
      cuerpo: { lineas: [{ sku: producto.sku }] },
    })
    expect(r.cuerpo.resultados[0].estado).toBe('nuevo')
  })

  it('rechaza más de 100 líneas, sin líneas y un SKU vacío', async () => {
    const muchas = Array.from({ length: 101 }, (_, i) => ({ sku: `TEST-M-${i}` }))
    expect((await api('/api/compras/verificar', { method: 'POST', cuerpo: { lineas: muchas } })).status).toBe(400)
    expect((await api('/api/compras/verificar', { method: 'POST', cuerpo: { lineas: [] } })).status).toBe(400)
    expect((await api('/api/compras/verificar', { method: 'POST', cuerpo: { lineas: [{ sku: '  ' }] } })).status).toBe(400)
  })

  it('sin sesión responde 401', async () => {
    const res = await fetch(`${BASE}/api/compras/verificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineas: [{ sku: 'X' }] }),
    })
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// TASK-6, 7 y 8 — Registrar la compra
// ---------------------------------------------------------------------------
async function proveedorDePrueba(): Promise<string> {
  const r = await api('/api/proveedores', {
    method: 'POST',
    cuerpo: { nombre: `${MARCA} Prov compra ${Date.now()}${Math.floor(Math.random() * 100)}` },
  })
  return r.cuerpo.id as string
}

const numeroFactura = () => `TEST-F-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const skuNuevo = () => `TEST-N${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`

/**
 * Una línea de producto nuevo, con un nombre que no se parece a nada del
 * catálogo. No lleva el prefijo MARCA: los productos de prueba lo comparten y
 * por eso "se parecerían" entre sí y la compra pediría confirmar. El SKU sí
 * lleva TEST-, que es lo que los distingue como datos de prueba.
 */
function lineaNueva(sku: string, extra: Record<string, unknown> = {}) {
  return {
    sku,
    // Una palabra aleatoria y la hora: ningún otro producto de prueba comparte palabras.
    nombre: `Zq${Math.random().toString(36).slice(2, 10)}x ${Date.now()}`,
    categoria: 'ceramica',
    precioUnitario: 9000,
    cantidad: 4,
    precioFactura: 3000,
    ...extra,
  }
}

describe('registrar compra', () => {
  it('registra una compra con un producto existente y uno nuevo, con sus efectos', async () => {
    const proveedorId = await proveedorDePrueba()
    const existente = await crearProducto({ stockActual: 5, costo: 1000 })
    const sku = skuNuevo()

    const r = await api('/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId,
        fecha: '2026-10-03',
        numeroFacturaProveedor: numeroFactura(),
        metodoReparto: 'valor',
        costosExtra: [{ concepto: 'Flete', valor: 1400 }],
        items: [
          { productoId: existente.id, sku: existente.sku, cantidad: 10, precioFactura: 2000, color: 'Gris' },
          lineaNueva(sku),
        ],
      },
    })

    expect(r.status).toBe(201)
    expect(r.cuerpo).toMatchObject({ subtotal: 32000, totalExtras: 1400, total: 33400, productosCreados: 1, productosActualizados: 1 })

    // Reparto por valor: 20.000 y 12.000 de 32.000 → 875 y 525 de los 1.400.
    // Costo final: 2000 + 875/10 = 2087,5 y 3000 + 525/4 = 3131,25.
    const actualizado = await prisma.producto.findUnique({ where: { id: existente.id } })
    expect(Number(actualizado!.stockActual)).toBe(15)
    expect(Number(actualizado!.costo)).toBe(2087.5)
    expect(actualizado!.color).toBe('Gris') // estaba vacío: se completó

    const nuevo = await prisma.producto.findFirst({ where: { tiendaId, sku } })
    expect(nuevo).not.toBeNull()
    expect(Number(nuevo!.stockActual)).toBe(4)
    expect(Number(nuevo!.costo)).toBe(3131.25)
    expect(nuevo!.imagenUrl).toBeNull() // sin imagen si no se envió
    expect(nuevo!.activo).toBe(true)

    const movimientos = await prisma.inventarioMovimiento.findMany({
      where: { referenciaTipo: 'compra', referenciaId: r.cuerpo.id },
    })
    expect(movimientos).toHaveLength(2)
    const delExistente = movimientos.find((m) => m.productoId === existente.id)!
    expect(delExistente.tipo).toBe('entrada')
    expect(Number(delExistente.stockAntes)).toBe(5)
    expect(Number(delExistente.stockDespues)).toBe(15)

    const compra = await prisma.compra.findUnique({
      where: { id: r.cuerpo.id },
      include: { items: true, costosExtra: true },
    })
    expect(compra!.estado).toBe('registrada')
    expect(compra!.tiendaId).toBe(tiendaId)
    expect(compra!.items).toHaveLength(2)
    expect(compra!.costosExtra).toHaveLength(1)
    expect(compra!.items.find((i) => i.productoId === nuevo!.id)!.productoCreado).toBe(true)
    expect(Number(compra!.items.find((i) => i.productoId === existente.id)!.precioFactura)).toBe(2000)

    // Queda auditada.
    const auditoria = await prisma.auditoria.findFirst({ where: { tablaAfectada: 'compras', registroId: r.cuerpo.id } })
    expect(auditoria).not.toBeNull()
    expect(auditoria!.accion).toBe('CREATE')
  })

  it('en un producto existente solo completa lo vacío y avisa de las diferencias', async () => {
    const proveedorId = await proveedorDePrueba()
    const producto = await crearProducto()
    await prisma.producto.update({ where: { id: producto.id }, data: { color: 'Blanco' } })

    const r = await api('/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId,
        fecha: '2026-10-03',
        items: [
          {
            productoId: producto.id,
            sku: producto.sku,
            cantidad: 1,
            precioFactura: 100,
            color: 'Gris',
            acabado: 'Mate',
            imagenUrl: 'https://example.com/compra.png',
          },
        ],
      },
    })

    expect(r.status).toBe(201)
    const despues = await prisma.producto.findUnique({ where: { id: producto.id } })
    expect(despues!.color).toBe('Blanco') // tenía color: se conserva
    expect(despues!.acabado).toBe('Mate') // estaba vacío: se completa
    expect(despues!.imagenUrl).toBe('https://example.com/compra.png') // sin imagen: se asigna

    expect(r.cuerpo.diferencias).toHaveLength(1)
    expect(r.cuerpo.diferencias[0].diferencias[0]).toMatchObject({ campo: 'color', actual: 'Blanco', escrito: 'Gris' })
  })

  it('un producto con imagen conserva la suya', async () => {
    const proveedorId = await proveedorDePrueba()
    const producto = await crearProducto()
    await prisma.producto.update({ where: { id: producto.id }, data: { imagenUrl: 'https://example.com/original.png' } })

    const r = await api('/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId,
        fecha: '2026-10-03',
        items: [{ productoId: producto.id, sku: producto.sku, cantidad: 1, precioFactura: 100, imagenUrl: 'https://example.com/otra.png' }],
      },
    })

    expect(r.status).toBe(201)
    const despues = await prisma.producto.findUnique({ where: { id: producto.id } })
    expect(despues!.imagenUrl).toBe('https://example.com/original.png')
  })

  it('un costo final escrito a mano manda sobre el calculado', async () => {
    const proveedorId = await proveedorDePrueba()
    const producto = await crearProducto({ stockActual: 0, costo: 10 })

    const r = await api('/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId,
        fecha: '2026-10-03',
        costosExtra: [{ concepto: 'Descargue', valor: 5000 }],
        items: [{ productoId: producto.id, sku: producto.sku, cantidad: 10, precioFactura: 2000, costoFinalManual: 5555.55 }],
      },
    })

    expect(r.status).toBe(201)
    const despues = await prisma.producto.findUnique({ where: { id: producto.id } })
    expect(Number(despues!.costo)).toBe(5555.55)
    const item = await prisma.compraItem.findFirst({ where: { compraId: r.cuerpo.id } })
    expect(item!.costoEditado).toBe(true)
    expect(Number(item!.precioFactura)).toBe(2000) // el papel se conserva aparte
  })

  it('un fallo a mitad de la compra no deja nada guardado', async () => {
    const proveedorId = await proveedorDePrueba()
    const existente = await crearProducto({ stockActual: 7, costo: 100 })
    const sku = skuNuevo()
    const numero = numeroFactura()

    // Un costo que no cabe en la columna hace fallar la actualización de
    // stock y costo, cuando la compra y el producto nuevo ya se habían escrito.
    const r = await api('/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId,
        fecha: '2026-10-03',
        numeroFacturaProveedor: numero,
        items: [
          { productoId: existente.id, sku: existente.sku, cantidad: 1, precioFactura: 10, costoFinalManual: 99999999999 },
          lineaNueva(sku),
        ],
      },
    })

    expect(r.status).toBe(500)
    expect(await prisma.compra.findFirst({ where: { tiendaId, numeroFacturaProveedor: numero } })).toBeNull()
    expect(await prisma.producto.findFirst({ where: { tiendaId, sku } })).toBeNull()
    const intacto = await prisma.producto.findUnique({ where: { id: existente.id } })
    expect(Number(intacto!.stockActual)).toBe(7)
    expect(Number(intacto!.costo)).toBe(100)
  })

  it('una factura repetida del mismo proveedor responde 409 con la compra existente', async () => {
    const proveedorId = await proveedorDePrueba()
    const producto = await crearProducto()
    const numero = numeroFactura()
    const cuerpo = {
      proveedorId,
      fecha: '2026-10-03',
      numeroFacturaProveedor: numero,
      items: [{ productoId: producto.id, sku: producto.sku, cantidad: 1, precioFactura: 100 }],
    }

    const primera = await api('/api/compras', { method: 'POST', cuerpo })
    expect(primera.status).toBe(201)

    const repetida = await api('/api/compras', { method: 'POST', cuerpo })
    expect(repetida.status).toBe(409)
    expect(repetida.cuerpo.compraId).toBe(primera.cuerpo.id)

    // La segunda no sumó stock.
    const despues = await prisma.producto.findUnique({ where: { id: producto.id } })
    expect(Number(despues!.stockActual)).toBe(1)
  })

  it('un proveedor que no existe responde 404 y no guarda nada', async () => {
    const r = await api('/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId: '11111111-2222-4333-8444-555555555555',
        fecha: '2026-10-03',
        items: [lineaNueva(skuNuevo())],
      },
    })
    expect(r.status).toBe(404)
  })

  it('un SKU nuevo con nombre parecido pide confirmar, y con la confirmación se crea', async () => {
    const proveedorId = await proveedorDePrueba()
    const nombre = `${MARCA} Mosaico Verde Ladrillo ${Date.now().toString().slice(-6)}`
    const parecido = await crearProducto({ nombre })
    const sku = skuNuevo()

    const sinConfirmar = await api('/api/compras', {
      method: 'POST',
      cuerpo: { proveedorId, fecha: '2026-10-03', items: [lineaNueva(sku, { nombre })] },
    })
    expect(sinConfirmar.status).toBe(409)
    expect(sinConfirmar.cuerpo.tipo).toBe('parecidos')
    expect(sinConfirmar.cuerpo.linea).toBe(1)
    expect(sinConfirmar.cuerpo.parecidos.map((p: { id: string }) => p.id)).toContain(parecido.id)
    expect(await prisma.producto.findFirst({ where: { tiendaId, sku } })).toBeNull()

    const confirmada = await api('/api/compras', {
      method: 'POST',
      cuerpo: { proveedorId, fecha: '2026-10-03', items: [lineaNueva(sku, { nombre, confirmadoNuevo: true })] },
    })
    expect(confirmada.status).toBe(201)
    expect(await prisma.producto.findFirst({ where: { tiendaId, sku } })).not.toBeNull()
  })

  it('una línea nueva cuyo SKU ya existe responde 409 para reclasificarla', async () => {
    const proveedorId = await proveedorDePrueba()
    const producto = await crearProducto()

    const r = await api('/api/compras', {
      method: 'POST',
      cuerpo: { proveedorId, fecha: '2026-10-03', items: [lineaNueva(producto.sku)] },
    })

    expect(r.status).toBe(409)
    expect(r.cuerpo.tipo).toBe('sku_existe')
    expect(r.cuerpo.producto.id).toBe(producto.id)
  })

  it('el mismo producto en dos líneas se rechaza', async () => {
    const proveedorId = await proveedorDePrueba()
    const producto = await crearProducto()

    const r = await api('/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId,
        fecha: '2026-10-03',
        items: [
          { productoId: producto.id, sku: producto.sku, cantidad: 1, precioFactura: 100 },
          { productoId: producto.id, sku: `${producto.sku}-B`, cantidad: 1, precioFactura: 100 },
        ],
      },
    })
    expect(r.status).toBe(400)
    expect(r.cuerpo.tipo).toBe('producto_repetido')
  })

  it('rechaza una compra sin líneas, y sin sesión responde 401', async () => {
    const proveedorId = await proveedorDePrueba()
    const vacia = await api('/api/compras', { method: 'POST', cuerpo: { proveedorId, fecha: '2026-10-03', items: [] } })
    expect(vacia.status).toBe(400)

    const res = await fetch(`${BASE}/api/compras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proveedorId, fecha: '2026-10-03', items: [lineaNueva(skuNuevo())] }),
    })
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// TASK-9 — Consultar compras y el historial de un producto
// ---------------------------------------------------------------------------
describe('consultar compras', () => {
  it('lista las compras con filtro por proveedor y por fecha, las más recientes primero', async () => {
    const proveedorId = await proveedorDePrueba()
    const enero = await api('/api/compras', {
      method: 'POST',
      cuerpo: { proveedorId, fecha: '2026-01-10', items: [lineaNueva(skuNuevo())] },
    })
    const febrero = await api('/api/compras', {
      method: 'POST',
      cuerpo: { proveedorId, fecha: '2026-02-10', items: [lineaNueva(skuNuevo())] },
    })
    expect(enero.status).toBe(201)
    expect(febrero.status).toBe(201)

    const todas = await api(`/api/compras?proveedorId=${proveedorId}`)
    expect(todas.status).toBe(200)
    expect(todas.cuerpo.total).toBe(2)
    expect(todas.cuerpo.compras.map((c: { id: string }) => c.id)).toEqual([febrero.cuerpo.id, enero.cuerpo.id])
    expect(todas.cuerpo.compras[0]).toMatchObject({ estado: 'registrada', lineas: 1 })
    expect(typeof todas.cuerpo.compras[0].total).toBe('number')

    const desdeFebrero = await api(`/api/compras?proveedorId=${proveedorId}&fechaDesde=2026-02-01`)
    expect(desdeFebrero.cuerpo.compras.map((c: { id: string }) => c.id)).toEqual([febrero.cuerpo.id])

    const hastaEnero = await api(`/api/compras?proveedorId=${proveedorId}&fechaHasta=2026-01-31`)
    expect(hastaEnero.cuerpo.compras.map((c: { id: string }) => c.id)).toEqual([enero.cuerpo.id])
  })

  it('un filtro de proveedor mal formado devuelve una lista vacía, no un error', async () => {
    const r = await api('/api/compras?proveedorId=no-es-un-id')
    expect(r.status).toBe(200)
    expect(r.cuerpo).toEqual({ compras: [], total: 0 })
  })

  it('el detalle trae proveedor, líneas con precio de factura y costo final, y extras', async () => {
    const proveedorId = await proveedorDePrueba()
    const producto = await crearProducto({ stockActual: 0 })
    const creada = await api('/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId,
        fecha: '2026-10-03',
        observaciones: 'Entrega en bodega',
        costosExtra: [{ concepto: 'Flete', valor: 1000 }],
        items: [{ productoId: producto.id, sku: producto.sku, cantidad: 10, precioFactura: 500 }],
      },
    })
    expect(creada.status).toBe(201)

    const r = await api(`/api/compras/${creada.cuerpo.id}`)
    expect(r.status).toBe(200)
    expect(r.cuerpo).toMatchObject({
      estado: 'registrada',
      observaciones: 'Entrega en bodega',
      subtotal: 5000,
      totalExtras: 1000,
      total: 6000,
      anuladaEn: null,
    })
    expect(r.cuerpo.proveedor.id).toBe(proveedorId)
    expect(r.cuerpo.costosExtra).toEqual([expect.objectContaining({ concepto: 'Flete', valor: 1000 })])
    // 500 de factura + 1.000 de flete entre 10 unidades = 600 por unidad.
    expect(r.cuerpo.items).toEqual([
      expect.objectContaining({ sku: producto.sku, cantidad: 10, precioFactura: 500, costoFinal: 600, productoCreado: false }),
    ])
  })

  it('una compra inexistente o con un id mal formado responde 404', async () => {
    expect((await api('/api/compras/11111111-2222-4333-8444-555555555555')).status).toBe(404)
    expect((await api('/api/compras/no-es-un-uuid')).status).toBe(404)
  })

  it('el historial de un producto lista sus compras, y un producto inexistente responde 404', async () => {
    const proveedorId = await proveedorDePrueba()
    const producto = await crearProducto()
    const creada = await api('/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId,
        fecha: '2026-10-03',
        numeroFacturaProveedor: numeroFactura(),
        items: [{ productoId: producto.id, sku: producto.sku, cantidad: 3, precioFactura: 100 }],
      },
    })
    expect(creada.status).toBe(201)

    const r = await api(`/api/productos/${producto.id}/compras`)
    expect(r.status).toBe(200)
    expect(r.cuerpo.compras).toHaveLength(1)
    expect(r.cuerpo.compras[0]).toMatchObject({ compraId: creada.cuerpo.id, estado: 'registrada', cantidad: 3, costoFinal: 100 })

    expect((await api('/api/productos/11111111-2222-4333-8444-555555555555/compras')).status).toBe(404)
    expect((await api('/api/productos/no-es-un-uuid/compras')).status).toBe(404)
  })

  it('sin sesión responde 401', async () => {
    expect((await fetch(`${BASE}/api/compras`)).status).toBe(401)
    expect((await fetch(`${BASE}/api/compras/11111111-2222-4333-8444-555555555555`)).status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// TASK-10 — Anular una compra
// ---------------------------------------------------------------------------
async function registrarCompraSimple(productos: { id: string; sku: string }[], cantidad = 10, extra: Record<string, unknown> = {}) {
  const proveedorId = await proveedorDePrueba()
  const r = await api('/api/compras', {
    method: 'POST',
    cuerpo: {
      proveedorId,
      fecha: '2026-10-03',
      items: productos.map((p) => ({ productoId: p.id, sku: p.sku, cantidad, precioFactura: 100 })),
      ...extra,
    },
  })
  expect(r.status).toBe(201)
  return { id: r.cuerpo.id as string, proveedorId }
}

describe('anular compra', () => {
  it('con stock suficiente devuelve el stock, deja la salida y conserva productos y costos', async () => {
    const proveedorId = await proveedorDePrueba()
    const existente = await crearProducto({ stockActual: 5, costo: 1 })
    const sku = skuNuevo()
    const creada = await api('/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId,
        fecha: '2026-10-03',
        items: [{ productoId: existente.id, sku: existente.sku, cantidad: 10, precioFactura: 200 }, lineaNueva(sku)],
      },
    })
    expect(creada.status).toBe(201)

    const r = await api(`/api/compras/${creada.cuerpo.id}/anular`, { method: 'POST', cuerpo: { motivo: 'Factura duplicada' } })
    expect(r.status).toBe(200)
    expect(r.cuerpo).toMatchObject({ estado: 'anulada', revisarCostos: true })

    // El stock vuelve a lo de antes; los productos siguen ahí, el creado incluido.
    const despues = await prisma.producto.findUnique({ where: { id: existente.id } })
    expect(Number(despues!.stockActual)).toBe(5)
    expect(Number(despues!.costo)).toBe(200) // el costo NO se restaura
    const nuevo = await prisma.producto.findFirst({ where: { tiendaId, sku } })
    expect(nuevo).not.toBeNull()
    expect(nuevo!.activo).toBe(true)
    expect(Number(nuevo!.stockActual)).toBe(0)

    const salidas = await prisma.inventarioMovimiento.findMany({
      where: { referenciaTipo: 'anulacion_compra', referenciaId: creada.cuerpo.id },
    })
    expect(salidas).toHaveLength(2)
    const delExistente = salidas.find((m) => m.productoId === existente.id)!
    expect(delExistente.tipo).toBe('salida')
    expect(Number(delExistente.stockAntes)).toBe(15)
    expect(Number(delExistente.stockDespues)).toBe(5)

    const compra = await prisma.compra.findUnique({ where: { id: creada.cuerpo.id } })
    expect(compra!.estado).toBe('anulada')
    expect(compra!.motivoAnulacion).toBe('Factura duplicada')
    expect(compra!.anuladaEn).not.toBeNull()
    expect(compra!.anuladaPor).not.toBeNull()

    const auditoria = await prisma.auditoria.findFirst({
      where: { tablaAfectada: 'compras', registroId: creada.cuerpo.id, accion: 'UPDATE' },
    })
    expect(auditoria).not.toBeNull()

    // La compra sigue en la lista, marcada como anulada.
    const lista = await api(`/api/compras?proveedorId=${proveedorId}`)
    expect(lista.cuerpo.compras[0]).toMatchObject({ id: creada.cuerpo.id, estado: 'anulada' })
  })

  it('con stock insuficiente se deshace todo y dice cuánto falta', async () => {
    const a = await crearProducto({ stockActual: 0 })
    const b = await crearProducto({ stockActual: 0 })
    const { id } = await registrarCompraSimple([a, b], 10)

    // Se "vendieron" 7 de b: ya no alcanza para devolver los 10 de la compra.
    await prisma.producto.update({ where: { id: b.id }, data: { stockActual: 3 } })

    const r = await api(`/api/compras/${id}/anular`, { method: 'POST', cuerpo: { motivo: 'Error de digitación' } })
    expect(r.status).toBe(409)
    expect(r.cuerpo.tipo).toBe('stock_insuficiente')
    expect(r.cuerpo.productos).toEqual([expect.objectContaining({ sku: b.sku, faltante: 7 })])

    // Nada cambió, tampoco lo de "a", que sí alcanzaba.
    expect(Number((await prisma.producto.findUnique({ where: { id: a.id } }))!.stockActual)).toBe(10)
    expect(Number((await prisma.producto.findUnique({ where: { id: b.id } }))!.stockActual)).toBe(3)
    expect((await prisma.compra.findUnique({ where: { id } }))!.estado).toBe('registrada')
    expect(await prisma.inventarioMovimiento.count({ where: { referenciaTipo: 'anulacion_compra', referenciaId: id } })).toBe(0)
  })

  it('sin motivo responde 400 y una compra ya anulada responde 409 sin restar otra vez', async () => {
    const p = await crearProducto({ stockActual: 0 })
    const { id } = await registrarCompraSimple([p], 4)

    expect((await api(`/api/compras/${id}/anular`, { method: 'POST', cuerpo: { motivo: '   ' } })).status).toBe(400)
    expect((await api(`/api/compras/${id}/anular`, { method: 'POST', cuerpo: {} })).status).toBe(400)

    expect((await api(`/api/compras/${id}/anular`, { method: 'POST', cuerpo: { motivo: 'Se registró mal' } })).status).toBe(200)
    const otra = await api(`/api/compras/${id}/anular`, { method: 'POST', cuerpo: { motivo: 'Otra vez' } })
    expect(otra.status).toBe(409)

    expect(Number((await prisma.producto.findUnique({ where: { id: p.id } }))!.stockActual)).toBe(0)
    expect(await prisma.inventarioMovimiento.count({ where: { referenciaTipo: 'anulacion_compra', referenciaId: id } })).toBe(1)
  })

  it('una compra inexistente o con un id mal formado responde 404', async () => {
    const motivo = { motivo: 'x' }
    expect((await api('/api/compras/11111111-2222-4333-8444-555555555555/anular', { method: 'POST', cuerpo: motivo })).status).toBe(404)
    expect((await api('/api/compras/no-es-un-uuid/anular', { method: 'POST', cuerpo: motivo })).status).toBe(404)
  })

  it('tras anular, la misma factura del proveedor se puede volver a registrar', async () => {
    const proveedorId = await proveedorDePrueba()
    const p = await crearProducto({ stockActual: 0 })
    const numero = numeroFactura()
    const cuerpo = {
      proveedorId,
      fecha: '2026-10-03',
      numeroFacturaProveedor: numero,
      items: [{ productoId: p.id, sku: p.sku, cantidad: 2, precioFactura: 50 }],
    }

    const primera = await api('/api/compras', { method: 'POST', cuerpo })
    expect(primera.status).toBe(201)
    expect((await api('/api/compras', { method: 'POST', cuerpo })).status).toBe(409)

    expect((await api(`/api/compras/${primera.cuerpo.id}/anular`, { method: 'POST', cuerpo: { motivo: 'Mal registrada' } })).status).toBe(200)

    const nueva = await api('/api/compras', { method: 'POST', cuerpo })
    expect(nueva.status).toBe(201)
    expect(nueva.cuerpo.id).not.toBe(primera.cuerpo.id)
  })

  it('sin sesión responde 401', async () => {
    const res = await fetch(`${BASE}/api/compras/11111111-2222-4333-8444-555555555555/anular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: 'x' }),
    })
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// TASK-20 — Una compra grande cabe en el tiempo de la transacción
// ---------------------------------------------------------------------------
describe('compra de 100 líneas', () => {
  it('se guarda entera dentro del límite de la transacción, con todos sus efectos', async () => {
    const proveedorId = await proveedorDePrueba()
    const base = Date.now().toString().slice(-7)

    // 100 productos nuevos. El flete se reparte entre todos.
    const items = Array.from({ length: 100 }, (_, i) => lineaNueva(`TEST-L${base}-${i}`, { cantidad: 3, precioFactura: 1000 + i }))

    const inicio = Date.now()
    const r = await api('/api/compras', {
      method: 'POST',
      cuerpo: {
        proveedorId,
        fecha: '2026-10-03',
        costosExtra: [{ concepto: 'Flete', valor: 12345.67 }],
        items,
      },
    })
    const segundos = (Date.now() - inicio) / 1000

    expect(r.status).toBe(201)
    expect(r.cuerpo.productosCreados).toBe(100)
    // El límite de la transacción es de 20 s; la petición entera tiene que entrar con margen.
    expect(segundos).toBeLessThan(20)
    console.log(`Compra de 100 líneas guardada en ${segundos.toFixed(1)} s`)

    // Todos los efectos están: 100 ítems, 100 movimientos y 100 productos con stock y costo.
    expect(await prisma.compraItem.count({ where: { compraId: r.cuerpo.id } })).toBe(100)
    expect(
      await prisma.inventarioMovimiento.count({ where: { referenciaTipo: 'compra', referenciaId: r.cuerpo.id } })
    ).toBe(100)

    // Dos decimales, y lo repartido suma exactamente el total de los extras.
    const lineas = await prisma.compraItem.findMany({ where: { compraId: r.cuerpo.id } })
    const repartido = Math.round(lineas.reduce((s, l) => s + Number(l.costoExtra), 0) * 100) / 100
    expect(repartido).toBe(12345.67)
    for (const l of lineas) {
      expect(Math.round(Number(l.costoFinal) * 100) / 100).toBe(Number(l.costoFinal))
    }
    expect(r.cuerpo.subtotal + r.cuerpo.totalExtras).toBe(r.cuerpo.total)
  })
})
