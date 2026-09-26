import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda, puede } from '@/lib/permisos'
import { leerPagina, MINIMO_BUSQUEDA } from '@/lib/paginacion'
import { diaColombiano } from '@/lib/fechas'

/**
 * Cotizaciones: como una factura, pero sin vender. No descuentan inventario,
 * no llevan abonos ni estados de pago; solo se guardan para consultarlas.
 */

/** Prefijo del consecutivo del día en Colombia: `COT-20260925`. */
function prefijoDelDia(): string {
  return `COT-${diaColombiano(new Date()).replace(/-/g, '')}`
}

export async function GET(request: NextRequest) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'cotizaciones.ver')
    if (sinPermiso) return sinPermiso

    const { searchParams } = new URL(request.url)
    const { limite, desde } = leerPagina(searchParams)
    const busqueda = (searchParams.get('busqueda') || '').trim()

    // Como en facturas: sin 'cotizaciones.ver_todas' cada quien ve las suyas.
    // La búsqueda se suma a este alcance, nunca lo amplía.
    const where: any = puede(usuario, 'cotizaciones.ver_todas')
      ? { tiendaId }
      : { tiendaId, usuarioId: usuario.id }

    if (busqueda.length >= MINIMO_BUSQUEDA) {
      where.OR = [
        { numeroCotizacion: { contains: busqueda, mode: 'insensitive' } },
        { cliente: { nombre: { contains: busqueda, mode: 'insensitive' } } },
        { cliente: { cedulaCc: { contains: busqueda } } },
      ]
    }

    const [cotizaciones, total] = await Promise.all([
      prisma.cotizacion.findMany({
        where,
        select: {
          id: true,
          numeroCotizacion: true,
          fecha: true,
          total: true,
          cliente: { select: { nombre: true, cedulaCc: true } },
          usuario: { select: { email: true } },
        },
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        take: limite,
        skip: desde,
      }),
      prisma.cotizacion.count({ where }),
    ])

    return NextResponse.json({ cotizaciones, total })
  } catch (error) {
    console.error('Error listando cotizaciones:', error)
    return NextResponse.json({ error: 'Error al obtener las cotizaciones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'cotizaciones.crear')
    if (sinPermiso) return sinPermiso

    const data = await request.json()
    const items: any[] = Array.isArray(data.items) ? data.items : []

    if (items.length === 0) {
      return NextResponse.json({ error: 'Agrega al menos un producto' }, { status: 400 })
    }

    // El cliente y los productos tienen que ser de esta tienda. Un cliente
    // ajeno se rechaza; un producto ajeno se guarda solo con su nombre, sin
    // enlazarlo, para no apuntar al catálogo de otro negocio.
    if (data.clienteId) {
      const cliente = await prisma.cliente.findFirst({
        where: { id: data.clienteId, tiendaId },
        select: { id: true },
      })
      if (!cliente) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
      }
    }

    const idsPedidos = items.map((i) => i.productoId).filter(Boolean)
    const propios = new Set(
      (
        await prisma.producto.findMany({
          where: { id: { in: idsPedidos }, tiendaId },
          select: { id: true },
        })
      ).map((p) => p.id)
    )

    const prefijo = prefijoDelDia()

    // El consecutivo se calcula contando las del día. Si dos personas
    // cotizan a la vez, las dos sacan el mismo número y el índice único
    // rechaza a la segunda: se reintenta con el siguiente.
    let cotizacion = null
    for (let intento = 0; intento < 3 && !cotizacion; intento++) {
      const emitidas = await prisma.cotizacion.count({
        where: { tiendaId, numeroCotizacion: { startsWith: prefijo } },
      })
      // Al reintentar, el conteo ya incluye la que ganó la carrera.
      const numeroCotizacion = `${prefijo}-${String(emitidas + 1).padStart(3, '0')}`

      try {
        cotizacion = await prisma.cotizacion.create({
          data: {
            numeroCotizacion,
            // La tienda y el autor salen de la sesión, nunca del cuerpo.
            tiendaId,
            usuarioId: usuario.id,
            clienteId: data.clienteId || null,
            terminoPago: data.terminoPago || null,
            metodoPago: data.metodoPago || null,
            subtotal: parseFloat(data.subtotal || 0),
            descuentoPorcentaje: data.descuentoPorcentaje ? parseFloat(data.descuentoPorcentaje) : 0,
            descuentoMonto: data.descuentoMonto ? parseFloat(data.descuentoMonto) : 0,
            impuesto: parseFloat(data.impuesto || 0),
            total: parseFloat(data.total || 0),
            esBodega: Boolean(data.esBodega),
            observaciones: data.observaciones || null,
            items: {
              create: items.map((item) => ({
                productoId: item.productoId && propios.has(item.productoId) ? item.productoId : null,
                productoNombre: item.productoNombre || null,
                cantidadM2: parseFloat(item.cantidadM2),
                precioUnitario: parseFloat(item.precioUnitario),
                subtotal: parseFloat(item.subtotal),
              })),
            },
          },
          select: { id: true, numeroCotizacion: true, total: true },
        })
      } catch (error: any) {
        if (error?.code !== 'P2002') throw error
      }
    }

    if (!cotizacion) {
      return NextResponse.json(
        { error: 'No se pudo asignar un número a la cotización, inténtalo de nuevo' },
        { status: 409 }
      )
    }

    // Sin movimientos de inventario: cotizar no vende nada.

    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: usuario.id,
          tiendaId,
          tablaAfectada: 'cotizaciones',
          registroId: cotizacion.id,
          accion: 'CREATE',
          datosDespues: {
            numeroCotizacion: cotizacion.numeroCotizacion,
            total: Number(cotizacion.total),
            clienteId: data.clienteId || null,
          },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json(cotizacion, { status: 201 })
  } catch (error: any) {
    console.error('Error creando cotización:', error)
    return NextResponse.json(
      { error: error.message || 'Error al crear la cotización' },
      { status: 400 }
    )
  }
}
