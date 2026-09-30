import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { leerPagina } from '@/lib/paginacion'
import {
  cantidadPendiente,
  costoDeItem,
  ESTADOS_LIQUIDABLES,
  totalesDeLiquidacion,
  ventaSinImpuesto,
} from '@/lib/liquidacion'
import { leerCuerpo, liquidacionNueva } from '@/lib/esquemas'

/**
 * Liquidaciones de vendedores: el cierre de sus facturas cobradas.
 *
 * Solo dueño, administrador o quien tenga `liquidaciones.*`. La ganancia es
 * la venta sin impuesto menos el costo, y al vendedor se le paga un
 * porcentaje. Las facturas quedan en estado "liquidado" y ya no cambian.
 */

export async function GET(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'liquidaciones.ver')
    if (sinPermiso) return sinPermiso

    const { searchParams } = new URL(request.url)
    const { limite, desde } = leerPagina(searchParams)
    const where = { tiendaId }

    const [liquidaciones, total] = await Promise.all([
      prisma.liquidacion.findMany({
        where,
        select: {
          id: true,
          fecha: true,
          porcentaje: true,
          totalVenta: true,
          totalCosto: true,
          totalGanancia: true,
          pagoVendedor: true,
          vendedor: { select: { email: true } },
          _count: { select: { facturas: true } },
        },
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        take: limite,
        skip: desde,
      }),
      prisma.liquidacion.count({ where }),
    ])

    return NextResponse.json({
      total,
      liquidaciones: liquidaciones.map((l) => ({
        id: l.id,
        fecha: l.fecha,
        vendedor: l.vendedor.email,
        facturas: l._count.facturas,
        porcentaje: Number(l.porcentaje),
        totalVenta: Number(l.totalVenta),
        totalCosto: Number(l.totalCosto),
        totalGanancia: Number(l.totalGanancia),
        pagoVendedor: Number(l.pagoVendedor),
      })),
    })
  } catch (error) {
    console.error('Error listando liquidaciones:', error)
    return NextResponse.json({ error: 'Error al obtener las liquidaciones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'liquidaciones.crear')
    if (sinPermiso) return sinPermiso

    // Identificadores uuid (uno inventado hacía fallar la consulta con un
    // 500), de 1 a 100 facturas sin repetir, porcentaje de 0 a 100 y costos
    // sin negativos.
    const { datos: data, error: invalido } = await leerCuerpo(request, liquidacionNueva)
    if (invalido) return invalido
    const { vendedorId, facturaIds, porcentaje, costos, costosFacturados } = data

    // Todo se comprueba en el servidor: que las facturas sean de la tienda,
    // del vendedor elegido, estén cobradas y no liquidadas ya.
    const facturas = await prisma.factura.findMany({
      where: {
        id: { in: facturaIds },
        tiendaId,
        // La factura se liquida a quien se vendió, no a quien la registró.
        vendedorId,
        estado: { in: ESTADOS_LIQUIDABLES },
        liquidacionId: null,
      },
      select: {
        id: true,
        numeroFactura: true,
        subtotal: true,
        descuentoMonto: true,
        items: {
          select: {
            id: true,
            productoNombre: true,
            cantidadM2: true,
            cantidadConCosto: true,
            costoUnitario: true,
          },
        },
      },
    })

    if (facturas.length !== facturaIds.length) {
      return NextResponse.json(
        {
          error:
            'Alguna factura ya no se puede liquidar: no es de este vendedor, no está cobrada o ya se liquidó. Recarga la lista.',
        },
        { status: 409 }
      )
    }

    // El costo de lo vendido sin stock lo pone quien liquida. Sin él no se
    // conoce la ganancia, así que no se liquida a medias.
    const faltan: string[] = []
    const costoPorFactura = facturas.map((f) => {
      let costo = 0
      for (const item of f.items) {
        const base = {
          cantidadM2: Number(item.cantidadM2),
          cantidadConCosto: Number(item.cantidadConCosto),
          costoUnitario: item.costoUnitario === null ? null : Number(item.costoUnitario),
        }
        const pendiente = costos[item.id] === undefined ? null : Number(costos[item.id])
        const facturado = costosFacturados[item.id] === undefined ? null : Number(costosFacturados[item.id])
        const valor = costoDeItem(base, pendiente, facturado)

        if (valor === null) faltan.push(`${f.numeroFactura}: ${item.productoNombre || 'producto'}`)
        else costo += valor
      }

      return {
        factura: f,
        venta: ventaSinImpuesto({ subtotal: Number(f.subtotal), descuentoMonto: Number(f.descuentoMonto) }),
        costo,
      }
    })

    if (faltan.length > 0) {
      return NextResponse.json(
        { error: 'Falta el costo de lo vendido sin stock', faltan },
        { status: 400 }
      )
    }

    const totales = totalesDeLiquidacion(costoPorFactura, porcentaje)

    const liquidacion = await prisma.$transaction(async (tx) => {
      const creada = await tx.liquidacion.create({
        data: {
          tiendaId,
          vendedorId,
          creadaPor: usuario.id,
          porcentaje,
          ...totales,
          observaciones: data.observaciones,
        },
        select: { id: true },
      })

      // Se guarda el costo que se usó para lo que no tenía, para que la
      // liquidación se pueda explicar después.
      const conCostoPuesto = facturas.flatMap((f) =>
        f.items.filter((item) =>
          cantidadPendiente({
            cantidadM2: Number(item.cantidadM2),
            cantidadConCosto: Number(item.cantidadConCosto),
            costoUnitario: null,
          }) > 0
        )
      )
      // Si se corrigió el costo al facturar, queda en la línea.
      const corregidos = facturas.flatMap((f) =>
        f.items.filter(
          (item) =>
            Number(item.cantidadConCosto) > 0 &&
            costosFacturados[item.id] !== undefined &&
            Number(costosFacturados[item.id]) !== Number(item.costoUnitario)
        )
      )
      await Promise.all(
        corregidos.map((item) =>
          tx.facturaItem.update({
            where: { id: item.id },
            data: { costoUnitario: Number(costosFacturados[item.id]) },
          })
        )
      )
      await Promise.all(
        conCostoPuesto.map((item) =>
          tx.facturaItem.update({
            where: { id: item.id },
            data: { costoLiquidacion: Number(costos[item.id]) },
          })
        )
      )

      // Con las mismas condiciones del principio: si otra persona liquidó
      // alguna de estas facturas mientras tanto, no se liquida dos veces.
      const { count } = await tx.factura.updateMany({
        where: {
          id: { in: facturaIds },
          tiendaId,
          estado: { in: ESTADOS_LIQUIDABLES },
          liquidacionId: null,
        },
        data: { estado: 'liquidado', liquidacionId: creada.id },
      })

      if (count !== facturaIds.length) throw new Error('YA_LIQUIDADAS')

      return creada
    }, { timeout: 20000 })

    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: usuario.id,
          tiendaId,
          tablaAfectada: 'liquidaciones',
          registroId: liquidacion.id,
          accion: 'CREATE',
          datosDespues: { vendedorId, facturas: facturaIds.length, porcentaje, ...totales },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json({ id: liquidacion.id, ...totales }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'YA_LIQUIDADAS') {
      return NextResponse.json(
        { error: 'Alguna factura se liquidó mientras tanto. Recarga la lista.' },
        { status: 409 }
      )
    }

    console.error('Error creando liquidación:', error)
    return NextResponse.json({ error: 'Error al crear la liquidación' }, { status: 500 })
  }
}
