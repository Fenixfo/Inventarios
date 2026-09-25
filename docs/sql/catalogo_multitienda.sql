-- ============================================================================
-- TASK-49: catálogo público con varias tiendas
-- ============================================================================
-- El catálogo de la portada pasa a mostrar los productos de todas las
-- tiendas, y cada dueño decide si la suya aparece o no. Hay quien lo quiere
-- como vitrina y quien usa esto solo para llevar su inventario.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — Columna nueva
-- ----------------------------------------------------------------------------
-- Por defecto visible: es lo que hacía el catálogo hasta ahora, así que
-- nada cambia para las tiendas que ya existen.
ALTER TABLE public.tiendas
  ADD COLUMN IF NOT EXISTS publica boolean NOT NULL DEFAULT true;


-- ----------------------------------------------------------------------------
-- PASO 2 — Las tiendas de prueba no salen en el catálogo
-- ----------------------------------------------------------------------------
-- Las creó la suite de integración y no son negocios reales; sin esto
-- aparecerían en la portada junto a los productos de verdad.
UPDATE public.tiendas
   SET publica = false
 WHERE nombre LIKE 'TEST%';


-- ----------------------------------------------------------------------------
-- PASO 3 — Comprobación
-- ----------------------------------------------------------------------------
SELECT nombre, codigo, publica FROM public.tiendas ORDER BY created_at;

-- Cuántos productos verá un visitante.
SELECT count(*) AS productos_en_catalogo
  FROM public.productos p
  JOIN public.tiendas t ON t.id = p.tienda_id
 WHERE p.activo AND p.stock_actual > 0 AND t.activo AND t.publica;


-- ----------------------------------------------------------------------------
-- MARCHA ATRÁS
-- ----------------------------------------------------------------------------
-- ALTER TABLE public.tiendas DROP COLUMN IF EXISTS publica;
