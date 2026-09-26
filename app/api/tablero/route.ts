import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda, puede, puedeAlguno, veTodasLasFacturas } from '@/lib/permisos'
import { diaColombiano } from '@/lib/fechas'

/**
 * Las cifras del tablero de /admin, ya calculadas.
 *
 * Antes el tablero bajaba la lista completa de productos, clientes y
 * facturas (todas sus columnas, costo incluido) solo para contarlas y sacar
 * los cinco productos más escasos. Ahora la base cuenta y devuelve eso.
 *
 * Cada cifra respeta el mismo permiso que el listado del que sale: quien no
 * puede ver clientes recibe `null` en esa cifra, no el número.
 */

/** Cuántos productos con stock bajo se listan en el tablero. */
const ALERTAS_EN_TABLERO = 5

interface Alerta {
  id: string
  sku: string
  nombre: string
  stock_actual: number
  stock_minimo: number
}

export async function GET(request: NextRequest) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, [
      'productos.ver',
      'clientes.ver',
      'facturas.ver',
      'facturas.crear',
      'cotizaciones.crear',
    ])
    if (sinPermiso) return sinPermiso

    // Los mismos permisos que piden /api/productos, /api/clientes y /api/facturas.
    const veProductos = puedeAlguno(usuario, ['productos.ver', 'facturas.crear', 'cotizaciones.crear'])
    const veClientes = puedeAlguno(usuario, ['clientes.ver', 'facturas.crear', 'cotizaciones.crear'])
    const veFacturas = puede(usuario, 'facturas.ver')

    // "Hoy" es el día en Colombia. Con el día UTC, después de las 7 p. m. el
    // tablero contaba las facturas de mañana, es decir, ninguna.
    const hoy = diaColombiano(new Date())
    const inicioDeHoy = new Date(`${hoy}T00:00:00-05:00`)
    const inicioDeManana = new Date(inicioDeHoy.getTime() + 24 * 60 * 60 * 1000)

    const [totalProductos, totalClientes, facturasHoy, stockBajo, alertas] = await Promise.all([
      veProductos ? prisma.producto.count({ where: { activo: true, tiendaId } }) : null,
      veClientes ? prisma.cliente.count({ where: { activo: true, tiendaId } }) : null,
      veFacturas
        ? prisma.factura.count({
            where: {
              tiendaId,
              // Sin ver_todas, las suyas: lo mismo que ve en el listado.
              ...(veTodasLasFacturas(usuario) ? {} : { usuarioId: usuario.id }),
              fecha: { gte: inicioDeHoy, lt: inicioDeManana },
            },
          })
        : null,
      veProductos
        ? prisma.$queryRaw<{ n: number }[]>`
            SELECT count(*)::int AS n
              FROM public.productos
             WHERE activo AND tienda_id = ${tiendaId}::uuid AND stock_actual < stock_minimo`
        : null,
      // Los más críticos primero: mayor déficit frente al mínimo.
      veProductos
        ? prisma.$queryRaw<Alerta[]>`
            SELECT id, sku, nombre,
                   stock_actual::float AS stock_actual,
                   stock_minimo::float AS stock_minimo
              FROM public.productos
             WHERE activo AND tienda_id = ${tiendaId}::uuid AND stock_actual < stock_minimo
             ORDER BY (stock_actual - stock_minimo) ASC, nombre ASC
             LIMIT ${ALERTAS_EN_TABLERO}`
        : null,
    ])

    return NextResponse.json({
      totalProductos,
      totalClientes,
      facturasHoy,
      stockBajo: stockBajo ? stockBajo[0].n : veProductos ? 0 : null,
      alertas: (alertas || []).map((a) => ({
        id: a.id,
        sku: a.sku,
        nombre: a.nombre,
        stockActual: Number(a.stock_actual),
        stockMinimo: Number(a.stock_minimo),
      })),
    })
  } catch (error) {
    console.error('Error cargando el tablero:', error)
    return NextResponse.json({ error: 'Error al cargar el tablero' }, { status: 500 })
  }
}
