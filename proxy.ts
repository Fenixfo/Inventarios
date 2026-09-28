import { NextRequest, NextResponse } from 'next/server'
import { comprobarLimite, grupoDeRuta, identificarCliente } from '@/lib/rate-limit'
import { nuevoNonce, politicaDeSeguridad } from '@/lib/csp'

// Rutas de la API que no exigen sesión. El catálogo y la configuración
// pública las consulta cualquier visitante, y las de /api/auth son
// justamente las que se usan para conseguir la sesión.
const RUTAS_API_PUBLICAS = ['/api/auth', '/api/productos/catalogo', '/api/configuracion/publica']

// Antes era `middleware.ts`: Next.js 16 lo declaró obsoleto y lo renombró a
// `proxy`, con el mismo comportamiento. Una diferencia: el proxy corre en
// Node.js por defecto, no en Edge.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) return protegerApi(request)

  // Las páginas no se protegen aquí: /admin y /request-access se comprueban
  // en el cliente, que ya tiene la sesión cargada. Solo llevan la CSP.
  return conPoliticaDeSeguridad(request)
}

/**
 * Pone la CSP con un nonce nuevo. Va en la petición, para que Next.js lea
 * el nonce al renderizar y se lo ponga a sus scripts, y en la respuesta,
 * para que el navegador la aplique.
 */
function conPoliticaDeSeguridad(request: NextRequest) {
  const politica = politicaDeSeguridad({
    nonce: nuevoNonce(),
    desarrollo: process.env.NODE_ENV === 'development',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  })

  const cabeceras = new Headers(request.headers)
  cabeceras.set('Content-Security-Policy', politica)

  const respuesta = NextResponse.next({ request: { headers: cabeceras } })
  respuesta.headers.set('Content-Security-Policy', politica)
  return respuesta
}

function protegerApi(request: NextRequest) {
  const { pathname } = request.nextUrl

  // El límite de peticiones se aplica antes que nada: si no, un anónimo
  // insistiendo llegaría igual a la base de datos por las rutas públicas.
  const cliente = identificarCliente(request.headers)
  const resultado = comprobarLimite(cliente, grupoDeRuta(pathname))

  if (!resultado.permitido) {
    return new NextResponse(
      JSON.stringify({
        error: 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.',
      }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(resultado.esperaSegundos),
        },
      }
    )
  }

  const esPublica = RUTAS_API_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(ruta + '/')
  )
  if (esPublica) return NextResponse.next()

  // El resto de la API exige al menos traer un token. Que el token sea
  // válido y tenga permisos lo comprueba cada endpoint con `exigirPermiso`:
  // aquí solo se filtra lo que viene sin nada.
  const token =
    request.cookies.get('sb-access-token')?.value ||
    request.cookies.get('sb-auth-token')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    // Todas las páginas, menos los archivos estáticos (que no ejecutan nada)
    // y las precargas de <Link>, que no llevan HTML.
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
