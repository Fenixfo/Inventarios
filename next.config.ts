import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad para todas las respuestas.
 *
 * La Content-Security-Policy de las páginas no está aquí: lleva un nonce
 * por petición y la pone el proxy (proxy.ts, lib/csp.ts).
 */
const cabecerasDeSeguridad = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La app no usa cámara, micrófono ni ubicación: que ningún script pueda pedirlos.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Solo tiene efecto por https (en local se ignora).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/(.*)", headers: cabecerasDeSeguridad },
      // La API responde JSON y PDF: no ejecuta scripts, así que le basta una
      // política corta que no la deje meter en un iframe ni cargar plugins.
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
