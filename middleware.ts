import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas que NO requieren autenticación
  const publicRoutes = ['/login', '/signup', '/', '/carrito', '/api/auth', '/api/productos/catalogo', '/api/configuracion/publica']

  // Verificar si es una ruta pública
  const isPublicRoute = publicRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )

  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Para rutas protegidas que requieren verificación en el cliente
  // (/admin, /request-access), permitir que pasen
  // El frontend verificará la sesión y redirigirá si es necesario
  if (pathname.startsWith('/admin') || pathname.startsWith('/request-access')) {
    return NextResponse.next()
  }

  // Para API routes, verificar token
  if (pathname.startsWith('/api/')) {
    const token = request.cookies.get('sb-access-token')?.value ||
                  request.cookies.get('sb-auth-token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*', '/request-access/:path*']
}
