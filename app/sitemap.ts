import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { prisma } from '@/lib/prisma'

// Se regenera cada hora: el catálogo cambia cuando entran o se agotan
// productos, pero no tan seguido como para consultarlo en cada petición.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paginas: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]

  // Las categorías con productos disponibles son URLs reales del catálogo.
  try {
    const categorias = await prisma.producto.findMany({
      where: { activo: true, stockActual: { gt: 0 } },
      select: { categoria: true },
      distinct: ['categoria'],
    })

    for (const { categoria } of categorias) {
      if (!categoria) continue
      paginas.push({
        url: `${SITE_URL}/?categoria=${encodeURIComponent(categoria)}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    }
  } catch {
    // Si la base no responde, el sitemap sale con la portada en vez de
    // romper el build.
  }

  return paginas
}
