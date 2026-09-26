-- ============================================================================
-- TASK-67: Liquidaciones de vendedores
-- ============================================================================
-- Liquidar es el cierre de una factura cobrada: se calcula la ganancia
-- (venta sin impuesto − costo) y al vendedor se le entrega un porcentaje,
-- 30 por defecto. Una liquidación junta varias facturas de un vendedor.
-- La factura no se borra: queda en estado "liquidado".
--
-- Para saber la ganancia hay que saber el costo de lo vendido, y ese costo
-- cambia con el tiempo. Por eso cada línea de factura guarda, al facturar,
-- el costo del producto y cuánto de lo vendido había en inventario. Lo que
-- se vendió sin stock no tiene costo conocido todavía: se pone al liquidar.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — Liquidaciones
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.liquidaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tienda_id       uuid NOT NULL REFERENCES public.tiendas(id) ON DELETE CASCADE,
  -- A quién se le liquida y quién la hizo.
  vendedor_id     uuid NOT NULL REFERENCES public.usuarios(id),
  creada_por      uuid REFERENCES public.usuarios(id),

  fecha           timestamptz   NOT NULL DEFAULT now(),
  -- El porcentaje que se usó, aunque luego cambie el de por defecto.
  porcentaje      numeric(5,2)  NOT NULL,

  total_venta     numeric(14,2) NOT NULL,
  total_costo     numeric(14,2) NOT NULL,
  total_ganancia  numeric(14,2) NOT NULL,
  pago_vendedor   numeric(14,2) NOT NULL,

  observaciones   text,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS liquidaciones_tienda_id_idx   ON public.liquidaciones (tienda_id);
CREATE INDEX IF NOT EXISTS liquidaciones_vendedor_id_idx ON public.liquidaciones (vendedor_id);
CREATE INDEX IF NOT EXISTS liquidaciones_fecha_idx       ON public.liquidaciones (fecha);

-- Sin esto, la API REST de Supabase la publicaría abierta (TASK-65).
ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- PASO 2 — La factura sabe en qué liquidación quedó
-- ----------------------------------------------------------------------------
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS liquidacion_id uuid REFERENCES public.liquidaciones(id);

CREATE INDEX IF NOT EXISTS facturas_liquidacion_id_idx ON public.facturas (liquidacion_id);


-- ----------------------------------------------------------------------------
-- PASO 3 — El costo de cada línea
-- ----------------------------------------------------------------------------
-- costo_unitario:      el costo del producto al facturar.
-- cantidad_con_costo:  cuánto de lo vendido había en inventario, que es lo
--                      que se vende a ese costo. Ej.: vende 25, había 10 →
--                      10 con costo conocido y 15 pendientes.
-- costo_liquidacion:   el costo que se pone al liquidar para lo pendiente
--                      (lo vendido sin stock, o un producto personalizado).
--
-- Las facturas de antes de este cambio quedan con cantidad_con_costo = 0:
-- todo pendiente, y al liquidar se propone el costo actual del producto.
ALTER TABLE public.facturas_items
  ADD COLUMN IF NOT EXISTS costo_unitario     numeric(10,2),
  ADD COLUMN IF NOT EXISTS cantidad_con_costo numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_liquidacion  numeric(10,2);


-- ----------------------------------------------------------------------------
-- PASO 4 — Permisos (aparecen solos en /admin/usuarios, módulo Liquidaciones)
-- ----------------------------------------------------------------------------
INSERT INTO public.permisos (modulo, accion, nombre, descripcion, orden) VALUES
  ('liquidaciones', 'ver',   'Ver liquidaciones', NULL, 55),
  ('liquidaciones', 'crear', 'Liquidar facturas',
   'Cerrar facturas cobradas y calcular el pago al vendedor.', 56)
ON CONFLICT (modulo, accion) DO NOTHING;


-- ----------------------------------------------------------------------------
-- PASO 5 — Comprobación
-- ----------------------------------------------------------------------------
-- Debe salir la tabla con rls = true, las columnas nuevas y los dos permisos.
SELECT relname AS tabla, relrowsecurity AS rls
  FROM pg_class WHERE relname = 'liquidaciones';

SELECT table_name, column_name FROM information_schema.columns
 WHERE (table_name = 'facturas' AND column_name = 'liquidacion_id')
    OR (table_name = 'facturas_items'
        AND column_name IN ('costo_unitario', 'cantidad_con_costo', 'costo_liquidacion'))
 ORDER BY table_name, column_name;

SELECT modulo, accion, nombre FROM public.permisos
 WHERE modulo = 'liquidaciones' ORDER BY orden;


-- ----------------------------------------------------------------------------
-- MARCHA ATRÁS (solo si todavía no se ha liquidado nada)
-- ----------------------------------------------------------------------------
-- UPDATE public.facturas SET estado = 'entregado' WHERE estado = 'liquidado';
-- ALTER TABLE public.facturas DROP COLUMN IF EXISTS liquidacion_id;
-- ALTER TABLE public.facturas_items
--   DROP COLUMN IF EXISTS costo_unitario,
--   DROP COLUMN IF EXISTS cantidad_con_costo,
--   DROP COLUMN IF EXISTS costo_liquidacion;
-- DROP TABLE IF EXISTS public.liquidaciones;
-- DELETE FROM public.permisos WHERE modulo = 'liquidaciones';
