import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSesion, olvidarCache } from '@/lib/permisos'
import { z } from 'zod'

const schema = z.object({
  tiendaId: z.string().uuid('Indica de qué tienda quieres salir'),
})

/**
 * Salirse de una tienda por cuenta propia.
 *
 * No hace falta ningún permiso: nadie necesita autorización para dejar de
 * trabajar en un sitio. Solo exige sesión, porque la tienda de la que se
 * sale es una de las del usuario y no la que venga en la cabecera.
 *
 * El dueño no puede salirse: la tienda quedaría sin nadie que pueda
 * administrarla ni repartir accesos.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { usuario, error: sinSesion } = await exigirSesion(request)
    if (sinSesion) return sinSesion

    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { tiendaId } = parsed.data

    const relacion = await prisma.usuarioTienda.findUnique({
      where: { usuarioId_tiendaId: { usuarioId: usuario.id, tiendaId } },
      include: { tienda: { select: { nombre: true } } },
    })

    if (!relacion) {
      return NextResponse.json(
        { error: 'No trabajas en esa tienda' },
        { status: 404 }
      )
    }

    if (relacion.esOwner) {
      return NextResponse.json(
        {
          error:
            'Eres el dueño de esta tienda y no puedes salirte: quedaría sin nadie que la administre.',
        },
        { status: 409 }
      )
    }

    await prisma.$transaction([
      prisma.usuarioTienda.delete({ where: { id: relacion.id } }),
      // Se borran también las solicitudes anteriores para que pueda volver
      // a pedir acceso más adelante si cambia de idea.
      prisma.solicitudAcceso.deleteMany({ where: { usuarioId: usuario.id, tiendaId } }),
    ])

    olvidarCache(usuario.email)

    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: usuario.id,
          tiendaId,
          tablaAfectada: 'usuarios_tiendas',
          registroId: relacion.id,
          accion: 'DELETE',
          datosAntes: { usuario: usuario.email, salioPorCuentaPropia: true },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json({ ok: true, tienda: relacion.tienda.nombre })
  } catch (error: any) {
    console.error('Error saliendo de la tienda:', error)
    return NextResponse.json({ error: 'Error al salir de la tienda' }, { status: 500 })
  }
}
