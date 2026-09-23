import { NextRequest, NextResponse } from 'next/server'
import { exigirSesion } from '@/lib/permisos'

/**
 * Datos de sesión de quien pregunta: sus tiendas, su nivel y sus permisos.
 *
 * Lo consultan el verificador de permisos, el menú lateral, el tablero y la
 * pantalla de solicitud de acceso. Solo exige sesión —exigirle un permiso
 * crearía un círculo, porque es la fuente que dice qué permisos hay— y
 * nunca devuelve datos de otro usuario: el email sale del token.
 */
export async function GET(request: NextRequest) {
  try {
    const { usuario, error } = await exigirSesion(request)
    if (error) return error

    return NextResponse.json({
      id: usuario.id,
      email: usuario.email,
      tiendas: usuario.tiendas,
      tienda: usuario.tienda,

      // Atajo con los permisos de la tienda activa, que es lo que la
      // interfaz necesita en la mayoría de los casos.
      permisos: usuario.tienda?.permisos || [],
      esOwner: usuario.tienda?.esOwner || false,
      esAdmin: usuario.tienda?.esAdmin || false,
      administraTienda: Boolean(usuario.tienda?.esOwner || usuario.tienda?.esAdmin),
    })
  } catch (error: any) {
    console.error('Error obteniendo la sesión:', error)
    return NextResponse.json(
      { error: 'Error al obtener los datos de sesión' },
      { status: 500 }
    )
  }
}
