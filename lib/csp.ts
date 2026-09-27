/**
 * Content-Security-Policy de las páginas, con un nonce por petición.
 *
 * La arma el proxy en cada visita. Next.js lee el nonce de la cabecera
 * durante el render y se lo pone a sus propios scripts; cualquier otro
 * script en línea —por ejemplo, uno inyectado en el nombre de un cliente—
 * no lo tiene y el navegador no lo ejecuta.
 *
 * Las respuestas de /api llevan la política corta de next.config.ts: son
 * JSON o PDF, no ejecutan scripts.
 */

export interface OpcionesCsp {
  nonce: string
  /** `next dev` necesita eval para reconstruir los errores del servidor. */
  desarrollo: boolean
  /** Supabase: el navegador inicia sesión y renueva el token contra él. */
  supabaseUrl?: string
}

export function politicaDeSeguridad({ nonce, desarrollo, supabaseUrl }: OpcionesCsp): string {
  const supabase = origenDe(supabaseUrl)

  const directivas = [
    "default-src 'self'",
    // 'strict-dynamic': los scripts con nonce pueden cargar otros (los
    // trozos de Next.js) sin tener que listar cada uno.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desarrollo ? " 'unsafe-eval'" : ''}`,
    // 'unsafe-inline' y sin nonce a propósito: el panel usa atributos
    // style="…" que el servidor ya trae en el HTML, y un nonce no los cubre.
    // Con un nonce en esta lista el navegador ignoraría 'unsafe-inline' y el
    // panel se vería sin estilos al cargar.
    "style-src 'self' 'unsafe-inline'",
    // Las fotos de producto pueden ser una URL cualquiera (el formulario
    // acepta enlaces externos); blob: y data: son las vistas previas al subir.
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    ['connect-src', "'self'", supabase, supabase?.replace(/^http/, 'ws')]
      .filter(Boolean)
      .join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]

  return directivas.join('; ')
}

/** Nonce nuevo para cada petición, como indica la guía de CSP de Next.js. */
export function nuevoNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64')
}

/** `https://abc.supabase.co/…` → `https://abc.supabase.co`. */
function origenDe(url?: string): string | undefined {
  if (!url) return undefined
  try {
    const { origin } = new URL(url)
    return origin.startsWith('http') ? origin : undefined
  } catch {
    return undefined
  }
}
