import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { cantidadPendiente, ESTADOS_LIQUIDABLES, ventaSinImpuesto } from '@/lib/liquidacion'

/**
 * Lo que queda por liquidar en la tienda.
 *
 * Sin `vendedorId`: los vendedores con facturas cobradas sin liquidar y
 * cuántas son. Con `vendedorId`: esas facturas, con cada línea y lo que
 * falta saber de su costo.
 */

/** Tope por vendedor: una liquidación con cientos de facturas no se revisa bien. */
const MAXIMO_FACTURAS = 100

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'liquidaciones.crear')
    if (sinPermiso) return sinPermiso

    const vendedorId = new URL(request.url).searchParams.get('vendedorId')

    const liquidables = {
      tiendaId,
      estado: { in: ESTADOS_LIQUIDABLES },
      liquidacionId: null,
    }

    if (!vendedorId) {
      const grupos = await prisma.factura.groupBy({
        by: ['usuarioId'],
        where: { ...liquidables, usuarioId: { not: null } },
        _count: { _all: true },
      })

      const usuarios = await prisma.usuario.findMany({
        where: { id: { in: grupos.map((g) => g.usuarioId!) } },
        select: { id: true, email: true },
      })
      const emailDe = new Map(usuarios.map((u) => [u.id, u.email]))

      return NextResponse.json({
        vendedores: grupos
          .map((g) => ({ id: g.usuarioId!, email: emailDe.get(g.usuarioId!) || '—', facturas: g._count._all }))
          .sort((a, b) => a.email.localeCompare(b.email, 'es')),
      })
    }

    if (!UUID.test(vendedorId)) {
      return NextResponse.json({ facturas: [], total: 0 })
    }

    const where = { ...liquidables, usuarioId: vendedorId }

    const [facturas, total] = await Promise.all([
      prisma.factura.findMany({
        where,
        select: {
          id: true,
          numeroFactura: true,
          fecha: true,
          estado: true,
          subtotal: true,
          descuentoMonto: true,
          impuesto: true,
          total: true,
          cliente: { select: { nombre: true } },
          items: {
            select: {
              id: true,
              productoNombre: true,
              cantidadM2: true,
              precioUnitario: true,
              subtotal: true,
              costoUnitario: true,
              cantidadConCosto: true,
              producto: { select: { nombre: true, costo: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        // Las más viejas primero: son las que llevan más tiempo esperando.
        orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
        take: MAXIMO_FACTURAS,
      }),
      prisma.factura.count({ where }),
    ])

    return NextResponse.json({
      total,
      facturas: facturas.map((f) => ({
        id: f.id,
        numeroFactura: f.numeroFactura,
        fecha: f.fecha,
        estado: f.estado,
        cliente: f.cliente?.nombre || null,
        venta: ventaSinImpuesto({ subtotal: Number(f.subtotal), descuentoMonto: Number(f.descuentoMonto) }),
        impuesto: Number(f.impuesto),
        total: Number(f.total),
        items: f.items.map((item) => {
          const base = {
            cantidadM2: Number(item.cantidadM2),
            cantidadConCosto: Number(item.cantidadConCosto),
            costoUnitario: item.costoUnitario === null ? null : Number(item.costoUnitario),
          }

          return {
            id: item.id,
            nombre: item.productoNombre || item.producto?.nombre || '(Personalizado)',
            precioUnitario: Number(item.precioUnitario),
            subtotal: Number(item.subtotal),
            ...base,
            pendiente: cantidadPendiente(base),
            // Si el producto existe se propone su costo actual, aunque tenga
            // stock 0. Uno personalizado, o sin costo cargado, no trae
            // sugerencia: hay que escribirlo.
            productoExiste: Boolean(item.producto),
            costoSugerido: item.producto?.costo === null || item.producto?.costo === undefined
              ? null
              : Number(item.producto.costo),
          }
        }),
      })),
    })
  } catch (error) {
    console.error('Error obteniendo lo pendiente por liquidar:', error)
    return NextResponse.json({ error: 'Error al obtener las facturas por liquidar' }, { status: 500 })
  }
}
