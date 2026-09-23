/**
 * Plantillas de permisos: atajos para no configurar veintiún permisos uno
 * por uno al dar de alta a alguien.
 *
 * Viven en código y no en la base a propósito: son fijas, no se editan ni
 * se borran desde la interfaz, y al aplicarlas se copian los permisos. Si
 * mañana se cambia una plantilla, los usuarios ya creados no se ven
 * afectados — lo que tengan asignado es lo que rige.
 */

export interface Plantilla {
  id: string
  nombre: string
  descripcion: string
  icono: string
  permisos: string[]
}

export const PLANTILLAS: Plantilla[] = [
  {
    id: 'bodeguero',
    nombre: 'Bodeguero',
    descripcion: 'Administra el catálogo y las existencias, sin acceso a ventas.',
    icono: '📦',
    permisos: [
      'productos.ver',
      'productos.crear',
      'productos.editar',
      'inventario.ver',
      'inventario.movimientos',
    ],
  },
  {
    id: 'vendedor',
    nombre: 'Vendedor',
    descripcion: 'Factura y atiende clientes. Solo ve sus propias facturas.',
    icono: '🧾',
    permisos: [
      'productos.ver',
      'clientes.ver',
      'clientes.crear',
      'clientes.editar',
      'facturas.ver',
      'facturas.crear',
    ],
  },
  {
    id: 'administrador',
    nombre: 'Administrador',
    descripcion:
      'Puede todo dentro de la tienda, incluida la gestión de usuarios. No puede retirarle permisos al dueño.',
    icono: '👑',
    // No lleva permisos sueltos: se marca con la bandera de administrador,
    // que ya habilita cualquier acción de la tienda.
    permisos: [],
  },
]

export const PLANTILLA_ADMINISTRADOR = 'administrador'

export function plantillaPorId(id: string): Plantilla | undefined {
  return PLANTILLAS.find((p) => p.id === id)
}

/**
 * Etiquetas de los módulos para la interfaz, en el orden en que conviene
 * mostrarlos.
 */
export const MODULOS: { modulo: string; nombre: string; icono: string }[] = [
  { modulo: 'productos', nombre: 'Productos', icono: '📦' },
  { modulo: 'inventario', nombre: 'Inventario', icono: '🔄' },
  { modulo: 'clientes', nombre: 'Clientes', icono: '👥' },
  { modulo: 'facturas', nombre: 'Facturas', icono: '📄' },
  { modulo: 'reportes', nombre: 'Reportes', icono: '📈' },
  { modulo: 'auditoria', nombre: 'Auditoría', icono: '🔍' },
  { modulo: 'usuarios', nombre: 'Usuarios', icono: '👨‍💼' },
  { modulo: 'configuracion', nombre: 'Configuración', icono: '⚙️' },
  { modulo: 'solicitudes-acceso', nombre: 'Solicitudes de acceso', icono: '✋' },
]
