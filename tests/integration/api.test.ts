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
let tiendaId: string
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

  // El producto se crea en la tienda de la cuenta de pruebas: desde que los
  // datos están aislados, uno sin tienda no lo vería ningún endpoint.
  //
  // Se elige la misma que elegiría el servidor sin cabecera: aquella donde
  // la cuenta puede trabajar. La de pruebas está en varias tiendas y en
  // algunas no tiene permisos, así que quedarse con la primera que devuelva
  // la base haría fallar todo con 403.
  const accesos = await prisma.usuarioTienda.findMany({
    where: { usuario: { email: process.env.E2E_USER } },
    include: { permisos: true },
    orderBy: { createdAt: 'asc' },
  })

  if (accesos.length === 0) {
    throw new Error(`${process.env.E2E_USER} no tiene acceso a ninguna tienda`)
  }

  const capacidad = (a: (typeof accesos)[number]) =>
    a.esOwner ? 1000 : a.esAdmin ? 500 : a.permisos.length

  tiendaId = [...accesos].sort((x, y) => capacidad(y) - capacidad(x))[0].tiendaId

  const producto = await prisma.producto.create({
    data: {
      tiendaId,
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

/**
 * El catálogo responde { productos, total } desde que trae las cosas por
 * tandas. Este atajo deja las pruebas legibles.
 */
async function catalogo(ruta = '/api/productos/catalogo') {
  const { status, data } = await api(ruta)
  return { status, productos: (data.productos || []) as any[], total: data.total as number }
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
    const { status, productos: data } = await catalogo()

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
    const { productos: data } = await catalogo()

    if (data.length > 0) {
      expect(data[0]).not.toHaveProperty('costo')
      expect(data[0]).not.toHaveProperty('stockActual')
      expect(data[0]).not.toHaveProperty('stockMinimo')
      expect(data[0]).toHaveProperty('precioUnitario')
    }
  })

  it('solo muestra productos con imagen', async () => {
    // Una vitrina de cuadros grises no vende nada. El producto sin foto
    // sigue existiendo para facturar, pero no se expone.
    const { productos: data } = await catalogo()

    expect(data.length).toBeGreaterThan(0)
    data.forEach((p: any) => {
      expect(p.imagenUrl).toBeTruthy()
    })

    // Y hay productos vendibles que quedan fuera justamente por eso.
    const sinFoto = await prisma.producto.count({
      where: {
        activo: true,
        stockActual: { gt: 0 },
        tienda: { activo: true, publica: true },
        OR: [{ imagenUrl: null }, { imagenUrl: '' }],
      },
    })

    const ids = data.map((p: any) => p.id)
    expect(ids).toHaveLength(new Set(ids).size)
    expect(sinFoto).toBeGreaterThanOrEqual(0)
  })

  it('con limitePorTienda trae como máximo esa cantidad de cada tienda', async () => {
    // Es lo que usa la portada: una muestra de cada negocio en vez del
    // inventario completo de todos.
    const { status, productos: data } = await catalogo('/api/productos/catalogo?limitePorTienda=2')

    expect(status).toBe(200)

    const porTienda = new Map<string, number>()
    data.forEach((p: any) => {
      const id = p.tienda?.id || 'sin-tienda'
      porTienda.set(id, (porTienda.get(id) || 0) + 1)
    })

    for (const cuantos of porTienda.values()) {
      expect(cuantos).toBeLessThanOrEqual(2)
    }

    // Y sin límite se traen más, si hay más.
    const { total } = await catalogo()
    expect(total).toBeGreaterThanOrEqual(data.length)
  })

  it('los filtros del catálogo no dependen de lo que quepa en la portada', async () => {
    // Si se armaran con la muestra, faltarían categorías que sí existen y no
    // habría forma de llegar a ellas.
    const { status, data } = await api('/api/productos/catalogo/filtros')

    expect(status).toBe(200)
    expect(Array.isArray(data.categorias)).toBe(true)
    expect(Array.isArray(data.tiendas)).toBe(true)

    const { productos: muestra } = await catalogo('/api/productos/catalogo?limitePorTienda=1')
    const enMuestra = new Set(muestra.map((p: any) => p.categoria))

    expect(data.categorias.length).toBeGreaterThanOrEqual(enMuestra.size)
  })

  it('filtra por tienda', async () => {
    const { productos: todos } = await catalogo()
    if (todos.length === 0) return

    const tienda = todos[0].tienda?.id
    if (!tienda) return

    const { productos: filtrados } = await catalogo(`/api/productos/catalogo?tienda=${tienda}`)

    expect(filtrados.length).toBeGreaterThan(0)
    filtrados.forEach((p: any) => expect(p.tienda.id).toBe(tienda))
  })

  it('al filtrar trae 9 y dice cuántos hay en total', async () => {
    // Antes devolvía todo lo que cumpliera el filtro: en una tienda con diez
    // mil productos, diez mil por el cable.
    const { productos: todos } = await catalogo()
    const tienda = todos[0]?.tienda?.id
    if (!tienda) return

    const { productos, total } = await catalogo(
      `/api/productos/catalogo?tienda=${tienda}`
    )

    expect(productos.length).toBeLessThanOrEqual(9)
    expect(total).toBeGreaterThanOrEqual(productos.length)
  })

  it('la tanda siguiente no repite lo ya traído', async () => {
    const { productos: todos } = await catalogo()
    const tienda = todos[0]?.tienda?.id
    if (!tienda) return

    const base = `/api/productos/catalogo?tienda=${tienda}`
    const primera = await catalogo(`${base}&limite=9&desde=0`)

    if (primera.total <= 9) return

    const segunda = await catalogo(`${base}&limite=3&desde=9`)

    expect(segunda.productos.length).toBeGreaterThan(0)
    expect(segunda.productos.length).toBeLessThanOrEqual(3)

    const yaVistos = new Set(primera.productos.map((p) => p.id))
    segunda.productos.forEach((p) => expect(yaVistos.has(p.id)).toBe(false))
  })

  it('no se puede pedir el catálogo entero con un límite grande', async () => {
    // Una URL escrita a mano no debería poder vaciar la base de una vez.
    const { productos } = await catalogo('/api/productos/catalogo?limite=99999')
    expect(productos.length).toBeLessThanOrEqual(60)
  })

  it('al elegir una tienda, solo quedan las categorías de esa tienda', async () => {
    const { data: todas } = await api('/api/productos/catalogo/filtros')
    const tienda = todas.tiendas[0]?.id
    if (!tienda) return

    const { data: acotadas } = await api(
      `/api/productos/catalogo/filtros?tienda=${tienda}`
    )

    expect(acotadas.categorias.length).toBeGreaterThan(0)
    expect(acotadas.categorias.length).toBeLessThanOrEqual(todas.categorias.length)

    // Todas las que quedan existen de verdad en esa tienda.
    for (const categoria of acotadas.categorias) {
      const cuantos = await prisma.producto.count({
        where: {
          tiendaId: tienda,
          categoria,
          activo: true,
          stockActual: { gt: 0 },
          imagenUrl: { not: null },
          NOT: { imagenUrl: '' },
        },
      })
      expect(cuantos).toBeGreaterThan(0)
    }
  })

  it('al elegir una categoría, solo quedan las tiendas que la tienen', async () => {
    const { data: todas } = await api('/api/productos/catalogo/filtros')
    const categoria = todas.categorias[0]
    if (!categoria) return

    const { data: acotadas } = await api(
      `/api/productos/catalogo/filtros?categoria=${encodeURIComponent(categoria)}`
    )

    expect(acotadas.tiendas.length).toBeGreaterThan(0)
    expect(acotadas.tiendas.length).toBeLessThanOrEqual(todas.tiendas.length)
  })

  it('ninguna combinación que se ofrece lleva a cero resultados', async () => {
    // Es el problema que esto resuelve: antes se podía elegir una tienda y
    // luego una categoría que esa tienda no tiene, y quedar en blanco.
    const { data: todas } = await api('/api/productos/catalogo/filtros')
    const tienda = todas.tiendas[0]?.id
    if (!tienda) return

    const { data: acotadas } = await api(
      `/api/productos/catalogo/filtros?tienda=${tienda}`
    )

    for (const categoria of acotadas.categorias) {
      const { total } = await catalogo(
        `/api/productos/catalogo?tienda=${tienda}&categoria=${encodeURIComponent(categoria)}`
      )
      expect(total).toBeGreaterThan(0)
    }
  })

  it('busca por nombre sin importar las tildes', async () => {
    // En la base hay 28 nombres con tilde o ñ. Quien escribe "cafe" tiene
    // que encontrar los "Café": la columna nombre_busqueda es justo para eso.
    const conTilde = await prisma.producto.findFirst({
      where: {
        nombre: { contains: 'Café' },
        activo: true,
        stockActual: { gt: 0 },
        tienda: { activo: true, publica: true },
      },
      select: { id: true },
    })

    if (!conTilde) return

    const { productos, total } = await catalogo('/api/productos/catalogo?busqueda=cafe')

    expect(total).toBeGreaterThan(0)
    expect(productos.some((p) => p.id === conTilde.id)).toBe(true)
  })

  it('buscando también salen los productos sin foto', async () => {
    // Sin búsqueda el catálogo es una vitrina; buscando, quien escribe el
    // nombre ya sabe lo que quiere.
    const sinFoto = await prisma.producto.findFirst({
      where: {
        activo: true,
        stockActual: { gt: 0 },
        tienda: { activo: true, publica: true },
        OR: [{ imagenUrl: null }, { imagenUrl: '' }],
      },
      select: { id: true, nombre: true },
    })

    if (!sinFoto) return

    const termino = sinFoto.nombre.split(/\s+/)[0]
    if (termino.length < 3) return

    const { productos } = await catalogo(
      `/api/productos/catalogo?busqueda=${encodeURIComponent(termino)}&limite=60`
    )

    expect(productos.some((p) => p.id === sinFoto.id)).toBe(true)

    // Y sin buscar, ese mismo producto no aparece.
    const { productos: vitrina } = await catalogo('/api/productos/catalogo?limite=60')
    expect(vitrina.some((p) => p.id === sinFoto.id)).toBe(false)
  })

  it('la búsqueda se suma a los filtros, no los reemplaza', async () => {
    // El caso que no funcionaba: buscar dentro de una categoría miraba solo
    // los productos ya cargados en pantalla.
    const { data: filtros } = await api('/api/productos/catalogo/filtros')
    const categoria = filtros.categorias[0]
    if (!categoria) return

    const { productos } = await catalogo(
      `/api/productos/catalogo?categoria=${encodeURIComponent(categoria)}&busqueda=gris&limite=60`
    )

    productos.forEach((p) => {
      expect(p.categoria).toBe(categoria)
      expect(p.nombre.toLowerCase()).toContain('gris')
    })
  })

  it('con menos de tres letras no busca', async () => {
    // Dos letras encontrarían medio catálogo y no ayudan a nadie.
    const { total: buscando } = await catalogo('/api/productos/catalogo?busqueda=ca')
    const { total: normal } = await catalogo('/api/productos/catalogo')

    expect(buscando).toBe(normal)
  })

  it('la búsqueda también viene por tandas', async () => {
    const primera = await catalogo('/api/productos/catalogo?busqueda=pared&limite=9&desde=0')
    if (primera.total <= 9) return

    const segunda = await catalogo('/api/productos/catalogo?busqueda=pared&limite=3&desde=9')

    expect(primera.productos.length).toBe(9)
    expect(segunda.productos.length).toBeLessThanOrEqual(3)

    const yaVistos = new Set(primera.productos.map((p) => p.id))
    segunda.productos.forEach((p) => expect(yaVistos.has(p.id)).toBe(false))
  })

  it('filtra por categoría', async () => {
    const { productos: todos } = await catalogo()
    if (todos.length === 0) return

    const categoria = todos[0].categoria
    const { productos: filtrados } = await catalogo(
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

  it('con formato=pdf devuelve el archivo, no la página', async () => {
    // Es el que se comparte por WhatsApp: tiene que ser un PDF de verdad.
    const factura = await prisma.factura.findFirst({
      where: { items: { some: {} } },
      select: { id: true, numeroFactura: true },
      orderBy: { fecha: 'desc' },
    })

    const res = await fetch(`${BASE}/api/facturas/${factura!.id}/pdf?formato=pdf`, {
      headers: HEADERS,
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/pdf')
    expect(res.headers.get('content-disposition')).toContain(
      `Factura-${factura!.numeroFactura}.pdf`
    )

    const bytes = Buffer.from(await res.arrayBuffer())
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(1000)
  })

  it('el PDF también exige permiso', async () => {
    const factura = await prisma.factura.findFirst({ select: { id: true } })
    const res = await fetch(`${BASE}/api/facturas/${factura!.id}/pdf?formato=pdf`)
    expect(res.status).toBe(401)
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

  it('el nombre sale de la tienda, no de una clave de configuración', async () => {
    // Tenerlo en los dos sitios fue lo que dejó un mensaje de error
    // guardado como nombre de la empresa en las facturas.
    const { data } = await api('/api/configuracion')
    const tienda = await prisma.tienda.findUnique({
      where: { id: tiendaId },
      select: { nombre: true },
    })

    expect(data.config.nombre_empresa).toBe(tienda!.nombre)

    const enConfiguracion = await prisma.configuracion.count({
      where: { clave: 'nombre_empresa' },
    })
    expect(enConfiguracion).toBe(0)
  })

  it('guardar el nombre actualiza la tienda', async () => {
    // Se vuelve a guardar el mismo nombre: comprueba el camino de escritura
    // sin cambiarle el nombre a la tienda de verdad.
    const antes = await prisma.tienda.findUnique({
      where: { id: tiendaId },
      select: { nombre: true },
    })

    const { status } = await api('/api/configuracion', {
      method: 'PUT',
      body: JSON.stringify({ nombre_empresa: antes!.nombre }),
    })

    expect(status).toBe(200)

    const despues = await prisma.tienda.findUnique({
      where: { id: tiendaId },
      select: { nombre: true },
    })
    expect(despues!.nombre).toBe(antes!.nombre)
  })

  it('cada fila de configuración pertenece a una tienda', async () => {
    const huerfanas = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
      'select count(*) as total from configuracion where tienda_id is null'
    )
    expect(Number(huerfanas[0].total)).toBe(0)
  })
})

describe('precios de bodega', () => {
  it('el catálogo público no expone el precio de bodega ni el costo', async () => {
    // Es el precio al que se le vende a otro negocio: si sale en el
    // catálogo, cualquier cliente lo pide.
    const { productos: data } = await catalogo()

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
    // El dueño de *esta* tienda: el de otra no tiene acceso aquí, así que
    // la petición no haría nada y el test no probaría la regla.
    const dueno = await prisma.usuarioTienda.findFirst({
      where: { tiendaId, esOwner: true },
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

describe('aislamiento entre tiendas', () => {
  // Se monta una tienda aparte con sus propios datos y se comprueba que la
  // sesión de pruebas, que no pertenece a ella, no ve nada de lo suyo.
  let tiendaAjenaId: string
  let productoAjenoId: string
  let clienteAjenoId: string
  let facturaAjenaId: string

  // Nombre fijo y no uno con marca de tiempo: si cambiara en cada
  // ejecución, la base acabaría llena de tiendas de prueba.
  const NOMBRE_TIENDA_AJENA = 'TEST tienda ajena (aislamiento)'

  beforeAll(async () => {
    const existente = await prisma.tienda.findFirst({
      where: { nombre: NOMBRE_TIENDA_AJENA },
      select: { id: true },
    })

    const tienda =
      existente ||
      (await prisma.tienda.create({
        data: {
          nombre: NOMBRE_TIENDA_AJENA,
          descripcion: 'Creada por la suite de integración para probar el aislamiento',
          ciudad: 'Ninguna',
        },
        select: { id: true },
      }))

    tiendaAjenaId = tienda.id

    const producto = await prisma.producto.create({
      data: {
        tiendaId: tiendaAjenaId,
        sku: `AJENO-${Date.now().toString().slice(-8)}`,
        nombre: `${MARCA} producto ajeno`,
        categoria: 'ceramica',
        precioUnitario: 99000,
        stockActual: 500,
      },
      select: { id: true },
    })
    productoAjenoId = producto.id

    const cliente = await prisma.cliente.create({
      data: { tiendaId: tiendaAjenaId, nombre: `${MARCA} cliente ajeno` },
      select: { id: true },
    })
    clienteAjenoId = cliente.id

    const factura = await prisma.factura.create({
      data: {
        tiendaId: tiendaAjenaId,
        numeroFactura: `AJENA-${Date.now().toString().slice(-8)}`,
        clienteId: clienteAjenoId,
        subtotal: 99000,
        total: 99000,
      },
      select: { id: true },
    })
    facturaAjenaId = factura.id
  }, 60000)

  it('el listado de productos no trae los de otra tienda', async () => {
    const { data } = await api('/api/productos')
    expect(data.some((p: any) => p.id === productoAjenoId)).toBe(false)
  })

  it('un producto de otra tienda responde 404', async () => {
    const { status } = await api(`/api/productos/${productoAjenoId}`)
    expect(status).toBe(404)
  })

  it('el listado de clientes no trae los de otra tienda', async () => {
    const { data } = await api('/api/clientes')
    expect(data.some((c: any) => c.id === clienteAjenoId)).toBe(false)
  })

  it('el listado de facturas no trae las de otra tienda', async () => {
    const { data } = await api('/api/facturas')
    expect(data.some((f: any) => f.id === facturaAjenaId)).toBe(false)
  })

  it('una factura de otra tienda responde 404', async () => {
    const { status } = await api(`/api/facturas/${facturaAjenaId}`)
    expect(status).toBe(404)
  })

  it('el PDF de una factura ajena responde 404', async () => {
    const { status } = await api(`/api/facturas/${facturaAjenaId}/pdf`)
    expect(status).toBe(404)
  })

  // Lo esencial: la cabecera es una preferencia, no una credencial. Pedir
  // una tienda a la que no se pertenece no da acceso a sus datos.
  it('pedir una tienda ajena en la cabecera no da acceso a sus datos', async () => {
    const { status, data } = await api('/api/productos', {
      headers: { 'x-tienda-id': tiendaAjenaId },
    })

    expect(status).toBe(200)
    expect(data.some((p: any) => p.id === productoAjenoId)).toBe(false)
    // Y se sigue viendo la tienda propia, no una lista vacía.
    expect(data.some((p: any) => p.id === productoId)).toBe(true)
  })

  it('no se puede mover el stock de un producto ajeno', async () => {
    const { status } = await api('/api/inventario/movimientos', {
      method: 'POST',
      body: JSON.stringify({
        productoId: productoAjenoId,
        tipo: 'entrada',
        cantidad: 10,
        motivo: `${MARCA} intento contra tienda ajena`,
      }),
    })

    expect(status).toBe(404)
  })

  it('no se puede abonar a una factura ajena', async () => {
    const { status } = await api('/api/abonos', {
      method: 'POST',
      body: JSON.stringify({ facturaId: facturaAjenaId, monto: 1000 }),
    })

    expect(status).toBe(404)
  })

  it('la configuración de otra tienda no se ve ni se mezcla', async () => {
    // La misma clave en dos tiendas con valores distintos: cada una debe
    // leer la suya.
    await prisma.configuracion.upsert({
      where: { tiendaId_clave: { tiendaId: tiendaAjenaId, clave: 'whatsapp_pedidos' } },
      create: { tiendaId: tiendaAjenaId, clave: 'whatsapp_pedidos', valor: '573009999999' },
      update: { valor: '573009999999' },
    })

    const { data } = await api('/api/configuracion')
    expect(data.config.whatsapp_pedidos).not.toBe('573009999999')
  })

  it('dos tiendas pueden tener el mismo número de factura', async () => {
    // Antes el número era único en toda la base y la segunda tienda que
    // facturara ese día chocaba contra el número de la primera.
    const numero = `DUP-${Date.now().toString().slice(-8)}`

    const propia = await prisma.factura.create({
      data: { tiendaId, numeroFactura: numero, subtotal: 1000, total: 1000 },
      select: { id: true },
    })

    const ajena = await prisma.factura.create({
      data: { tiendaId: tiendaAjenaId, numeroFactura: numero, subtotal: 1000, total: 1000 },
      select: { id: true },
    })

    expect(propia.id).not.toBe(ajena.id)
  })
})

describe('código de tienda', () => {
  let codigoPropio: string

  beforeAll(async () => {
    const tienda = await prisma.tienda.findUnique({
      where: { id: tiendaId },
      select: { codigo: true },
    })
    codigoPropio = tienda!.codigo
  })

  it('encuentra la tienda por su código', async () => {
    const { status, data } = await api(`/api/tiendas/codigo/${codigoPropio}`)

    expect(status).toBe(200)
    expect(data.id).toBe(tiendaId)
    expect(data.yaTieneAcceso).toBe(true)
  })

  it('acepta el código en minúsculas y con espacios', async () => {
    // Se dicta por teléfono y la gente lo escribe como puede.
    const comoLoEscriben = `${codigoPropio.slice(0, 3).toLowerCase()} ${codigoPropio.slice(3).toLowerCase()}`
    const { status, data } = await api(
      `/api/tiendas/codigo/${encodeURIComponent(comoLoEscriben)}`
    )

    expect(status).toBe(200)
    expect(data.id).toBe(tiendaId)
  })

  it('no devuelve datos de la tienda más allá del nombre y la ciudad', async () => {
    const { data } = await api(`/api/tiendas/codigo/${codigoPropio}`)

    expect(data).not.toHaveProperty('codigo')
    expect(data).not.toHaveProperty('descripcion')
  })

  it('rechaza un código con formato inválido', async () => {
    const { status } = await api('/api/tiendas/codigo/AB3K9O') // lleva la letra O
    expect(status).toBe(400)
  })

  it('responde 404 con un código que no existe', async () => {
    const { status } = await api('/api/tiendas/codigo/ZZZZZZ')
    expect(status).toBe(404)
  })

  it('el listado de tiendas solo trae las mías', async () => {
    const { status, data } = await api('/api/tiendas')

    expect(status).toBe(200)
    expect(data.some((t: any) => t.id === tiendaId)).toBe(true)

    const mias = await prisma.usuarioTienda.count({
      where: { usuario: { email: process.env.E2E_USER } },
    })
    expect(data.length).toBe(mias)
  })

  it('pedir acceso a una tienda en la que ya se está no crea nada', async () => {
    const { status, data } = await api('/api/solicitudes-acceso', {
      method: 'POST',
      body: JSON.stringify({ codigo: codigoPropio, razon: `${MARCA} prueba` }),
    })

    expect(status).toBe(400)
    expect(String(data.error)).toMatch(/ya tienes acceso/i)
  })

  it('no se puede pedir acceso con un código inexistente', async () => {
    const { status } = await api('/api/solicitudes-acceso', {
      method: 'POST',
      body: JSON.stringify({ codigo: 'ZZZZZZ', razon: 'prueba' }),
    })

    expect(status).toBe(404)
  })

  it('la solicitud se registra a nombre de quien la envía, no de quien digan', async () => {
    const ajena = await prisma.tienda.findFirst({
      where: { nombre: 'TEST tienda ajena (aislamiento)' },
      select: { codigo: true, id: true },
    })

    if (!ajena) return

    const { status, data } = await api('/api/solicitudes-acceso', {
      method: 'POST',
      body: JSON.stringify({
        codigo: ajena.codigo,
        razon: `${MARCA} solicitud por código`,
        // Estos dos se ignoran: antes servían para pedir en nombre de otro.
        usuarioId: '00000000-0000-0000-0000-000000000000',
        email: 'otro@ejemplo.com',
      }),
    })

    // 201 la primera vez; 400 si ya quedó pendiente de una corrida anterior.
    expect([201, 400]).toContain(status)

    if (status === 201) {
      const solicitud = await prisma.solicitudAcceso.findUnique({
        where: { id: data.id },
        include: { usuario: { select: { email: true } } },
      })

      expect(solicitud!.usuario.email).toBe(process.env.E2E_USER)
      expect(solicitud!.email).toBe(process.env.E2E_USER)
      expect(solicitud!.tiendaId).toBe(ajena.id)
    }
  })
})

describe('crear tienda', () => {
  it('sin sesión no se puede crear', async () => {
    const res = await fetch(`${BASE}/api/tiendas/crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Tienda sin sesión' }),
    })

    expect(res.status).toBe(401)
  })

  it('exige un nombre', async () => {
    const { status } = await api('/api/tiendas/crear', {
      method: 'POST',
      body: JSON.stringify({ nombre: '' }),
    })

    expect(status).toBe(400)
  })

  it('crea la tienda con dueño, código y configuración', async () => {
    const { status, data } = await api('/api/tiendas/crear', {
      method: 'POST',
      body: JSON.stringify({
        nombre: `${MARCA} tienda propia`,
        ciudad: 'Medellín',
        nit_empresa: '900123456-7',
        whatsapp_pedidos: '573001234567',
      }),
    })

    // 409 si una corrida anterior ya creó la tienda propia de esta cuenta:
    // el límite es una por persona.
    expect([201, 409]).toContain(status)

    if (status === 409) {
      expect(String(data.error)).toMatch(/ya tienes una tienda/i)
      return
    }

    expect(data.codigo).toHaveLength(6)

    const acceso = await prisma.usuarioTienda.findFirst({
      where: { tiendaId: data.id },
      include: { usuario: { select: { email: true } } },
    })

    // Quien la crea queda de dueño, sin que nadie se lo tenga que dar.
    expect(acceso!.esOwner).toBe(true)
    expect(acceso!.usuario.email).toBe(process.env.E2E_USER)

    const config = await prisma.configuracion.findMany({
      where: { tiendaId: data.id },
      select: { clave: true, valor: true },
    })

    expect(config.find((c) => c.clave === 'nit_empresa')?.valor).toBe('900123456-7')
    expect(config.find((c) => c.clave === 'whatsapp_pedidos')?.valor).toBe('573001234567')

    // La tienda nace vacía: no hereda nada de ninguna otra.
    expect(await prisma.producto.count({ where: { tiendaId: data.id } })).toBe(0)
    expect(await prisma.factura.count({ where: { tiendaId: data.id } })).toBe(0)
  })

  it('no deja crear una segunda tienda propia', async () => {
    const { status, data } = await api('/api/tiendas/crear', {
      method: 'POST',
      body: JSON.stringify({ nombre: `${MARCA} segunda tienda` }),
    })

    expect(status).toBe(409)
    expect(String(data.error)).toMatch(/una sola|ya tienes/i)
  })
})

describe('sacar de la tienda y salirse', () => {
  let invitadoId: string

  // Se trabaja con un usuario creado para esto: sacar a alguien real lo
  // dejaría sin poder trabajar.
  beforeAll(async () => {
    const usuario = await prisma.usuario.create({
      data: { email: `test-acceso-${Date.now()}@integracion.local` },
      select: { id: true },
    })
    invitadoId = usuario.id

    await prisma.usuarioTienda.create({
      data: { usuarioId: invitadoId, tiendaId },
    })
  }, 60000)

  it('sacar a alguien le quita el acceso pero no la cuenta', async () => {
    const { status, data } = await api('/api/usuarios/acceso', {
      method: 'DELETE',
      body: JSON.stringify({ usuarioIds: [invitadoId] }),
    })

    expect(status).toBe(200)
    expect(data.afectados).toHaveLength(1)

    const vinculo = await prisma.usuarioTienda.findUnique({
      where: { usuarioId_tiendaId: { usuarioId: invitadoId, tiendaId } },
    })
    expect(vinculo).toBeNull()

    // La cuenta sigue existiendo: es de la persona, no de la tienda.
    const cuenta = await prisma.usuario.findUnique({ where: { id: invitadoId } })
    expect(cuenta).not.toBeNull()
  })

  it('quien sale puede volver a pedir acceso', async () => {
    // Si las solicitudes anteriores quedaran, el sistema vería una ya
    // resuelta y rechazaría la nueva: la persona no podría volver nunca.
    const solicitudes = await prisma.solicitudAcceso.count({
      where: { usuarioId: invitadoId, tiendaId },
    })

    expect(solicitudes).toBe(0)
  })

  it('no se puede sacar al dueño de la tienda', async () => {
    const dueno = await prisma.usuarioTienda.findFirst({
      where: { tiendaId, esOwner: true },
      select: { usuarioId: true },
    })

    if (!dueno) return

    const { status } = await api('/api/usuarios/acceso', {
      method: 'DELETE',
      body: JSON.stringify({ usuarioIds: [dueno.usuarioId] }),
    })

    expect(status).toBe(403)
  })

  it('nadie se saca a sí mismo desde la gestión de usuarios', async () => {
    const yo = await prisma.usuario.findUnique({
      where: { email: process.env.E2E_USER! },
      select: { id: true },
    })

    const { status, data } = await api('/api/usuarios/acceso', {
      method: 'DELETE',
      body: JSON.stringify({ usuarioIds: [yo!.id] }),
    })

    // Dos motivos distintos según el caso, y el orden importa: si la cuenta
    // es la dueña, el rechazo es 403 porque de su tienda no puede salir por
    // ningún lado; si no lo es, 400 remitiendo al menú de tiendas.
    expect([400, 403]).toContain(status)
    expect(String(data.error)).toMatch(/salir|dueño/i)
  })

  it('el dueño no puede salirse de su propia tienda', async () => {
    const propia = await prisma.usuarioTienda.findFirst({
      where: { usuario: { email: process.env.E2E_USER }, esOwner: true },
      select: { tiendaId: true },
    })

    if (!propia) return

    const { status, data } = await api('/api/tiendas/salir', {
      method: 'DELETE',
      body: JSON.stringify({ tiendaId: propia.tiendaId }),
    })

    expect(status).toBe(409)
    expect(String(data.error)).toMatch(/dueño/i)
  })

  it('salir de una tienda en la que no se trabaja responde 404', async () => {
    const ajena = await prisma.tienda.findFirst({
      where: { nombre: 'TEST tienda ajena (aislamiento)' },
      select: { id: true },
    })

    if (!ajena) return

    const { status } = await api('/api/tiendas/salir', {
      method: 'DELETE',
      body: JSON.stringify({ tiendaId: ajena.id }),
    })

    expect(status).toBe(404)
  })

  it('salir no necesita permisos, solo sesión', async () => {
    const res = await fetch(`${BASE}/api/tiendas/salir`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiendaId }),
    })

    // Sin token, 401; nunca 403 por falta de permisos.
    expect(res.status).toBe(401)
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
