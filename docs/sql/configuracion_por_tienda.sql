-- ============================================================================
-- TASK-45: la configuración pasa a ser de cada tienda
-- ============================================================================
-- `configuracion.clave` era única en toda la base: había una sola fila
-- `logo_url` para el sistema entero. Con varias tiendas, cada una necesita
-- la suya.
--
-- Además, el nombre deja de vivir aquí: `tiendas.nombre` es el único nombre.
-- Tener el mismo dato en dos sitios fue lo que dejó "No autorizado" como
-- nombre de la empresa en las facturas mientras la tienda se seguía
-- llamando Beraca.
--
-- Ejecutar por pasos y revisar el paso 1 antes de seguir.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — Qué hay hoy (no modifica nada)
-- ----------------------------------------------------------------------------
SELECT clave, valor FROM public.configuracion ORDER BY clave;

SELECT id, nombre FROM public.tiendas ORDER BY created_at;


-- ----------------------------------------------------------------------------
-- PASO 2 — Columna nueva
-- ----------------------------------------------------------------------------
-- Entra anulable para poder rellenarla; en el paso 4 se vuelve obligatoria.
ALTER TABLE public.configuracion
  ADD COLUMN IF NOT EXISTS tienda_id uuid REFERENCES public.tiendas(id) ON DELETE CASCADE;


-- ----------------------------------------------------------------------------
-- PASO 3 — Lo que hay es de Beraca
-- ----------------------------------------------------------------------------
UPDATE public.configuracion
   SET tienda_id = (SELECT id FROM public.tiendas ORDER BY created_at LIMIT 1)
 WHERE tienda_id IS NULL;

-- El nombre ya no se guarda aquí. La fila actual dice "No autorizado", que
-- fue un mensaje de error que acabó guardado como si fuera el nombre; el
-- bueno es el de `tiendas.nombre`.
DELETE FROM public.configuracion WHERE clave = 'nombre_empresa';


-- ----------------------------------------------------------------------------
-- PASO 4 — La unicidad pasa a ser por tienda
-- ----------------------------------------------------------------------------
-- Como con las facturas: Prisma lo creó como índice único, así que hace
-- falta el DROP INDEX y no basta con DROP CONSTRAINT.
ALTER TABLE public.configuracion DROP CONSTRAINT IF EXISTS configuracion_clave_key;
DROP INDEX IF EXISTS public.configuracion_clave_key;

CREATE UNIQUE INDEX IF NOT EXISTS configuracion_tienda_clave_key
  ON public.configuracion (tienda_id, clave);

ALTER TABLE public.configuracion ALTER COLUMN tienda_id SET NOT NULL;


-- ----------------------------------------------------------------------------
-- PASO 5 — Comprobación
-- ----------------------------------------------------------------------------
-- Se esperan 7 filas, todas con tienda, y ninguna `nombre_empresa`.
SELECT count(*)                                             AS filas,
       count(tienda_id)                                     AS con_tienda,
       count(*) FILTER (WHERE clave = 'nombre_empresa')      AS nombre_empresa
  FROM public.configuracion;

SELECT indexname FROM pg_indexes
 WHERE tablename = 'configuracion';


-- ----------------------------------------------------------------------------
-- MARCHA ATRÁS
-- ----------------------------------------------------------------------------
-- BEGIN;
-- ALTER TABLE public.configuracion ALTER COLUMN tienda_id DROP NOT NULL;
-- DROP INDEX IF EXISTS public.configuracion_tienda_clave_key;
-- CREATE UNIQUE INDEX configuracion_clave_key ON public.configuracion (clave);
-- ALTER TABLE public.configuracion DROP COLUMN IF EXISTS tienda_id;
-- COMMIT;
