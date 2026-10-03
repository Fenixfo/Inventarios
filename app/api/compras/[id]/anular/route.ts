import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { compraAnulacion, leerCuerpo } from '@/lib/esquemas'

/**
 * Anular una compra: una compra no se edita ni se borra, se anula con un motivo.
 *
 * En una transacción: la compra pasa a "anulada" (solo si sigue registrada), se
 * resta de cada producto el stock que sumó y queda un movimiento de salida por
 * línea. Si algún producto ya no tiene stock suficiente (porque se vendió), no
 * se anula nada.
 *
 * No borra productos, ni siquiera los que creó la compra (pueden tener ventas),
 * y NO restaura el costo: con compras posteriores no se sabe cuál era el bueno.
 * Por eso la respuesta avisa que el costo debe revisarse.
 */

const redondear = (valor: number) => Math.round(valor * 100) / 100

class ErrorAnulacion extends Error {
  constructor(readonly estado: number, readonly cuerpo: Record<string, unknown>) {
    super(String(cuerpo.error))
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'compras.anular')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    const { datos, error: invalido } = await leerCuerpo(request, compraAnulacion)
    if (invalido) return invalido

    // Con la tienda en el where, la de otra tienda responde "no encontrada".
    const compra = await prisma.compra.findFirst({
      where: { id, tiendaId },
      select: {
        id: true,
        estado: true,
        numeroFacturaProveedor: true,
        proveedor: { select: { nombre: true } },
        items: {
          select: {
            productoId: true,
            cantidad: true,
            productoNombre: true,
            producto: { select: { sku: true } },
          },
        },
      },
    })
    if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    if (compra.estado === 'anulada') {
      return NextResponse.json({ error: 'La compra ya está anulada' }, { status: 409 })
    }

    const items = compra.items.map((i) => ({ ...i, cantidad: Number(i.cantidad) }))

    await prisma.$transaction(
      async (tx) => {
        // Solo si sigue registrada: si otra persona la anuló mientras tanto, no se resta dos veces.
        const { count } = await tx.compra.updateMany({
          where: { id, tiendaId, estado: 'registrada' },
          data: {
            estado: 'anulada',
            anuladaPor: usuario.id,
            anuladaEn: new Date(),
            motivoAnulacion: datos.motivo,
          },
        })
        if (count === 0) throw new ErrorAnulacion(409, { error: 'La compra ya está anulada' })

        // Resta el stock de todos los productos de una vez, y solo donde alcanza.
        const valores = items.map((i) => Prisma.sql`(${i.productoId}::uuid, ${i.cantidad}::numeric)`)
        const filas = await tx.$queryRaw<{ id: string; stock_actual: unknown }[]>(Prisma.sql`
          UPDATE productos AS p
             SET stock_actual = p.stock_actual - v.cantidad,
                 updated_at = now()
            FROM (VALUES ${Prisma.join(valores)}) AS v(id, cantidad)
           WHERE p.id = v.id AND p.tienda_id = ${tiendaId}::uuid AND p.stock_actual >= v.cantidad
          RETURNING p.id, p.stock_actual
        `)

        if (filas.length !== items.length) {
          // Alguno no alcanza: se dice cuál y cuánto falta. Al lanzar el error se
          // deshace todo, también lo que sí se había restado de los demás.
          const restados = new Set(filas.map((f) => f.id))
          const sinAlcanzar = items.filter((i) => !restados.has(i.productoId))
          const actuales = await tx.producto.findMany({
            where: { id: { in: sinAlcanzar.map((i) => i.productoId) } },
            select: { id: true, stockActual: true },
          })
          const stockDe = new Map(actuales.map((p) => [p.id, Number(p.stockActual)]))

          const productos = sinAlcanzar.map((i) => ({
            sku: i.producto.sku,
            nombre: i.productoNombre,
            faltante: redondear(i.cantidad - (stockDe.get(i.productoId) ?? 0)),
          }))
          const detalle = productos.map((p) => `${p.nombre} (${p.sku}): faltan ${p.faltante}`).join('; ')

          throw new ErrorAnulacion(409, {
            error: `No se puede anular: ya no hay stock suficiente porque se vendió. ${detalle}`,
            tipo: 'stock_insuficiente',
            productos,
          })
        }

        const stockDespues = new Map(filas.map((f) => [f.id, Number(f.stock_actual)]))
        const referencia = compra.numeroFacturaProveedor ? ` - Factura ${compra.numeroFacturaProveedor}` : ''

        await tx.inventarioMovimiento.createMany({
          data: items.map((i) => {
            const despues = stockDespues.get(i.productoId)!
            return {
              productoId: i.productoId,
              tipo: 'salida',
              cantidad: i.cantidad,
              stockAntes: redondear(despues + i.cantidad),
              stockDespues: despues,
              referenciaTipo: 'anulacion_compra',
              referenciaId: compra.id,
              motivo: `Anulación de compra a ${compra.proveedor.nombre}${referencia}: ${datos.motivo}`,
              usuarioId: usuario.id,
            }
          }),
        })
      },
      { timeout: 20000 }
    )

    // Auditoría fuera de la transacción: si falla, la anulación ya es válida.
    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: usuario.id,
          tiendaId,
          tablaAfectada: 'compras',
          registroId: compra.id,
          accion: 'UPDATE',
          datosAntes: { estado: 'registrada' },
          datosDespues: { estado: 'anulada', motivo: datos.motivo, lineas: items.length },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría de la anulación:', auditError)
    }

    return NextResponse.json({
      id: compra.id,
      estado: 'anulada',
      // La anulación no restaura el costo de los productos.
      revisarCostos: true,
    })
  } catch (error: any) {
    if (error instanceof ErrorAnulacion) return NextResponse.json(error.cuerpo, { status: error.estado })

    console.error('Error anulando compra:', error)
    return NextResponse.json({ error: 'No se pudo anular la compra' }, { status: 500 })
  }
}
