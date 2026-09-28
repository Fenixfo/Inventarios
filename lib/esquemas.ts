import { z } from 'zod'

/**
 * Esquemas de lo que reciben las rutas que mueven dinero: facturas, abonos,
 * cotizaciones y liquidaciones.
 *
 * Antes cada ruta hacía `parseFloat(data.total || 0)` y similares: un texto
 * donde va un número terminaba como NaN en la base o en un error 500, y un
 * monto negativo se guardaba sin más. Aquí se valida en la frontera, antes
 * de tocar la base, con un mensaje que dice qué campo está mal.
 *
 * Los números aceptan texto ("55000") porque así llegan desde algunos
 * formularios y desde los Decimal que devuelve la API.
 */

/** Un monto o cantidad: número finito, sin negativos. */
const monto = z.coerce
  .number({ invalid_type_error: 'debe ser un número' })
  .finite('debe ser un número')
  .nonnegative('no puede ser negativo')

/** Un monto que puede faltar: se toma como cero. */
const montoOpcional = z.preprocess((v) => (v === '' || v === null || v === undefined ? 0 : v), monto)

/** Texto opcional: vacío o solo espacios cuenta como ausente. */
const textoOpcional = (maximo: number) =>
  z
    .string()
    .max(maximo, `admite como máximo ${maximo} caracteres`)
    .nullish()
    .transform((v) => (v?.trim() ? v.trim() : null))

/** Identificador opcional: '' o null cuentan como ausente. */
const idOpcional = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().uuid('no es un identificador válido').nullish()
)

const itemFactura = z.object({
  productoId: idOpcional,
  productoNombre: textoOpcional(255),
  cantidadM2: z.coerce.number({ invalid_type_error: 'debe ser un número' }).finite().positive('debe ser mayor que cero'),
  precioUnitario: monto,
  subtotal: monto,
})

const camposDeVenta = {
  clienteId: idOpcional,
  terminoPago: textoOpcional(50),
  metodoPago: textoOpcional(50),
  subtotal: montoOpcional,
  descuentoPorcentaje: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 0 : v),
    monto.max(100, 'no puede pasar de 100')
  ),
  descuentoMonto: montoOpcional,
  impuesto: montoOpcional,
  total: montoOpcional,
  esBodega: z.boolean().optional().default(false),
  observaciones: textoOpcional(2000),
  items: z.array(itemFactura).min(1, 'agrega al menos un producto').max(200, 'como máximo 200 productos'),
}

export const facturaNueva = z.object({
  ...camposDeVenta,
  anticipo: montoOpcional,
  contraEntrega: montoOpcional,
})

export const cotizacionNueva = z.object(camposDeVenta)

/**
 * Edición o cambio de estado. La pantalla manda la factura entera (con
 * cliente, items…); solo se toman estos campos y el resto se descarta.
 */
export const facturaEditada = z.object({
  id: z.string().uuid('no es un identificador válido'),
  estado: z.enum(['pendiente', 'pagado', 'entregado', 'anulado', 'liquidado']).optional(),
  terminoPago: textoOpcional(50),
  metodoPago: textoOpcional(50),
  anticipo: montoOpcional,
  contraEntrega: montoOpcional,
  subtotal: montoOpcional,
  descuentoPorcentaje: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 0 : v),
    monto.max(100, 'no puede pasar de 100')
  ),
  descuentoMonto: montoOpcional,
  impuesto: montoOpcional,
  total: montoOpcional,
  observaciones: textoOpcional(2000),
})

export const abonoNuevo = z.object({
  facturaId: z.string().uuid('no es un identificador válido'),
  monto: z.coerce.number({ invalid_type_error: 'debe ser un número' }).finite().positive('debe ser mayor que cero'),
})

export const liquidacionNueva = z.object({
  vendedorId: z.string().uuid('no es un identificador válido'),
  facturaIds: z
    .array(z.string().uuid('no es un identificador válido'))
    .min(1, 'elige al menos una factura')
    .max(100, 'como máximo 100 facturas por liquidación')
    .transform((ids) => [...new Set(ids)]),
  porcentaje: z.coerce.number().finite().min(0, 'va de 0 a 100').max(100, 'va de 0 a 100'),
  // El costo de lo vendido sin stock, por línea de factura.
  costos: z.record(z.string(), monto).optional().default({}),
  observaciones: textoOpcional(2000),
})

/** "items.0.cantidadM2: debe ser mayor que cero" — el primer problema, legible. */
export function primerError(error: z.ZodError): string {
  const problema = error.issues[0]
  const campo = problema.path.join('.')
  return campo ? `${campo}: ${problema.message}` : problema.message
}

/**
 * Valida el cuerpo de la petición. Devuelve los datos ya limpios, o la
 * respuesta 400 lista para retornar.
 */
export async function leerCuerpo<T extends z.ZodTypeAny>(
  request: Request,
  esquema: T
): Promise<{ datos: z.infer<T>; error: null } | { datos: null; error: Response }> {
  let crudo: unknown
  try {
    crudo = await request.json()
  } catch {
    return { datos: null, error: Response.json({ error: 'El cuerpo no es JSON válido' }, { status: 400 }) }
  }

  const resultado = esquema.safeParse(crudo)
  if (!resultado.success) {
    return { datos: null, error: Response.json({ error: primerError(resultado.error) }, { status: 400 }) }
  }

  return { datos: resultado.data, error: null }
}
