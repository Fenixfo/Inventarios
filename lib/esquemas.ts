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
  // A nombre de quién se factura; sin él, de quien la registra. Solo vale
  // con el permiso 'facturas.a_nombre_de_otros' (lo comprueba la ruta).
  vendedorId: idOpcional,
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
  // El costo al facturar de lo que sí tenía stock, cuando quien liquida lo corrige.
  costosFacturados: z.record(z.string(), monto).optional().default({}),
  observaciones: textoOpcional(2000),
  // Lo que se le descuenta al vendedor de su comisión, con la razón.
  descuento: montoOpcional,
  descuentoMotivo: textoOpcional(500),
}).refine((d) => d.descuento === 0 || d.descuentoMotivo !== null, {
  message: 'indica el motivo del descuento',
  path: ['descuentoMotivo'],
})

/** Guardar los costos de una factura sin liquidarla. */
export const costosGuardar = z.object({
  costos: z.record(z.string(), monto).optional().default({}),
  costosFacturados: z.record(z.string(), monto).optional().default({}),
})

// ---------------------------------------------------------------------------
// Compras a proveedores
// ---------------------------------------------------------------------------

/** Número opcional que si viene debe ser mayor que cero: '' y null cuentan como ausente. */
const positivoOpcional = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number({ invalid_type_error: 'debe ser un número' }).finite('debe ser un número').positive('debe ser mayor que cero').optional()
)

/** Monto opcional que puede ser cero: '' y null cuentan como ausente. */
const montoSinValorOpcional = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  monto.optional()
)

/**
 * Imagen del producto: una dirección https. No se limita al servidor del
 * proyecto porque el selector de imagen también deja pegar una dirección, igual
 * que en el formulario de productos.
 */
const urlImagenOpcional = z.preprocess(
  (v) => (v === '' ? null : v),
  z
    .string()
    .trim()
    .max(500, 'admite como máximo 500 caracteres')
    .url('no es una dirección válida')
    .refine((u) => u.startsWith('https://'), 'debe ser una dirección https')
    .nullish()
    .transform((v) => v ?? null)
)

/** El SKU sin mayúsculas ni espacios, para detectar repetidos en una misma compra. */
const claveSku = (sku: string) => sku.trim().toUpperCase()

const lineaCompra = z.object({
  // Presente si la línea es de un producto que ya existe en la tienda.
  productoId: idOpcional,
  // true si quien compra descartó el aviso de nombres parecidos y quiere crear uno nuevo.
  confirmadoNuevo: z.boolean().optional().default(false),

  sku: z.string().trim().min(1, 'escribe el SKU').max(100, 'admite como máximo 100 caracteres'),
  // Estos tres solo son obligatorios si la línea crea un producto (ver superRefine).
  nombre: z.string().trim().max(255, 'admite como máximo 255 caracteres').optional(),
  categoria: z.string().trim().max(100, 'admite como máximo 100 caracteres').optional(),
  precioUnitario: montoSinValorOpcional, // precio de VENTA al público

  dimensiones: textoOpcional(50),
  color: textoOpcional(100),
  acabado: textoOpcional(100),
  espesorMm: positivoOpcional,
  m2PorCaja: positivoOpcional,
  precioBodega: positivoOpcional,
  stockMinimo: montoSinValorOpcional,
  descripcion: textoOpcional(2000),
  imagenUrl: urlImagenOpcional,

  cantidad: z.coerce.number({ invalid_type_error: 'debe ser un número' }).finite('debe ser un número').positive('debe ser mayor que cero'),
  // Lo que dice el papel, por unidad.
  precioFactura: monto,
  // El costo final por unidad, solo si la persona lo escribió a mano.
  costoFinalManual: montoSinValorOpcional,
})

export const compraNueva = z
  .object({
    proveedorId: z.string().uuid('elige un proveedor'),
    // Una fecha sin hora ("2026-10-03") se guarda a mediodía UTC: a medianoche
    // caería en el día anterior para quien está en Colombia (UTC-5).
    fecha: z.preprocess(
      (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? `${v.trim()}T12:00:00Z` : v),
      z.coerce.date({ invalid_type_error: 'no es una fecha válida', required_error: 'indica la fecha' })
    ),
    numeroFacturaProveedor: textoOpcional(100),
    observaciones: textoOpcional(2000),
    metodoReparto: z.enum(['valor', 'cantidad']).optional().default('valor'),
    costosExtra: z
      .array(
        z.object({
          concepto: z.string().trim().min(1, 'escribe el concepto').max(255, 'admite como máximo 255 caracteres'),
          valor: z.coerce.number({ invalid_type_error: 'debe ser un número' }).finite('debe ser un número').positive('debe ser mayor que cero'),
        })
      )
      .max(20, 'como máximo 20 costos adicionales')
      .optional()
      .default([]),
    items: z
      .array(lineaCompra)
      .min(1, 'agrega al menos una línea')
      .max(100, 'como máximo 100 líneas por compra'),
  })
  .superRefine((compra, ctx) => {
    const vistos = new Map<string, number>()

    compra.items.forEach((linea, i) => {
      const clave = claveSku(linea.sku)
      const anterior = vistos.get(clave)
      if (anterior !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', i, 'sku'],
          message: `Línea ${i + 1}: el SKU ${linea.sku} ya está en la línea ${anterior + 1}`,
        })
      } else {
        vistos.set(clave, i)
      }

      // Una línea sin productoId crea un producto: todo producto exige nombre,
      // categoría y precio de venta.
      if (!linea.productoId) {
        if (!linea.nombre) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', i, 'nombre'], message: `Línea ${i + 1}: escribe el nombre del producto nuevo` })
        }
        if (!linea.categoria) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', i, 'categoria'], message: `Línea ${i + 1}: elige la categoría del producto nuevo` })
        }
        if (!(Number(linea.precioUnitario) > 0)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', i, 'precioUnitario'], message: `Línea ${i + 1}: escribe el precio de venta del producto nuevo` })
        }
      }
    })
  })

export type CompraNueva = z.infer<typeof compraNueva>

/** Proveedor: solo el nombre es obligatorio. Sirve para crear y para editar. */
export const proveedorNuevo = z.object({
  nombre: z.string().trim().min(1, 'escribe el nombre').max(255, 'admite como máximo 255 caracteres'),
  nit: textoOpcional(50),
  telefono: textoOpcional(30),
  email: textoOpcional(255).refine(
    (v) => v === null || z.string().email().safeParse(v).success,
    'no es un correo válido'
  ),
  direccion: textoOpcional(500),
})

/** Clasificar las líneas de una compra (existente, nuevo, parecidos) antes de guardarla. */
export const compraVerificar = z.object({
  lineas: z
    .array(
      z.object({
        sku: z.string().trim().min(1, 'escribe el SKU').max(100, 'admite como máximo 100 caracteres'),
        nombre: textoOpcional(255),
      })
    )
    .min(1, 'agrega al menos una línea')
    .max(100, 'como máximo 100 líneas por compra'),
})

/** Anular una compra: el motivo es obligatorio. */
export const compraAnulacion = z.object({
  motivo: z.string().trim().min(1, 'escribe el motivo de la anulación').max(1000, 'admite como máximo 1000 caracteres'),
})

/** Perfil de la cuenta: el nombre y el teléfono son opcionales y se pueden borrar. */
export const perfilNuevo = z.object({
  nombre: textoOpcional(120),
  telefono: textoOpcional(30).refine(
    (v) => v === null || /^\+?[\d\s()-]{7,30}$/.test(v),
    'el teléfono solo puede llevar números, espacios, + ( ) y guiones (mínimo 7 dígitos)'
  ),
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
