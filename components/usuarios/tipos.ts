/**
 * Tipos y utilidades de la gestión de usuarios (app/admin/usuarios y
 * components/usuarios/*).
 */

/** El acceso de una persona a la tienda activa, como lo devuelve /api/usuarios. */
export interface AccesoTienda {
  tiendaId: string
  tiendaNombre: string
  esOwner: boolean
  esAdmin: boolean
  permisos: string[]
}

export interface Usuario {
  id: string
  email: string
  lastLogin: string | null
  tiendas: AccesoTienda[]
}

export interface Accion {
  id: string
  clave: string
  accion: string
  nombre: string
}

/** Un módulo del panel con sus acciones, de /api/permisos. */
export interface Modulo {
  modulo: string
  nombre: string
  icono: string
  acciones: Accion[]
}

export interface Plantilla {
  id: string
  nombre: string
  descripcion: string
  icono: string
  permisos: string[]
}

/** El listado ya viene filtrado a la tienda activa: su único acceso es ese. */
export const accesoDe = (u: Usuario): AccesoTienda | undefined => u.tiendas[0]

/** Una copia del conjunto con `valor` puesto o quitado. */
export function alternar(conjunto: Set<string>, valor: string) {
  const copia = new Set(conjunto)
  if (copia.has(valor)) copia.delete(valor)
  else copia.add(valor)
  return copia
}

export const estiloTarjeta = {
  backgroundColor: 'white',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
}
