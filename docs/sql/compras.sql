-- ============================================================================
-- Módulo de compras
-- ============================================================================
-- Registra las facturas de compra a proveedores. Una compra tiene un
-- proveedor, varias líneas (cada una enlazada a un producto) y costos
-- adicionales como flete o descargue. Al guardarla, el servidor crea o
-- completa los productos, suma el stock, fija el costo y deja un movimiento
-- de inventario por línea, todo en una sola transacción.
--
-- Una compra no se edita ni se borra: se anula con un motivo, y queda
-- guardada con su estado.
--
-- Este script SOLO AGREGA: no borra ni modifica nada de lo que ya existe, y se
-- puede ejecutar más de una vez sin error.
--
-- Ejecutar en el SQL Editor de Supabase ANTES de publicar el código y antes
-- de correr las pruebas de integración: sin estas tablas, el módulo falla.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — Proveedores (de cada tienda; no se comparten entre tiendas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proveedores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tienda_id   uuid NOT NULL REFERENCES public.tiendas(id) ON DELETE CASCADE,

  nombre      varchar(255) NOT NULL,
  -- Se guarda NULL, nunca '', cuando no hay NIT: así el índice único no
  -- choca entre proveedores sin NIT (en Postgres los NULL no se comparan).
  nit         varchar(50),
  telefono    varchar(30),
  email       varchar(255),
  direccion   text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proveedores_tienda_id_idx ON public.proveedores (tienda_id);

-- Un NIT por tienda: el mismo proveedor puede existir en dos tiendas.
CREATE UNIQUE INDEX IF NOT EXISTS proveedores_tienda_nit_key
  ON public.proveedores (tienda_id, nit);

-- Sin esto, la API REST de Supabase la publicaría abierta.
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- PASO 2 — Compras (la factura de compra)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compras (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tienda_id                 uuid NOT NULL REFERENCES public.tiendas(id) ON DELETE CASCADE,
  proveedor_id              uuid NOT NULL REFERENCES public.proveedores(id),

  -- El número que trae la factura del proveedor. Es opcional.
  numero_factura_proveedor  varchar(100),
  fecha                     timestamptz   NOT NULL DEFAULT now(),

  subtotal                  numeric(14,2) NOT NULL,
  total_extras              numeric(14,2) NOT NULL DEFAULT 0,
  total                     numeric(14,2) NOT NULL,

  -- Cómo se repartieron los costos adicionales entre las líneas.
  metodo_reparto            varchar(10)   NOT NULL DEFAULT 'valor'
                            CHECK (metodo_reparto IN ('valor', 'cantidad')),

  estado                    varchar(20)   NOT NULL DEFAULT 'registrada'
                            CHECK (estado IN ('registrada', 'anulada')),
  observaciones             text,

  creada_por                uuid REFERENCES public.usuarios(id),
  created_at                timestamptz   NOT NULL DEFAULT now(),

  anulada_por               uuid REFERENCES public.usuarios(id),
  anulada_en                timestamptz,
  motivo_anulacion          text
);

CREATE INDEX IF NOT EXISTS compras_tienda_id_idx    ON public.compras (tienda_id);
CREATE INDEX IF NOT EXISTS compras_proveedor_id_idx ON public.compras (proveedor_id);
CREATE INDEX IF NOT EXISTS compras_fecha_idx        ON public.compras (fecha);

-- La misma factura de un proveedor no se registra dos veces, salvo que la
-- anterior esté anulada. Es un índice PARCIAL: Prisma no sabe declararlos,
-- así que vive solo aquí (igual que productos_tienda_sku_activo_key). No usar
-- `prisma db push`: lo borraría.
CREATE UNIQUE INDEX IF NOT EXISTS compras_tienda_proveedor_factura_key
  ON public.compras (tienda_id, proveedor_id, numero_factura_proveedor)
  WHERE estado <> 'anulada' AND numero_factura_proveedor IS NOT NULL;

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- PASO 3 — Líneas de la compra
-- ----------------------------------------------------------------------------
-- precio_factura: lo que dice el papel, por unidad.
-- costo_extra:    la parte repartida de los costos adicionales (total de la línea).
-- costo_final:    el costo por unidad que queda en el producto: el precio de
--                 factura más el extra repartido entre la cantidad, o el que
--                 se escribió a mano (costo_editado).
CREATE TABLE IF NOT EXISTS public.compras_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id        uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  producto_id      uuid NOT NULL REFERENCES public.productos(id),

  -- Copia del nombre al comprar, por si luego se renombra el producto.
  producto_nombre  varchar(255) NOT NULL,
  -- true si el producto se creó en esta misma compra.
  producto_creado  boolean       NOT NULL DEFAULT false,

  cantidad         numeric(12,2) NOT NULL CHECK (cantidad > 0),
  precio_factura   numeric(12,2) NOT NULL CHECK (precio_factura >= 0),
  costo_extra      numeric(12,2) NOT NULL DEFAULT 0,
  costo_final      numeric(12,2) NOT NULL CHECK (costo_final >= 0),
  costo_editado    boolean       NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS compras_items_compra_id_idx   ON public.compras_items (compra_id);
CREATE INDEX IF NOT EXISTS compras_items_producto_id_idx ON public.compras_items (producto_id);

ALTER TABLE public.compras_items ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- PASO 4 — Costos adicionales (flete, descargue...)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compras_costos_extra (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id  uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  concepto   varchar(255)  NOT NULL,
  valor      numeric(12,2) NOT NULL CHECK (valor > 0)
);

CREATE INDEX IF NOT EXISTS compras_costos_extra_compra_id_idx
  ON public.compras_costos_extra (compra_id);

ALTER TABLE public.compras_costos_extra ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- PASO 5 — Permisos (aparecen solos en /admin/usuarios, módulo Compras)
-- ----------------------------------------------------------------------------
-- El orden 57-59 es el hueco que dejan liquidaciones (55-56) y auditoría (60).
INSERT INTO public.permisos (modulo, accion, nombre, descripcion, orden) VALUES
  ('compras', 'ver',    'Ver compras y proveedores', NULL, 57),
  ('compras', 'crear',  'Registrar compras y proveedores',
   'Registrar facturas de compra, crear y editar proveedores. Crear productos nuevos desde una compra exige además el permiso de crear productos.', 58),
  ('compras', 'anular', 'Anular compras',
   'Anular una compra y devolver el stock que sumó.', 59)
ON CONFLICT (modulo, accion) DO NOTHING;


-- ----------------------------------------------------------------------------
-- PASO 6 — Comprobación
-- ----------------------------------------------------------------------------
-- Las 4 tablas deben salir con rls = true.
SELECT relname AS tabla, relrowsecurity AS rls
  FROM pg_class
 WHERE relname IN ('proveedores', 'compras', 'compras_items', 'compras_costos_extra')
 ORDER BY relname;

-- Deben salir los dos índices únicos (NIT por tienda y factura por proveedor).
SELECT indexname FROM pg_indexes
 WHERE schemaname = 'public'
   AND indexname IN ('proveedores_tienda_nit_key', 'compras_tienda_proveedor_factura_key');

-- Deben salir los 3 permisos.
SELECT modulo, accion, nombre, orden FROM public.permisos
 WHERE modulo = 'compras' ORDER BY orden;


-- ----------------------------------------------------------------------------
-- MARCHA ATRÁS (solo si todavía no se ha registrado ninguna compra)
-- ----------------------------------------------------------------------------
-- Está comentada a propósito: descomentar y ejecutar solo con esa condición.
-- DROP TABLE IF EXISTS public.compras_costos_extra;
-- DROP TABLE IF EXISTS public.compras_items;
-- DROP TABLE IF EXISTS public.compras;
-- DROP TABLE IF EXISTS public.proveedores;
-- DELETE FROM public.permisos WHERE modulo = 'compras';
