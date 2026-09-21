import type { MetadataRoute } from 'next'
import { SITE_URL, RUTAS_PRIVADAS } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // El panel y la API no deben indexarse: solo el catálogo es público.
      disallow: RUTAS_PRIVADAS.map((r) => `${r}/`),
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
