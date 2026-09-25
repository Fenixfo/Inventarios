-- ============================================================================
-- SKU y cédula únicos por tienda, no en toda la base
-- ============================================================================
-- Con dos tiendas, crear un producto con un SKU que ya usaba otro negocio
-- fallaba: el índice era global. Cada tienda numera sus productos como
-- quiera, y que dos usen "BER-001" no tiene nada de raro.
--
-- Lo mismo con la cédula del cliente: la misma persona puede comprar en dos
-- tiendas, y cada una la registra por su cuenta.
--
-- Es el tercer caso de la misma clase, después de `numero_factura` y de
-- `configuracion.clave`.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — Comprobar que no haya choques dentro de una misma tienda
-- ----------------------------------------------------------------------------
-- Debe devolver cero filas. Si devolviera alguna, hay que resolver esos
-- duplicados antes de crear el índice nuevo, porque no lo aceptaría.
SELECT tienda_id, sku, count(*) AS repetidos
  FROM public.productos
 GROUP BY tienda_id, sku
HAVING count(*) > 1;

SELECT tienda_id, cedula_cc, count(*) AS repetidos
  FROM public.clientes
 WHERE cedula_cc IS NOT NULL
 GROUP BY tienda_id, cedula_cc
HAVING count(*) > 1;


-- ----------------------------------------------------------------------------
-- PASO 2 — Productos: el SKU pasa a ser único por tienda
-- ----------------------------------------------------------------------------
-- Prisma lo creó como índice único, así que hace falta DROP INDEX y no basta
-- con DROP CONSTRAINT.
ALTER TABLE public.productos DROP CONSTRAINT IF EXISTS productos_sku_key;
DROP INDEX IF EXISTS public.productos_sku_key;

CREATE UNIQUE INDEX IF NOT EXISTS productos_tienda_sku_key
  ON public.productos (tienda_id, sku);


-- ----------------------------------------------------------------------------
-- PASO 3 — Clientes: la cédula pasa a ser única por tienda
-- ----------------------------------------------------------------------------
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_cedula_cc_key;
DROP INDEX IF EXISTS public.clientes_cedula_cc_key;

-- En Postgres un índice único deja pasar varios NULL, así que los clientes
-- sin cédula no chocan entre sí.
CREATE UNIQUE INDEX IF NOT EXISTS clientes_tienda_cedula_key
  ON public.clientes (tienda_id, cedula_cc);


-- ----------------------------------------------------------------------------
-- PASO 4 — Comprobación
-- ----------------------------------------------------------------------------
-- Deben aparecer los dos índices nuevos y ninguno de los viejos.
SELECT tablename, indexname
  FROM pg_indexes
 WHERE tablename IN ('productos', 'clientes')
   AND (indexname LIKE '%sku%' OR indexname LIKE '%cedula%')
 ORDER BY tablename, indexname;


-- ----------------------------------------------------------------------------
-- MARCHA ATRÁS
-- ----------------------------------------------------------------------------
-- Solo funciona si no se han creado SKU repetidos entre tiendas.
--
-- DROP INDEX IF EXISTS public.productos_tienda_sku_key;
-- CREATE UNIQUE INDEX productos_sku_key ON public.productos (sku);
-- DROP INDEX IF EXISTS public.clientes_tienda_cedula_key;
-- CREATE UNIQUE INDEX clientes_cedula_cc_key ON public.clientes (cedula_cc);
