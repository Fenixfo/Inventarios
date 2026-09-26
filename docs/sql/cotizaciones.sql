-- ============================================================================
-- TASK-64: Módulo de cotizaciones
-- ============================================================================
-- Una cotización es una factura que no se vende: se guarda con cliente,
-- productos, precios, descuento e impuesto, pero no descuenta inventario,
-- no lleva abonos ni estados de pago.
--
-- Tablas aparte y no una bandera en `facturas`: así ningún reporte, saldo,
-- abono ni consecutivo de facturación puede contar una cotización por
-- error, y la numeración de facturas (que se explica ante la DIAN) no
-- salta por cada cotización.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — Tablas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cotizaciones (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cotizacion    varchar(50)   NOT NULL,

  cliente_id           uuid REFERENCES public.clientes(id),
  tienda_id            uuid REFERENCES public.tiendas(id) ON DELETE CASCADE,
  usuario_id           uuid REFERENCES public.usuarios(id),

  fecha                timestamptz   NOT NULL DEFAULT now(),
  termino_pago         varchar(50),
  metodo_pago          varchar(50),

  subtotal             numeric(12,2) NOT NULL,
  descuento_porcentaje numeric(5,2)  NOT NULL DEFAULT 0,
  descuento_monto      numeric(12,2) NOT NULL DEFAULT 0,
  impuesto             numeric(12,2) NOT NULL DEFAULT 0,
  total                numeric(12,2) NOT NULL,

  es_bodega            boolean       NOT NULL DEFAULT false,
  observaciones        text,

  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now()
);

-- Consecutivo propio por tienda, como las facturas.
CREATE UNIQUE INDEX IF NOT EXISTS cotizaciones_tienda_numero_key
  ON public.cotizaciones (tienda_id, numero_cotizacion);
CREATE INDEX IF NOT EXISTS cotizaciones_cliente_id_idx ON public.cotizaciones (cliente_id);
CREATE INDEX IF NOT EXISTS cotizaciones_usuario_id_idx ON public.cotizaciones (usuario_id);
CREATE INDEX IF NOT EXISTS cotizaciones_fecha_idx      ON public.cotizaciones (fecha);

CREATE TABLE IF NOT EXISTS public.cotizaciones_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id    uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  -- Si el producto se borra, la cotización conserva el nombre y el precio.
  producto_id      uuid REFERENCES public.productos(id) ON DELETE SET NULL,
  producto_nombre  varchar(255),
  cantidad_m2      numeric(12,2) NOT NULL,
  precio_unitario  numeric(10,2) NOT NULL,
  subtotal         numeric(12,2) NOT NULL,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cotizaciones_items_cotizacion_id_idx ON public.cotizaciones_items (cotizacion_id);
CREATE INDEX IF NOT EXISTS cotizaciones_items_producto_id_idx   ON public.cotizaciones_items (producto_id);


-- ----------------------------------------------------------------------------
-- PASO 2 — Permisos (aparecen solos en /admin/usuarios, módulo Cotizaciones)
-- ----------------------------------------------------------------------------
INSERT INTO public.permisos (modulo, accion, nombre, descripcion, orden) VALUES
  ('cotizaciones', 'ver',       'Ver sus propias cotizaciones',          NULL, 45),
  ('cotizaciones', 'ver_todas', 'Ver las cotizaciones de toda la tienda', NULL, 46),
  ('cotizaciones', 'crear',     'Crear cotizaciones',                     NULL, 47)
ON CONFLICT (modulo, accion) DO NOTHING;


-- ----------------------------------------------------------------------------
-- PASO 3 — Comprobación
-- ----------------------------------------------------------------------------
-- Deben salir las dos tablas y los tres permisos.
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name LIKE 'cotizaciones%';

SELECT modulo, accion, nombre FROM public.permisos
 WHERE modulo = 'cotizaciones' ORDER BY orden;


-- ----------------------------------------------------------------------------
-- MARCHA ATRÁS (borra todas las cotizaciones guardadas)
-- ----------------------------------------------------------------------------
-- DELETE FROM public.permisos WHERE modulo = 'cotizaciones';
-- DROP TABLE IF EXISTS public.cotizaciones_items;
-- DROP TABLE IF EXISTS public.cotizaciones;
