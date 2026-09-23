import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { exigirPermiso } from '@/lib/permisos'

const TIPOS_VALIDOS = ['entrada', 'salida', 'ajuste'] as const

const movimientoSchema = z
  .object({
    productoId: z.string().uuid('Producto inválido'),
    tipo: z.enum(TIPOS_VALIDOS),
    // En un ajuste la cantidad es el stock real contado, y cero es un
    // resultado válido (producto agotado). En entradas y salidas, no.
    cantidad: z.number().min(0, 'La cantidad no puede ser negativa'),
    motivo: z.string().trim().min(1, 'El motivo es obligatorio'),
    // Solo sirve para atribuir el movimiento a un usuario. Si no llega, no
    // corresponde a nadie o tiene un formato raro, el movimiento se registra
    // igual sin autor: no es motivo para rechazar la operación.
    email: z.string().trim().optional().nullable(),
  })
  .refine((d) => d.tipo === 'ajuste' || d.cantidad > 0, {
    message: 'La cantidad debe ser mayor a cero',
    path: ['cantidad'],
  })

async function resolverUsuario(email: string | null | undefined) {
  if (!email) return null
  return prisma.usuario.findUnique({
    where: { email },
    select: { id: true },
  })
}

export async function GET(request: NextRequest) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'inventario.ver')
    if (sinPermiso) return sinPermiso

    const { searchParams } = new URL(request.url)
    const productoId = searchParams.get('productoId')
    const tipo = searchParams.get('tipo')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')

    const where: any = {}

    if (productoId) where.productoId = productoId
    if (tipo && TIPOS_VALIDOS.includes(tipo as any)) where.tipo = tipo

    if (desde || hasta) {
      where.fechaMovimiento = {}
      if (desde) where.fechaMovimiento.gte = new Date(desde)
      if (hasta) {
        const fin = new Date(hasta)
        fin.setHours(23, 59, 59, 999)
        where.fechaMovimiento.lte = fin
      }
    }

    const movimientos = await prisma.inventarioMovimiento.findMany({
      where,
      include: {
        producto: { select: { sku: true, nombre: true } },
        usuario: { select: { email: true } },
      },
      orderBy: { fechaMovimiento: 'desc' },
      take: 200,
    })

    return NextResponse.json(
      movimientos.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        cantidad: Number(m.cantidad),
        stockAntes: Number(m.stockAntes),
        stockDespues: Number(m.stockDespues),
        motivo: m.motivo,
        referenciaTipo: m.referenciaTipo,
        fechaMovimiento: m.fechaMovimiento,
        producto: m.producto,
        usuario: m.usuario,
      }))
    )
  } catch (error: any) {
    console.error('Error listando movimientos:', error)
    return NextResponse.json(
      { error: 'Error al obtener movimientos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'inventario.movimientos')
    if (sinPermiso) return sinPermiso

    const body = await request.json()
    const parsed = movimientoSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { productoId, tipo, cantidad, motivo, email } = parsed.data
    const usuario = await resolverUsuario(email)

    const resultado = await prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findUnique({
        where: { id: productoId },
        select: { id: true, nombre: true, stockActual: true },
      })

      if (!producto) throw new Error('PRODUCTO_NO_ENCONTRADO')

      const stockAntes = Number(producto.stockActual)

      // En un ajuste la cantidad es el stock real contado, no un delta.
      const stockDespues =
        tipo === 'entrada'
          ? stockAntes + cantidad
          : tipo === 'salida'
            ? stockAntes - cantidad
            : cantidad

      if (stockDespues < 0) throw new Error('STOCK_NEGATIVO')

      await tx.producto.update({
        where: { id: productoId },
        data: { stockActual: stockDespues },
      })

      const movimiento = await tx.inventarioMovimiento.create({
        data: {
          productoId,
          tipo,
          cantidad: tipo === 'ajuste' ? Math.abs(stockDespues - stockAntes) : cantidad,
          stockAntes,
          stockDespues,
          referenciaTipo: 'manual',
          motivo,
          usuarioId: usuario?.id || null,
        },
      })

      return { movimiento, producto, stockAntes, stockDespues }
    }, { timeout: 20000 })

    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: usuario?.id || null,
          tablaAfectada: 'inventario_movimientos',
          registroId: resultado.movimiento.id,
          accion: 'CREATE',
          datosDespues: {
            tipo,
            producto: resultado.producto.nombre,
            stockAntes: resultado.stockAntes,
            stockDespues: resultado.stockDespues,
            motivo,
          },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json(
      {
        id: resultado.movimiento.id,
        stockAntes: resultado.stockAntes,
        stockDespues: resultado.stockDespues,
      },
      { status: 201 }
    )
  } catch (error: any) {
    if (error.message === 'PRODUCTO_NO_ENCONTRADO') {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }
    if (error.message === 'STOCK_NEGATIVO') {
      return NextResponse.json(
        { error: 'La operación dejaría el stock en negativo' },
        { status: 400 }
      )
    }

    console.error('Error creando movimiento:', error)
    return NextResponse.json(
      { error: error.message || 'Error al registrar movimiento' },
      { status: 500 }
    )
  }
}
