import { describe, it, expect } from 'vitest'
import { puede, type UsuarioAutenticado } from '@/lib/permisos'

function usuario(permisos: string[]): UsuarioAutenticado {
  return { id: 'u1', email: 'alguien@ejemplo.com', permisos }
}

describe('puede', () => {
  describe('permiso directo', () => {
    it('deja pasar a quien tiene el módulo', () => {
      expect(puede(usuario(['productos']), 'productos')).toBe(true)
    })

    it('rechaza a quien no lo tiene', () => {
      expect(puede(usuario(['clientes', 'facturas']), 'productos')).toBe(false)
    })

    it('rechaza a quien no tiene ningún permiso', () => {
      expect(puede(usuario([]), 'productos')).toBe(false)
    })
  })

  describe('administrador', () => {
    it('puede con cualquier módulo aunque no lo tenga asignado', () => {
      const admin = usuario(['administrador'])
      expect(puede(admin, 'productos')).toBe(true)
      expect(puede(admin, 'clientes')).toBe(true)
      expect(puede(admin, 'lo-que-sea')).toBe(true)
    })
  })

  describe('sin sesión', () => {
    it('rechaza cuando no hay usuario', () => {
      expect(puede(null, 'productos')).toBe(false)
    })
  })

  describe('reglas de subida de imágenes', () => {
    // Lo que exige cada carpeta en /api/upload/imagen
    const CARPETAS = { productos: 'productos', logos: 'administrador' }

    it('un vendedor no puede subir imágenes de producto', () => {
      const vendedor = usuario(['clientes', 'facturas', 'reportes'])
      expect(puede(vendedor, CARPETAS.productos)).toBe(false)
    })

    it('bodega sí puede subir imágenes de producto', () => {
      expect(puede(usuario(['productos']), CARPETAS.productos)).toBe(true)
    })

    it('bodega no puede cambiar el logo de la empresa', () => {
      expect(puede(usuario(['productos']), CARPETAS.logos)).toBe(false)
    })

    it('un administrador puede ambas cosas', () => {
      const admin = usuario(['administrador'])
      expect(puede(admin, CARPETAS.productos)).toBe(true)
      expect(puede(admin, CARPETAS.logos)).toBe(true)
    })

    it('tener sesión no basta: hace falta el permiso', () => {
      // El caso que motivó mover la subida a un endpoint propio: antes,
      // cualquier usuario autenticado podía escribir en el bucket.
      expect(puede(usuario([]), CARPETAS.productos)).toBe(false)
      expect(puede(usuario(['dashboard']), CARPETAS.productos)).toBe(false)
    })
  })
})
