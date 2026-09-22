import { prisma } from '@/lib/prisma'

/**
 * Verificación de permisos a partir del token de sesión.
 *
 * El usuario se resuelve desde el JWT y no desde un parámetro de la
 * petición: un email en la query lo puede escribir cualquiera.
 */

export interface UsuarioAutenticado {
  id: string
  email: string
  permisos: string[]
}

/** Extrae el email del token de Supabase consultando su API de usuario. */
async function emailDesdeToken(token: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    })
    if (!res.ok) return null

    const usuario = await res.json()
    return usuario?.email || null
  } catch {
    return null
  }
}

/**
 * Devuelve el usuario de la petición con sus módulos permitidos, o null si
 * el token falta, es inválido o no corresponde a ningún usuario.
 */
export async function usuarioDePeticion(
  request: Request
): Promise<UsuarioAutenticado | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null

  const email = await emailDesdeToken(token)
  if (!email) return null

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: {
      rolesPersonalizados: {
        include: { rol: { include: { permisos: { include: { modulo: true } } } } },
      },
    },
  })

  if (!usuario) return null

  const permisos = new Set<string>()
  for (const ur of usuario.rolesPersonalizados || []) {
    for (const p of ur.rol.permisos || []) {
      if (p.modulo?.modulo) permisos.add(p.modulo.modulo)
    }
  }

  return { id: usuario.id, email: usuario.email, permisos: [...permisos] }
}

/** Un administrador puede todo, sin necesidad del módulo específico. */
export function puede(usuario: UsuarioAutenticado | null, modulo: string): boolean {
  if (!usuario) return false
  return usuario.permisos.includes('administrador') || usuario.permisos.includes(modulo)
}
