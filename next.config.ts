import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad para todas las respuestas.
 *
 * La CSP es deliberadamente corta: bloquea que la aplicación se meta en un
 * iframe ajeno (clickjacking), los plugins y el cambio de <base>, pero no
 * restringe los scripts. Hacerlo en Next.js exige un nonce por petición
 * generado en el proxy; es un paso aparte porque, mal hecho, deja la página
 * en blanco.
 */
const cabecerasDeSeguridad = [
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La app no usa cámara, micrófono ni ubicación: que ningún script pueda pedirlos.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Solo tiene efecto por https (en local se ignora).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: cabecerasDeSeguridad }];
  },
};

export default nextConfig;
