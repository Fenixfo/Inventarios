'use client'

import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'
import { ImagenesCategorias } from '@/components/configuracion/ImagenesCategorias'

/**
 * Categorías de la tienda: la imagen de cada una sale en la portada del
 * catálogo público. Las categorías mismas nacen al ponérselas a un producto.
 */
export default function CategoriasPage() {
  return (
    <PermissionProtector requiredPermission="productos.ver">
      <div className="card" style={{ maxWidth: 900 }}>
        <div className="mb-4">
          <Link href="/admin" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver al panel
          </Link>
        </div>

        <h1 style={{ margin: '0 0 6px 0', color: 'var(--black-primary)' }}>🗂️ Categorías</h1>
        <p style={{ margin: '0 0 24px 0', color: 'var(--gray-secondary)', fontSize: 14 }}>
          La imagen de cada categoría sale en la portada del catálogo de tu tienda. Se guarda sola
          al elegirla. Para crear una categoría nueva, asígnala a un producto.
        </p>

        <ImagenesCategorias />
      </div>
    </PermissionProtector>
  )
}
