import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Red de seguridad para que no se cuele un endpoint sin permisos.
 *
 * Ya pasó una vez: la API entera respondía a cualquiera con un token, y se
 * descubrió a mano. Esto lo comprueba en cada push, sin base de datos ni
 * servidor, recorriendo el código de las rutas.
 *
 * No sustituye a las pruebas de integración —aquí no se ejecuta nada—, pero
 * detecta lo que de verdad se olvida: crear un endpoint y no ponerle la
 * comprobación.
 */

const RAIZ_API = join(process.cwd(), 'app', 'api')

/** Cualquiera de estas llamadas cuenta como comprobación. */
const COMPROBACIONES = [
  'exigirPermiso(',
  'exigirSesion(',
  'usuarioDePeticion(',
  'duenoDelToken(',
]

/**
 * Rutas que se sirven sin sesión, cada una por un motivo concreto.
 *
 * Añadir algo aquí es una decisión deliberada: si un endpoint nuevo aparece
 * en esta lista sin motivo, el fallo pasa a ser de quien lo añadió.
 */
const PUBLICAS: Record<string, string> = {
  'productos/catalogo/route.ts': 'El catálogo lo consulta cualquier visitante, sin login.',
  'configuracion/publica/route.ts': 'Nombre de la tienda y WhatsApp, que salen en el catálogo.',
  'auth/register/route.ts': 'Registro de cuentas nuevas; va limitado por IP.',
}

function rutasDeApi(directorio: string): string[] {
  const encontradas: string[] = []

  for (const entrada of readdirSync(directorio)) {
    const completa = join(directorio, entrada)

    if (statSync(completa).isDirectory()) {
      encontradas.push(...rutasDeApi(completa))
    } else if (entrada === 'route.ts') {
      encontradas.push(completa)
    }
  }

  return encontradas
}

const rutas = rutasDeApi(RAIZ_API).map((ruta) => ({
  relativa: relative(RAIZ_API, ruta).split(sep).join('/'),
  contenido: readFileSync(ruta, 'utf8'),
}))

function handlersDe(contenido: string): string[] {
  return [...contenido.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].map(
    (m) => m[1]
  )
}

function comprobacionesDe(contenido: string): number {
  return COMPROBACIONES.reduce(
    (total, marca) => total + contenido.split(marca).length - 1,
    0
  )
}

describe('endpoints protegidos', () => {
  it('encuentra las rutas de la API', () => {
    expect(rutas.length).toBeGreaterThan(10)
  })

  it.each(rutas.filter((r) => !PUBLICAS[r.relativa]).map((r) => [r.relativa, r.contenido]))(
    '%s comprueba permisos en todos sus handlers',
    (relativa, contenido) => {
      const handlers = handlersDe(contenido as string)
      const comprobaciones = comprobacionesDe(contenido as string)

      // Una comprobación por handler como mínimo: así no basta con proteger
      // el GET y dejar el POST abierto, que es el error típico.
      expect(
        comprobaciones,
        `${relativa} exporta ${handlers.length} handler(s) (${handlers.join(', ')}) ` +
          `y solo tiene ${comprobaciones} comprobación(es) de permisos. ` +
          `Si la ruta debe ser pública, decláralo en PUBLICAS con su motivo.`
      ).toBeGreaterThanOrEqual(handlers.length)
    }
  )

  it('las rutas públicas declaradas siguen existiendo', () => {
    // Si se renombra o borra una ruta pública, la lista queda mintiendo.
    for (const declarada of Object.keys(PUBLICAS)) {
      expect(
        rutas.some((r) => r.relativa === declarada),
        `${declarada} está en la lista de rutas públicas pero ya no existe`
      ).toBe(true)
    }
  })

  it('ningún endpoint resuelve el usuario desde un parámetro', () => {
    // El agujero original: aceptar ?email= o email en el cuerpo para decidir
    // quién eres. El usuario sale del token y de ningún otro sitio.
    const sospechosas = rutas.filter((r) =>
      /searchParams\.get\(['"]email['"]\)/.test(r.contenido)
    )

    expect(
      sospechosas.map((r) => r.relativa),
      'Estas rutas leen el email de la petición en vez del token'
    ).toEqual([])
  })

  it('no quedan endpoints del modelo de roles antiguo', () => {
    const antiguas = rutas.filter(
      (r) =>
        r.relativa.startsWith('roles-personalizados') ||
        r.relativa.startsWith('permisos-modulos') ||
        r.relativa.startsWith('admin/assign-role') ||
        r.relativa.startsWith('setup/') ||
        r.relativa.includes('/roles/') ||
        r.relativa.includes('/roles-disponibles/')
    )

    expect(antiguas.map((r) => r.relativa)).toEqual([])
  })

  it('ninguna ruta usa las tablas del modelo de roles antiguo', () => {
    // Prisma todavía conoce esos modelos, así que el compilador no avisaría.
    const usan = rutas.filter((r) =>
      /prisma\.(usuarioRol|rolPersonalizado|permisoModulo|usuarioRolPersonalizado|permisoRolPersonalizado)\b/.test(
        r.contenido
      )
    )

    expect(usan.map((r) => r.relativa)).toEqual([])
  })
})
