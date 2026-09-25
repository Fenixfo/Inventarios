-- ============================================================================
-- El SKU solo se reserva mientras el producto está activo
-- ============================================================================
-- Borrar un producto no elimina la fila: la marca con activo = false, porque
-- las facturas viejas siguen apuntando a ella. Pero el índice único
-- (tienda_id, sku) contaba también los borrados, así que tras borrar el
-- SKU "1" no se podía volver a crear otro con "1".
--
-- Se cambia por un índice único parcial: solo entre los productos activos.
-- El borrado conserva su fila (y su historial en facturas) y el nuevo es un
-- producto aparte.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — Comprobar que no haya dos activos con el mismo SKU en una tienda
-- ----------------------------------------------------------------------------
-- Debe devolver cero filas (el índice actual ya lo impide).
SELECT tienda_id, sku, count(*) AS repetidos
  FROM public.productos
 WHERE activo = true
 GROUP BY tienda_id, sku
HAVING count(*) > 1;


-- ----------------------------------------------------------------------------
-- PASO 2 — Cambiar el índice
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.productos_tienda_sku_key;

CREATE UNIQUE INDEX IF NOT EXISTS productos_tienda_sku_activo_key
  ON public.productos (tienda_id, sku)
  WHERE activo = true;


-- ----------------------------------------------------------------------------
-- PASO 3 — Comprobación
-- ----------------------------------------------------------------------------
-- Debe aparecer productos_tienda_sku_activo_key con "WHERE (activo = true)"
-- y ya no productos_tienda_sku_key.
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE tablename = 'productos'
   AND indexname LIKE '%sku%';


-- ----------------------------------------------------------------------------
-- MARCHA ATRÁS
-- ----------------------------------------------------------------------------
-- Solo funciona si no se han creado SKU repetidos (activo + borrado).
--
-- DROP INDEX IF EXISTS public.productos_tienda_sku_activo_key;
-- CREATE UNIQUE INDEX productos_tienda_sku_key ON public.productos (tienda_id, sku);
