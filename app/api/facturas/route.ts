import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda, veTodasLasFacturas, puede } from '@/lib/permisos'

function generateFacturaNumber(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const datePrefix = `${year}${month}${day}`

  return datePrefix
}

/**
 * Consecutivo del día, contado dentro de la tienda.
 *
 * Cada tienda lleva su propia numeración: si fuera global, a un negocio le
 * saltarían números porque otro facturó ese día, y el consecutivo de una
 * factura es algo que se explica ante la DIAN.
 */
async function getNextSequence(datePrefix: string, tiendaId: string): Promise<number> {
  const emitidas = await prisma.factura.count({
    where: {
      tiendaId,
      numeroFactura: {
        startsWith: datePrefix,
      },
    },
  })

  return emitidas + 1
}

export async function GET(request: NextRequest) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'facturas.ver')
    if (sinPermiso) return sinPermiso

    const { searchParams } = new URL(request.url)

    // Dos filtros encadenados: la tienda activa siempre, y dentro de ella,
    // quien no tenga 'facturas.ver_todas' solo ve las que él creó. El
    // alcance sale del token, no de un parámetro de la petición: antes el
    // filtro dependía de que el cliente enviara ?email=, así que omitirlo
    // mostraba las facturas de todos.
    const filtro: any = veTodasLasFacturas(usuario)
      ? { tiendaId }
      : { tiendaId, usuarioId: usuario.id }

    // El listado solo necesita la cabecera de cada factura. Traer los items
    // con su producto completo multiplicaba el tiempo de respuesta por tres
    // sin que la UI los usara; el detalle los carga en /api/facturas/[id].
    const limite = parseInt(searchParams.get('limit') || '', 10)

    const facturas = await prisma.factura.findMany({
      where: filtro,
      select: {
        id: true,
        numeroFactura: true,
        fecha: true,
        total: true,
        estado: true,
        terminoPago: true,
        anticipo: true,
        usuarioId: true,
        cliente: { select: { id: true, nombre: true, cedulaCc: true } },
        usuario: { select: { id: true, email: true } },
      },
      orderBy: { fecha: 'desc' },
      ...(Number.isFinite(limite) && limite > 0 ? { take: limite } : {}),
    })

    return NextResponse.json(facturas)
  } catch (error) {
    return NextResponse.json(
      { error: 'Error fetching facturas' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'facturas.crear')
    if (sinPermiso) return sinPermiso

    const data = await request.json()

    // La factura nace sin abono: registrar un anticipo al crearla es, en el
    // fondo, lo mismo que abonarla, así que exige el mismo permiso. Sin él,
    // el vendedor sigue pudiendo facturar, solo que queda pendiente.
    const anticipoSolicitado = data.anticipo ? parseFloat(data.anticipo) : 0
    if (anticipoSolicitado > 0 && !puede(usuario, 'facturas.abonar', tiendaId)) {
      return NextResponse.json(
        { error: 'No tienes permiso para registrar un anticipo' },
        { status: 403 }
      )
    }

    const datePrefix = generateFacturaNumber()
    const sequence = await getNextSequence(datePrefix, tiendaId)
    const numeroFactura = `${datePrefix}-${String(sequence).padStart(3, '0')}`

    const factura = await prisma.$transaction(async (tx) => {
      const nuevaFactura = await tx.factura.create({
        data: {
          numeroFactura,
          // La tienda y el autor salen de la sesión. El usuarioId que
          // llegaba en el cuerpo permitía facturar a nombre de otro.
          tiendaId,
          clienteId: data.clienteId || null,
          usuarioId: usuario.id,
          terminoPago: data.terminoPago || null,
          metodoPago: data.metodoPago || null,
          anticipo: data.anticipo ? parseFloat(data.anticipo) : 0,
          contraEntrega: data.contraEntrega ? parseFloat(data.contraEntrega) : 0,
          subtotal: parseFloat(data.subtotal || 0),
          descuentoPorcentaje: data.descuentoPorcentaje ? parseFloat(data.descuentoPorcentaje) : 0,
          descuentoMonto: data.descuentoMonto ? parseFloat(data.descuentoMonto) : 0,
          impuesto: parseFloat(data.impuesto || 0),
          total: parseFloat(data.total || 0),
          estado: 'pendiente',
          esBodega: Boolean(data.esBodega),
          observaciones: data.observaciones || null,
          items: {
            create: data.items?.map((item: any) => ({
              productoId: item.productoId || null,
              productoNombre: item.productoNombre || null,
              cantidadM2: parseFloat(item.cantidadM2),
              precioUnitario: parseFloat(item.precioUnitario),
              subtotal: parseFloat(item.subtotal),
            })) || [],
          },
        },
        include: {
          cliente: true,
          usuario: true,
          items: {
            include: {
              producto: true,
            },
          },
        },
      })

      // Descontar stock de los productos del catálogo.
      // Los items personalizados no tienen productoId y no afectan inventario.
      const cantidadPorProducto = new Map<string, number>()
      for (const item of data.items || []) {
        if (!item.productoId) continue
        const acumulado = cantidadPorProducto.get(item.productoId) || 0
        cantidadPorProducto.set(item.productoId, acumulado + parseFloat(item.cantidadM2))
      }

      if (cantidadPorProducto.size > 0) {
        // Solo productos de esta tienda: si en los items viniera el id de
        // un producto ajeno, se ignora en vez de descontarle stock.
        const productos = await tx.producto.findMany({
          where: { id: { in: Array.from(cantidadPorProducto.keys()) }, tiendaId },
          select: { id: true, stockActual: true },
        })

        const movimientos = productos.map((producto) => {
          const cantidad = cantidadPorProducto.get(producto.id)!
          const stockAntes = Number(producto.stockActual)

          // Se permite facturar por encima del stock disponible, pero el
          // inventario nunca queda en negativo: el piso es cero.
          const stockDespues = Math.max(0, stockAntes - cantidad)
          const faltante = cantidad - (stockAntes - stockDespues)

          return {
            productoId: producto.id,
            tipo: 'salida',
            cantidad,
            stockAntes,
            stockDespues,
            referenciaTipo: 'factura',
            referenciaId: nuevaFactura.id,
            motivo:
              faltante > 0
                ? `Venta - Factura ${numeroFactura} (se facturaron ${faltante} m² sin stock disponible)`
                : `Venta - Factura ${numeroFactura}`,
            usuarioId: usuario.id,
          }
        })

        await Promise.all(
          movimientos.map((m) =>
            tx.producto.update({
              where: { id: m.productoId },
              data: { stockActual: m.stockDespues },
            })
          )
        )

        await tx.inventarioMovimiento.createMany({ data: movimientos })
      }

      return nuevaFactura
    }, { timeout: 20000 })

    // Registrar en auditoría
    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: data.usuarioId || null,
          tablaAfectada: 'facturas',
          registroId: factura.id,
          accion: 'CREATE',
          datosDespues: {
            numeroFactura: factura.numeroFactura,
            total: Number(factura.total),
            estado: factura.estado,
            clienteId: factura.clienteId,
          },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json(factura, { status: 201 })
  } catch (error: any) {
    console.error('POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Error creating factura' },
      { status: 400 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json()
    const { id } = data

    // Anular es una acción aparte: se puede facturar sin poder deshacer lo
    // que ya se facturó. Pagada y entregada son decisiones de dinero: quien
    // factura no necesariamente puede decir que se cobró.
    const permisoNecesario =
      data.estado === 'anulado'
        ? 'facturas.anular'
        : data.estado === 'pagado' || data.estado === 'entregado'
          ? 'facturas.abonar'
          : 'facturas.crear'

    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, permisoNecesario)
    if (sinPermiso) return sinPermiso

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    // Obtener factura anterior, comprobando de paso que sea de esta tienda.
    const facturaBefore = await prisma.factura.findFirst({
      where: { id, tiendaId },
    })

    if (!facturaBefore) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // Subir el anticipo desde aquí es lo mismo que abonar: exige el mismo
    // permiso, aunque el estado que se esté pidiendo sea 'pendiente'.
    const anticipoNuevo = data.anticipo ? parseFloat(data.anticipo) : 0
    if (anticipoNuevo > Number(facturaBefore.anticipo) && !puede(usuario, 'facturas.abonar', tiendaId)) {
      return NextResponse.json(
        { error: 'No tienes permiso para registrar un anticipo' },
        { status: 403 }
      )
    }

    const updateData: any = {
      terminoPago: data.terminoPago || null,
      metodoPago: data.metodoPago || null,
      anticipo: data.anticipo ? parseFloat(data.anticipo) : 0,
      contraEntrega: data.contraEntrega ? parseFloat(data.contraEntrega) : 0,
      subtotal: parseFloat(data.subtotal || 0),
      descuentoPorcentaje: data.descuentoPorcentaje ? parseFloat(data.descuentoPorcentaje) : 0,
      descuentoMonto: data.descuentoMonto ? parseFloat(data.descuentoMonto) : 0,
      impuesto: parseFloat(data.impuesto || 0),
      total: parseFloat(data.total || 0),
      estado: data.estado || 'pendiente',
      observaciones: data.observaciones || null,
    }

    if (data.estado === 'pagado') {
      updateData.fechaPago = new Date()
    }

    const factura = await prisma.factura.update({
      where: { id },
      data: updateData,
      include: {
        cliente: true,
        usuario: true,
        items: {
          include: {
            producto: true,
          },
        },
      },
    })

    // Registrar en auditoría
    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: data.usuarioId || null,
          tablaAfectada: 'facturas',
          registroId: id,
          accion: 'UPDATE',
          datosAntes: {
            estado: facturaBefore?.estado,
            total: facturaBefore?.total ? Number(facturaBefore.total) : 0,
            anticipo: facturaBefore?.anticipo ? Number(facturaBefore.anticipo) : 0,
          },
          datosDespues: {
            estado: factura.estado,
            total: Number(factura.total),
            anticipo: Number(factura.anticipo),
          },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json(factura)
  } catch (error: any) {
    console.error('PUT error:', error)
    return NextResponse.json(
      { error: error.message || 'Error updating factura' },
      { status: 400 }
    )
  }
}
