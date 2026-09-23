import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermiso } from '@/lib/permisos'
import { PLANTILLAS, MODULOS } from '@/lib/plantillas'

/**
 * Catálogo de permisos agrupado por módulo, más las plantillas disponibles.
 * Es lo que alimenta la pantalla de gestión de usuarios.
 */
export async function GET(request: NextRequest) {
  try {
    const { error } = await exigirPermiso(request, 'usuarios.ver')
    if (error) return error

    const permisos = await prisma.permiso.findMany({
      orderBy: [{ orden: 'asc' }],
    })

    // Se agrupan en el orden declarado en MODULOS; lo que no esté ahí va al
    // final, para que un módulo nuevo no desaparezca de la interfaz.
    const porModulo = MODULOS.map((m) => ({
      ...m,
      acciones: permisos
        .filter((p) => p.modulo === m.modulo)
        .map((p) => ({
          id: p.id,
          clave: `${p.modulo}.${p.accion}`,
          accion: p.accion,
          nombre: p.nombre,
          descripcion: p.descripcion,
        })),
    })).filter((m) => m.acciones.length > 0)

    const declarados = new Set(MODULOS.map((m) => m.modulo))
    const huerfanos = [...new Set(permisos.filter((p) => !declarados.has(p.modulo)).map((p) => p.modulo))]

    for (const modulo of huerfanos) {
      porModulo.push({
        modulo,
        nombre: modulo,
        icono: '•',
        acciones: permisos
          .filter((p) => p.modulo === modulo)
          .map((p) => ({
            id: p.id,
            clave: `${p.modulo}.${p.accion}`,
            accion: p.accion,
            nombre: p.nombre,
            descripcion: p.descripcion,
          })),
      })
    }

    return NextResponse.json({ modulos: porModulo, plantillas: PLANTILLAS })
  } catch (error: any) {
    console.error('Error obteniendo permisos:', error)
    return NextResponse.json({ error: 'Error al obtener permisos' }, { status: 500 })
  }
}
