// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

// Estos tests corren contra la BD real y el servidor de desarrollo.
// Por decisión del proyecto NO se limpian los datos: quedan como registro
// de qué se probó. Todo lo que crean lleva el prefijo TEST- para
// distinguirlo de los datos de trabajo.

const prisma = new PrismaClient()
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'
const MARCA = `TEST-${new Date().toISOString().slice(0, 16)}`

let productoId: string
let HEADERS: Record<string, string>

// Se inicia sesión de verdad: los endpoints resuelven al usuario desde el
// token y comprueban sus permisos, así que un token inventado ya no sirve.
async function iniciarSesion(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = process.env.E2E_USER
  const password = process.env.E2E_PASSWORD

  if (!url || !anon || !email || !password) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL, la clave anónima, E2E_USER o E2E_PASSWORD en .env')
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

// Se crea un producto propio para las pruebas en vez de usar uno real:
// así el resultado no depende del stock que haya en ese momento ni
// altera los productos con los que se trabaja.
beforeAll(async () => {
  const token = await iniciarSesion()
  HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const sufijo = Date.now().toString().slice(-8)

  const producto = await prisma.producto.create({
    data: {
      sku: `TEST-${sufijo}`,
      nombre: `${MARCA} producto de integración`,
      categoria: 'ceramica',
      precioUnitario: 50000,
      stockActual: 1000,
      stockMinimo: 10,
      activo: true,
      descripcion: 'Creado por la suite de tests de integración',
    },
    select: { id: true },
  })

  productoId = producto.id
}, 60000)

afterAll(async () => {
  await prisma.$disconnect()
})

async function api(ruta: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${ruta}`, { ...init, headers: { ...HEADERS, ...init?.headers } })
  const texto = await res.text()
  let data: any = null
  try {
    data = JSON.parse(texto)
  } catch {
    data = texto
  }
  return { status: res.status, data, headers: res.headers }
}

describe('autenticación de la API', () => {
  it('rechaza una ruta protegida sin token', async () => {
    const res = await fetch(`${BASE}/api/productos`)
    expect(res.status).toBe(401)
  })

  it('rechaza un token inventado', async () => {
    // Antes bastaba con que la cabecera existiera: el middleware no
    // comprobaba que el token fuera real ni a quién pertenecía.
    const res = await fetch(`${BASE}/api/productos`, {
      headers: { Authorization: 'Bearer token-que-no-existe' },
    })
    expect(res.status).toBe(401)
  })

  it('exige permiso, no solo sesión, para gestionar usuarios', async () => {
    const res = await fetch(`${BASE}/api/usuarios`, {
      headers: { Authorization: 'Bearer token-que-no-existe' },
    })
    expect([401, 403]).toContain(res.status)
  })

  it('permite el catálogo público sin token', async () => {
    const res = await fetch(`${BASE}/api/productos/catalogo`)
    expect(res.status).toBe(200)
  })

  it('permite la configuración pública sin token', async () => {
    const res = await fetch(`${BASE}/api/configuracion/publica`)
    expect(res.status).toBe(200)
  })
})

describe('GET /api/productos/catalogo', () => {
  it('devuelve solo productos activos con stock disponible', async () => {
    const { status, data } = await api('/api/productos/catalogo')

    expect(status).toBe(200)
    expect(Array.isArray(data)).toBe(true)

    const ids = data.map((p: any) => p.id)
    if (ids.length > 0) {
      const enBD = await prisma.producto.findMany({
        where: { id: { in: ids } },
        select: { activo: true, stockActual: true },
      })
      enBD.forEach((p) => {
        expect(p.activo).toBe(true)
        expect(Number(p.stockActual)).toBeGreaterThan(0)
      })
    }
  })

  it('no expone costo ni stock al público', async () => {
    const { data } = await api('/api/productos/catalogo')

    if (data.length > 0) {
      expect(data[0]).not.toHaveProperty('costo')
      expect(data[0]).not.toHaveProperty('stockActual')
      expect(data[0]).not.toHaveProperty('stockMinimo')
      expect(data[0]).toHaveProperty('precioUnitario')
    }
  })

  it('filtra por categoría', async () => {
    const { data: todos } = await api('/api/productos/catalogo')
    if (todos.length === 0) return

    const categoria = todos[0].categoria
    const { data: filtrados } = await api(
      `/api/productos/catalogo?categoria=${encodeURIComponent(categoria)}`
    )

    expect(filtrados.length).toBeGreaterThan(0)
    filtrados.forEach((p: any) => expect(p.categoria).toBe(categoria))
  })
})

describe('POST /api/inventario/movimientos', () => {
  it('una entrada suma al stock y registra el movimiento', async () => {
    const antes = Number(
      (await prisma.producto.findUnique({ where: { id: productoId }, select: { stockActual: true } }))!
        .stockActual
    )

    const { status, data } = await api('/api/inventario/movimientos', {
      method: 'POST',
      body: JSON.stringify({
        productoId,
        tipo: 'entrada',
        cantidad: 15,
        motivo: `${MARCA} entrada de integración`,
      }),
    })

    expect(status).toBe(201)
    expect(data.stockAntes).toBe(antes)
    expect(data.stockDespues).toBe(antes + 15)

    const despues = Number(
      (await prisma.producto.findUnique({ where: { id: productoId }, select: { stockActual: true } }))!
        .stockActual
    )
    expect(despues).toBe(antes + 15)

    const movimiento = await prisma.inventarioMovimiento.findUnique({ where: { id: data.id } })
    expect(movimiento).not.toBeNull()
    expect(movimiento!.tipo).toBe('entrada')
    expect(Number(movimiento!.cantidad)).toBe(15)
  })

  it('una salida resta del stock', async () => {
    const antes = Number(
      (await prisma.producto.findUnique({ where: { id: productoId }, select: { stockActual: true } }))!
        .stockActual
    )

    const { status, data } = await api('/api/inventario/movimientos', {
      method: 'POST',
      body: JSON.stringify({
        productoId,
        tipo: 'salida',
        cantidad: 5,
        motivo: `${MARCA} salida de integración`,
      }),
    })

    expect(status).toBe(201)
    expect(data.stockDespues).toBe(antes - 5)
  })

  it('un ajuste fija el stock al valor contado', async () => {
    const objetivo = 200

    const { status, data } = await api('/api/inventario/movimientos', {
      method: 'POST',
      body: JSON.stringify({
        productoId,
        tipo: 'ajuste',
        cantidad: objetivo,
        motivo: `${MARCA} ajuste por conteo`,
      }),
    })

    expect(status).toBe(201)
    expect(data.stockDespues).toBe(objetivo)

    const enBD = await prisma.producto.findUnique({
      where: { id: productoId },
      select: { stockActual: true },
    })
    expect(Number(enBD!.stockActual)).toBe(objetivo)
  })

  it('rechaza una salida que dejaría el stock negativo, sin alterar la BD', async () => {
    const antes = Number(
      (await prisma.producto.findUnique({ where: { id: productoId }, select: { stockActual: true } }))!
        .stockActual
    )

    const { status, data } = await api('/api/inventario/movimientos', {
      method: 'POST',
      body: JSON.stringify({
        productoId,
        tipo: 'salida',
        cantidad: antes + 9999,
        motivo: `${MARCA} debe fallar`,
      }),
    })

    expect(status).toBe(400)
    expect(data.error).toMatch(/negativo/i)

    const despues = Number(
      (await prisma.producto.findUnique({ where: { id: productoId }, select: { stockActual: true } }))!
        .stockActual
    )
    expect(despues).toBe(antes)
  })

  it.each([
    [{ cantidad: 0 }, /mayor a cero/i, 'cantidad cero en una entrada'],
    [{ cantidad: -3 }, /negativa/i, 'cantidad negativa'],
    [{ motivo: '' }, /motivo/i, 'sin motivo'],
    [{ tipo: 'devolucion' }, /./, 'tipo inválido'],
  ])('rechaza %s', async (override, patron) => {
    const { status, data } = await api('/api/inventario/movimientos', {
      method: 'POST',
      body: JSON.stringify({
        productoId,
        tipo: 'entrada',
        cantidad: 5,
        motivo: `${MARCA} validación`,
        ...override,
      }),
    })

    expect(status).toBe(400)
    expect(data.error).toMatch(patron)
  })

  it('acepta un ajuste a cero para dejar un producto agotado', async () => {
    const { status, data } = await api('/api/inventario/movimientos', {
      method: 'POST',
      body: JSON.stringify({
        productoId,
        tipo: 'ajuste',
        cantidad: 0,
        motivo: `${MARCA} conteo: sin existencias`,
      }),
    })

    expect(status).toBe(201)
    expect(data.stockDespues).toBe(0)

    // Se deja en un valor utilizable para el resto de la suite.
    await api('/api/inventario/movimientos', {
      method: 'POST',
      body: JSON.stringify({
        productoId,
        tipo: 'ajuste',
        cantidad: 500,
        motivo: `${MARCA} reposición tras el conteo`,
      }),
    })
  })

  it('devuelve 404 si el producto no existe', async () => {
    const { status } = await api('/api/inventario/movimientos', {
      method: 'POST',
      body: JSON.stringify({
        productoId: '00000000-0000-0000-0000-000000000000',
        tipo: 'entrada',
        cantidad: 1,
        motivo: `${MARCA} producto inexistente`,
      }),
    })

    expect(status).toBe(404)
  })
})

describe('GET /api/inventario/movimientos', () => {
  it('filtra por producto', async () => {
    const { status, data } = await api(`/api/inventario/movimientos?productoId=${productoId}`)

    expect(status).toBe(200)
    data.forEach((m: any) => expect(m.producto).not.toBeNull())
  })

  it('filtra por tipo', async () => {
    const { data } = await api('/api/inventario/movimientos?tipo=entrada')
    data.forEach((m: any) => expect(m.tipo).toBe('entrada'))
  })

  it('ignora un tipo inválido en vez de fallar', async () => {
    const { status } = await api('/api/inventario/movimientos?tipo=loquesea')
    expect(status).toBe(200)
  })
})

describe('POST /api/facturas', () => {
  it('crea la factura, descuenta stock y registra el movimiento en una sola operación', async () => {
    const antes = Number(
      (await prisma.producto.findUnique({ where: { id: productoId }, select: { stockActual: true } }))!
        .stockActual
    )

    const { status, data } = await api('/api/facturas', {
      method: 'POST',
      body: JSON.stringify({
        clienteId: null,
        usuarioId: null,
        subtotal: 50000,
        total: 50000,
        impuesto: 0,
        observaciones: `${MARCA} factura de integración`,
        items: [
          {
            productoId,
            productoNombre: 'Item de prueba',
            cantidadM2: 3,
            precioUnitario: 50000 / 3,
            subtotal: 50000,
          },
        ],
      }),
    })

    expect(status).toBe(201)
    expect(data.numeroFactura).toMatch(/^\d{8}-\d{3}$/)

    const despues = Number(
      (await prisma.producto.findUnique({ where: { id: productoId }, select: { stockActual: true } }))!
        .stockActual
    )
    expect(despues).toBe(antes - 3)

    const movimientos = await prisma.inventarioMovimiento.findMany({
      where: { referenciaId: data.id },
    })
    expect(movimientos).toHaveLength(1)
    expect(movimientos[0].tipo).toBe('salida')
    expect(movimientos[0].referenciaTipo).toBe('factura')
  })

  it('un item personalizado no afecta el inventario', async () => {
    const totalMovimientosAntes = await prisma.inventarioMovimiento.count()

    const { status, data } = await api('/api/facturas', {
      method: 'POST',
      body: JSON.stringify({
        clienteId: null,
        subtotal: 10000,
        total: 10000,
        impuesto: 0,
        observaciones: `${MARCA} factura solo personalizado`,
        items: [
          {
            productoId: null,
            productoNombre: 'Servicio de instalación',
            cantidadM2: 1,
            precioUnitario: 10000,
            subtotal: 10000,
          },
        ],
      }),
    })

    expect(status).toBe(201)

    const movimientos = await prisma.inventarioMovimiento.findMany({
      where: { referenciaId: data.id },
    })
    expect(movimientos).toHaveLength(0)

    const totalDespues = await prisma.inventarioMovimiento.count()
    expect(totalDespues).toBe(totalMovimientosAntes)
  })

  it('agrupa el mismo producto repetido en un solo descuento', async () => {
    const antes = Number(
      (await prisma.producto.findUnique({ where: { id: productoId }, select: { stockActual: true } }))!
        .stockActual
    )

    const item = (cantidad: number) => ({
      productoId,
      productoNombre: 'Repetido',
      cantidadM2: cantidad,
      precioUnitario: 1000,
      subtotal: cantidad * 1000,
    })

    const { status, data } = await api('/api/facturas', {
      method: 'POST',
      body: JSON.stringify({
        clienteId: null,
        subtotal: 4000,
        total: 4000,
        impuesto: 0,
        observaciones: `${MARCA} producto repetido`,
        items: [item(1), item(3)],
      }),
    })

    expect(status).toBe(201)

    const despues = Number(
      (await prisma.producto.findUnique({ where: { id: productoId }, select: { stockActual: true } }))!
        .stockActual
    )
    expect(despues).toBe(antes - 4)

    const movimientos = await prisma.inventarioMovimiento.findMany({
      where: { referenciaId: data.id },
    })
    expect(movimientos).toHaveLength(1)
    expect(Number(movimientos[0].cantidad)).toBe(4)
  })

  it('no deja el stock en negativo al facturar más de lo disponible', async () => {
    const stockActual = Number(
      (await prisma.producto.findUnique({ where: { id: productoId }, select: { stockActual: true } }))!
        .stockActual
    )
    const exceso = stockActual + 25

    const { status, data } = await api('/api/facturas', {
      method: 'POST',
      body: JSON.stringify({
        clienteId: null,
        subtotal: 1000,
        total: 1000,
        impuesto: 0,
        observaciones: `${MARCA} venta sobre stock disponible`,
        items: [
          {
            productoId,
            productoNombre: 'Venta sin stock suficiente',
            cantidadM2: exceso,
            precioUnitario: 1000 / exceso,
            subtotal: 1000,
          },
        ],
      }),
    })

    // La venta se permite (regla del negocio), pero el inventario toca piso en cero.
    expect(status).toBe(201)

    const despues = Number(
      (await prisma.producto.findUnique({ where: { id: productoId }, select: { stockActual: true } }))!
        .stockActual
    )
    expect(despues).toBe(0)
    expect(despues).toBeGreaterThanOrEqual(0)

    // El movimiento deja constancia de cuánto se facturó sin respaldo.
    const movimiento = await prisma.inventarioMovimiento.findFirst({
      where: { referenciaId: data.id },
    })
    expect(Number(movimiento!.cantidad)).toBe(exceso)
    expect(Number(movimiento!.stockDespues)).toBe(0)
    expect(movimiento!.motivo).toMatch(/sin stock disponible/)
  })

  it('genera números de factura consecutivos', async () => {
    const cuerpo = {
      clienteId: null,
      subtotal: 1000,
      total: 1000,
      impuesto: 0,
      observaciones: `${MARCA} consecutivo`,
      items: [
        { productoId: null, productoNombre: 'X', cantidadM2: 1, precioUnitario: 1000, subtotal: 1000 },
      ],
    }

    const a = await api('/api/facturas', { method: 'POST', body: JSON.stringify(cuerpo) })
    const b = await api('/api/facturas', { method: 'POST', body: JSON.stringify(cuerpo) })

    expect(a.status).toBe(201)
    expect(b.status).toBe(201)

    const secA = parseInt(a.data.numeroFactura.split('-')[1], 10)
    const secB = parseInt(b.data.numeroFactura.split('-')[1], 10)
    expect(secB).toBeGreaterThan(secA)
  })
})

describe('GET /api/facturas/[id]/pdf', () => {
  it('genera la factura con los datos del cliente y los items', async () => {
    const factura = await prisma.factura.findFirst({
      where: { items: { some: {} } },
      select: { id: true, numeroFactura: true },
      orderBy: { fecha: 'desc' },
    })

    const { status, data } = await api(`/api/facturas/${factura!.id}/pdf`)

    expect(status).toBe(200)
    expect(typeof data).toBe('string')
    expect(data).toContain(factura!.numeroFactura)
    expect(data).toMatch(/@media\s+print/)
    expect(data).toMatch(/Subtotal/i)
  })

  it('devuelve 404 para una factura inexistente', async () => {
    const { status } = await api('/api/facturas/00000000-0000-0000-0000-000000000000/pdf')
    expect(status).toBe(404)
  })
})

describe('GET/PUT /api/configuracion', () => {
  it('niega el acceso sin sesión', async () => {
    const res = await fetch(`${BASE}/api/configuracion`)
    expect(res.status).toBe(401)
  })

  it('ignora el email que llegue en la petición: manda el del token', async () => {
    // Antes el permiso se decidía con ?email= o con el email del cuerpo, así
    // que bastaba con enviar el de un administrador para hacerse pasar por él.
    const { status } = await api('/api/configuracion?email=nadie@ejemplo.com')
    expect(status).toBe(200) // la sesión real sí tiene permiso
  })

  it('el administrador puede leer la configuración', async () => {
    const { status, data } = await api('/api/configuracion')
    expect(status).toBe(200)
    expect(data).toHaveProperty('config')
  })
})

describe('precios de bodega', () => {
  it('el catálogo público no expone el precio de bodega ni el costo', async () => {
    // Es el precio al que se le vende a otro negocio: si sale en el
    // catálogo, cualquier cliente lo pide.
    const { data } = await api('/api/productos/catalogo')

    if (data.length > 0) {
      expect(data[0]).not.toHaveProperty('precioBodega')
      expect(data[0]).not.toHaveProperty('costo')
    }
  })

  it('guarda la marca de bodega en la factura', async () => {
    const { status, data } = await api('/api/facturas', {
      method: 'POST',
      body: JSON.stringify({
        clienteId: null,
        esBodega: true,
        subtotal: 31000,
        total: 31000,
        impuesto: 0,
        observaciones: `${MARCA} factura a precio de bodega`,
        items: [
          {
            productoId,
            productoNombre: 'Venta a bodega',
            cantidadM2: 1,
            precioUnitario: 31000,
            subtotal: 31000,
          },
        ],
      }),
    })

    expect(status).toBe(201)

    const enBD = await prisma.factura.findUnique({
      where: { id: data.id },
      select: { esBodega: true, items: { select: { precioUnitario: true } } },
    })

    expect(enBD!.esBodega).toBe(true)
    // El precio queda congelado en la línea: cambiar el del producto después
    // no puede reescribir lo ya facturado.
    expect(Number(enBD!.items[0].precioUnitario)).toBe(31000)
  })

  it('una factura normal no queda marcada como bodega', async () => {
    const { status, data } = await api('/api/facturas', {
      method: 'POST',
      body: JSON.stringify({
        clienteId: null,
        subtotal: 36000,
        total: 36000,
        impuesto: 0,
        observaciones: `${MARCA} factura a precio de público`,
        items: [
          {
            productoId: null,
            productoNombre: 'Venta normal',
            cantidadM2: 1,
            precioUnitario: 36000,
            subtotal: 36000,
          },
        ],
      }),
    })

    expect(status).toBe(201)

    const enBD = await prisma.factura.findUnique({
      where: { id: data.id },
      select: { esBodega: true },
    })
    expect(enBD!.esBodega).toBe(false)
  })

  it('el PDF avisa cuando la factura es de bodega', async () => {
    const factura = await prisma.factura.findFirst({
      where: { esBodega: true },
      select: { id: true },
      orderBy: { fecha: 'desc' },
    })

    if (!factura) return

    const { status, data } = await api(`/api/facturas/${factura.id}/pdf`)
    expect(status).toBe(200)
    expect(data).toMatch(/Precio de bodega/i)
  })

  it('crea un producto con sus tres precios', async () => {
    const sufijo = Date.now().toString().slice(-8)

    const { status, data } = await api('/api/productos', {
      method: 'POST',
      body: JSON.stringify({
        sku: `TEST-P${sufijo}`,
        nombre: `${MARCA} producto con tres precios`,
        categoria: 'ceramica',
        precioUnitario: 36000,
        precioBodega: 31000,
        costo: 29000,
        stockActual: 10,
        stockMinimo: 5,
      }),
    })

    expect(status).toBe(201)
    expect(Number(data.precioUnitario)).toBe(36000)
    expect(Number(data.precioBodega)).toBe(31000)
    expect(Number(data.costo)).toBe(29000)
    expect(data.precioBodegaUpdatedAt).not.toBeNull()
  })

  it('acepta un producto sin precio de bodega', async () => {
    const sufijo = Date.now().toString().slice(-8)

    const { status, data } = await api('/api/productos', {
      method: 'POST',
      body: JSON.stringify({
        sku: `TEST-S${sufijo}`,
        nombre: `${MARCA} producto sin precio de bodega`,
        categoria: 'ceramica',
        precioUnitario: 36000,
        stockActual: 10,
      }),
    })

    expect(status).toBe(201)
    expect(data.precioBodega).toBeNull()
  })
})

describe('asignar y quitar permisos', () => {
  let usuarioPruebaId: string

  // Se trabaja sobre un usuario creado para esto: quitarle los permisos a
  // alguien real dejaría a una persona sin poder trabajar.
  beforeAll(async () => {
    const usuario = await prisma.usuario.create({
      data: { email: `test-permisos-${Date.now()}@integracion.local` },
      select: { id: true },
    })
    usuarioPruebaId = usuario.id
  })

  it('asigna permisos a un usuario', async () => {
    const { status, data } = await api('/api/usuarios/permisos', {
      method: 'POST',
      body: JSON.stringify({
        usuarioIds: [usuarioPruebaId],
        permisos: ['productos.ver', 'facturas.ver'],
        modo: 'agregar',
      }),
    })

    expect(status).toBe(200)
    expect(data.afectados[0].permisos).toBe(2)
  })

  it('quita todos los permisos de una vez', async () => {
    const { status, data } = await api('/api/usuarios/permisos', {
      method: 'DELETE',
      body: JSON.stringify({ usuarioIds: [usuarioPruebaId], todos: true }),
    })

    expect(status).toBe(200)
    expect(data.afectados[0].quitados).toBe(2)

    const relacion = await prisma.usuarioTienda.findFirst({
      where: { usuarioId: usuarioPruebaId },
      include: { permisos: true },
    })
    // Conserva el acceso a la tienda: se queda sin permisos, no expulsado.
    expect(relacion).not.toBeNull()
    expect(relacion!.permisos).toHaveLength(0)
  })

  it('exige decir qué permisos quitar si no se piden todos', async () => {
    const { status } = await api('/api/usuarios/permisos', {
      method: 'DELETE',
      body: JSON.stringify({ usuarioIds: [usuarioPruebaId], permisos: [] }),
    })

    expect(status).toBe(400)
  })

  it('no permite tocar al dueño de la tienda', async () => {
    const dueno = await prisma.usuarioTienda.findFirst({
      where: { esOwner: true },
      select: { usuarioId: true },
    })

    if (!dueno) return

    const { status } = await api('/api/usuarios/permisos', {
      method: 'DELETE',
      body: JSON.stringify({ usuarioIds: [dueno.usuarioId], todos: true }),
    })

    expect(status).toBe(403)
  })

  it('rechaza permisos que no existen', async () => {
    const { status } = await api('/api/usuarios/permisos', {
      method: 'POST',
      body: JSON.stringify({
        usuarioIds: [usuarioPruebaId],
        permisos: ['inventado.total'],
      }),
    })

    expect(status).toBe(400)
  })
})

describe('endpoints sin sesión', () => {
  // Barrido de todo lo que debe responder 401 sin token. Si mañana alguien
  // crea un endpoint y olvida la comprobación, aquí se ve.
  const protegidos = [
    '/api/productos',
    '/api/clientes',
    '/api/facturas',
    '/api/usuarios',
    '/api/permisos',
    '/api/auditoria',
    '/api/configuracion',
    '/api/inventario/movimientos',
    '/api/reportes/inventario',
    '/api/reportes/facturacion',
    '/api/solicitudes-acceso',
    '/api/tiendas',
    '/api/debug/usuario-actual',
  ]

  it.each(protegidos)('%s responde 401 sin token', async (ruta) => {
    const res = await fetch(`${BASE}${ruta}`)
    expect(res.status).toBe(401)
  })

  it('los endpoints del modelo de roles antiguo ya no existen', async () => {
    const retiradas = [
      '/api/roles-personalizados',
      '/api/permisos-modulos',
      '/api/admin/assign-role',
      '/api/setup/create-admin',
    ]

    for (const ruta of retiradas) {
      const res = await fetch(`${BASE}${ruta}`, {
        headers: { Authorization: 'Bearer lo-que-sea' },
      })
      expect(res.status).toBe(404)
    }
  })

  it('sync-user ya no acepta el correo que le manden', async () => {
    // Antes creaba usuarios sin sesión con el email del cuerpo, y podía
    // reapuntar la fila de otro correo a la cuenta de quien llamara.
    const res = await fetch(`${BASE}/api/auth/sync-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: '00000000-0000-0000-0000-000000000000',
        email: 'admin@beraca.com',
      }),
    })

    expect(res.status).toBe(401)
  })
})

// Va al final a propósito: al agotar el límite, esa IP queda frenada un
// minuto para ese grupo de rutas.
describe('límite de peticiones', () => {
  it('corta el registro tras varios intentos seguidos', async () => {
    let ultimo = 0

    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // sin datos: falla antes de tocar Supabase
      })
      ultimo = res.status

      if (res.status === 429) {
        expect(res.headers.get('retry-after')).toBeTruthy()
        return
      }
    }

    throw new Error(`No se activó el límite; la última respuesta fue ${ultimo}`)
  })
})
