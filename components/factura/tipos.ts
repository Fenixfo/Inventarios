/**
 * Tipos y utilidades compartidas por las secciones del formulario de factura
 * y cotización (components/InvoiceForm.tsx y components/factura/*).
 */

/** Lo que devuelve /api/productos/buscar. */
export interface ProductoFactura {
  id: string
  sku: string
  nombre: string
  precioUnitario: number
  precioBodega?: number | null
  stockActual: number
}

/** Lo que devuelve /api/clientes/buscar. */
export interface ClienteEncontrado {
  id: string
  nombre: string
  cedulaCc?: string
  email?: string
  telefono?: string
  direccion?: string
  terminoPago?: string
  limiteCredito: number
}

/** Los datos del cliente tal como están en el formulario. */
export interface ClienteFormulario {
  /** Vacío si es un cliente nuevo: se crea al guardar. */
  id: string
  cedula: string
  nombre: string
  email: string
  telefono: string
  direccion: string
}

export const CLIENTE_VACIO: ClienteFormulario = {
  id: '',
  cedula: '',
  nombre: '',
  email: '',
  telefono: '',
  direccion: '',
}

export interface LineaFactura {
  /** Solo para la pantalla: identifica la línea al quitar otras. El servidor lo descarta. */
  clave: string
  productoId?: string
  productoNombre: string
  cantidadM2: number
  precioUnitario: number
  subtotal: number
  esPersonalizado?: boolean
}

/** Evita que la rueda del ratón cambie un campo numérico sin querer. */
export const sinRueda = (e: React.WheelEvent<HTMLInputElement>) => {
  e.currentTarget.blur()
}

/** Estilo de los campos de texto del formulario. */
export const estiloCampo: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--gray-light)',
  boxSizing: 'border-box',
  backgroundColor: 'var(--white-off)',
  color: 'var(--black-primary)',
  fontFamily: 'inherit',
  fontSize: '14px',
}

export const estiloEtiqueta: React.CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  fontWeight: 600,
  fontSize: '13px',
  color: 'var(--black-primary)',
}

export const estiloSeccion: React.CSSProperties = {
  backgroundColor: 'var(--white-off)',
  padding: '20px',
  borderRadius: '12px',
  border: '1px solid var(--gray-light)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
}

/** Lista desplegable de sugerencias bajo un campo de búsqueda. */
export const estiloSugerencias: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  backgroundColor: 'var(--white-off)',
  border: '1px solid var(--gray-light)',
  borderRadius: '8px',
  maxHeight: '200px',
  overflow: 'auto',
  zIndex: 10,
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  marginTop: '2px',
}
