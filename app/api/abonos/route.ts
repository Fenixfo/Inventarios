import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermiso } from '@/lib/permisos'
export async function POST(request: NextRequest) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'facturas.crear')
    if (sinPermiso) return sinPermiso

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const { facturaId, monto } = await request.json()

    if (!facturaId || !monto || monto <= 0) {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400 }
      )
    }

    // Obtener usuarioId del email
    let usuarioId = null
    if (email) {
      const usuario = await prisma.usuario.findUnique({
        where: { email },
      })
      usuarioId = usuario?.id || null
    }

    const factura = await prisma.factura.findUnique({
      where: { id: facturaId },
    })

    if (!factura) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    const abono = await prisma.abono.create({
      data: {
        facturaId,
        monto: Number(monto),
        fecha: new Date(),
        usuarioId,
      },
    })

    // Registrar en auditoría
    try {
      await prisma.auditoria.create({
        data: {
          usuarioId,
          tablaAfectada: 'abonos',
          registroId: abono.id,
          accion: 'CREATE',
          datosDespues: {
            facturaId,
            monto: Number(abono.monto),
            fecha: abono.fecha.toISOString(),
            usuarioId,
          },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json({
      monto: Number(abono.monto),
      fecha: abono.fecha.toISOString(),
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error al crear abono:', error.message, error.stack)
    return NextResponse.json(
      { error: error.message || 'Error al crear abono' },
      { status: 500 }
    )
  }
}
