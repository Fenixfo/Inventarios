import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
export async function POST(request: NextRequest) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'facturas.crear')
    if (sinPermiso) return sinPermiso

    const { facturaId, monto } = await request.json()

    if (!facturaId || !monto || monto <= 0) {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400 }
      )
    }

    // El abono se registra a nombre de quien lo hace, que sale del token.
    // Antes venía en ?email=, así que cualquiera podía apuntarle un cobro a
    // otra persona con solo cambiar la URL.
    const usuarioId = usuario.id

    // La factura tiene que ser de esta tienda: si no, se podría abonar a
    // la factura de otro negocio conociendo su identificador.
    const factura = await prisma.factura.findFirst({
      where: { id: facturaId, tiendaId },
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
