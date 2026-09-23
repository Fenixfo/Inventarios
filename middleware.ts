import { NextRequest, NextResponse } from 'next/server'
import { comprobarLimite, grupoDeRuta, identificarCliente } from '@/lib/rate-limit'

// Rutas que no exigen sesión. El catálogo y la configuración pública las
// consulta cualquier visitante, y las de /api/auth son justamente las que
// se usan para conseguir la sesión.
const RUTAS_PUBLICAS = [
  '/login',
  '/signup',
  '/',
  '/carrito',
  '/api/auth',
  '/api/productos/catalogo',
  '/api/configuracion/publica',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // El límite de peticiones se aplica antes que nada: si no, un anónimo
  // insistiendo llegaría igual a la base de datos por las rutas públicas.
  if (pathname.startsWith('/api/')) {
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
  }

  const esPublica = RUTAS_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(ruta + '/')
  )

  if (esPublica) {
    return NextResponse.next()
  }

  // /admin y /request-access se comprueban en el cliente, que ya tiene la
  // sesión cargada; aquí solo se dejan pasar.
  if (pathname.startsWith('/admin') || pathname.startsWith('/request-access')) {
    return NextResponse.next()
  }

  // El resto de la API exige al menos traer un token. Que el token sea
  // válido y tenga permisos lo comprueba cada endpoint con `exigirPermiso`:
  // aquí solo se filtra lo que viene sin nada.
  if (pathname.startsWith('/api/')) {
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
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*', '/request-access/:path*'],
}
