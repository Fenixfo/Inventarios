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
  // Como exigirPermiso, y además resuelve la tienda activa. Es la que usan
  // los endpoints que tocan datos de una tienda.
  'exigirTienda(',
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
  'productos/catalogo/filtros/route.ts':
    'Las categorías y las tiendas del catálogo, para los desplegables de la portada.',
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

  // Los endpoints que trabajan con datos de una tienda tienen que usar
  // `exigirTienda`: con `exigirPermiso` a secas se comprueba el permiso pero
  // no se filtra por tienda, que fue justo el agujero de TASK-44.
  it('los endpoints de datos resuelven la tienda activa', () => {
    const DE_DATOS = [
      'productos/route.ts',
      'productos/[id]/route.ts',
      'clientes/route.ts',
      'clientes/[id]/route.ts',
      'facturas/route.ts',
      'facturas/[id]/route.ts',
      'facturas/[id]/pdf/route.ts',
      'cotizaciones/route.ts',
      'cotizaciones/[id]/route.ts',
      'cotizaciones/[id]/pdf/route.ts',
      'abonos/route.ts',
      'abonos/[id]/route.ts',
      'inventario/movimientos/route.ts',
      'reportes/inventario/route.ts',
      'reportes/facturacion/route.ts',
      'tablero/route.ts',
      'liquidaciones/route.ts',
      'liquidaciones/[id]/route.ts',
      'liquidaciones/pendientes/route.ts',
      'auditoria/route.ts',
      'usuarios/route.ts',
      'usuarios/permisos/route.ts',
    ]

    const sinTienda = DE_DATOS.filter((ruta) => {
      const encontrada = rutas.find((r) => r.relativa === ruta)
      return !encontrada || !encontrada.contenido.includes('exigirTienda(')
    })

    expect(sinTienda, 'Estas rutas no filtran por tienda').toEqual([])
  })

  // Facturas y cotizaciones distinguen alcance: sin `ver_todas`, cada quien
  // ve solo las suyas. Filtrar por tienda no basta; cada ruta que abre una
  // sola (el detalle, su PDF, sus abonos) tiene que comprobarlo también.
  // Ya pasó: el PDF y los abonos de una factura ajena se podían abrir con
  // el enlace.
  it('las rutas que abren una factura o cotización respetan ver_todas', () => {
    const CON_ALCANCE: Record<string, string> = {
      'facturas/[id]/route.ts': 'veTodasLasFacturas(',
      'facturas/[id]/pdf/route.ts': 'veTodasLasFacturas(',
      'abonos/[id]/route.ts': 'veTodasLasFacturas(',
      'cotizaciones/route.ts': "'cotizaciones.ver_todas'",
      'cotizaciones/[id]/route.ts': "'cotizaciones.ver_todas'",
      'cotizaciones/[id]/pdf/route.ts': "'cotizaciones.ver_todas'",
    }

    const sinAlcance = Object.entries(CON_ALCANCE).filter(([ruta, marca]) => {
      const encontrada = rutas.find((r) => r.relativa === ruta)
      return !encontrada || !encontrada.contenido.includes(marca)
    })

    expect(
      sinAlcance.map(([ruta]) => ruta),
      'Estas rutas no comprueban si la persona puede ver las de toda la tienda'
    ).toEqual([])
  })

  it('ninguna ruta acepta la tienda desde la petición', () => {
    // El identificador de tienda llega en una cabecera que el servidor
    // valida; tomarlo del cuerpo o de la URL permitiría trabajar sobre la
    // tienda de otro.
    const sospechosas = rutas.filter(
      (r) =>
        /searchParams\.get\(['"]tiendaId['"]\)/.test(r.contenido) ||
        /parsed\.data\.tiendaId/.test(r.contenido)
    )

    expect(sospechosas.map((r) => r.relativa)).toEqual([])
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
