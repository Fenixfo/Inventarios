// URL pública del sitio. Vercel expone VERCEL_PROJECT_PRODUCTION_URL en
// producción; en local cae al servidor de desarrollo.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '')

// Rutas que no deben aparecer en buscadores: el panel, la autenticación
// y la API. Solo el catálogo es público.
export const RUTAS_PRIVADAS = [
  '/admin',
  '/api',
  '/login',
  '/signup',
  '/setup',
  '/request-access',
  '/carrito',
]
