-- ============================================================================
-- TASK-44: aislar los datos por tienda
-- ============================================================================
-- Hasta ahora la aplicación funcionaba como si existiera una sola tienda.
-- Los endpoints ya filtran por `tienda_id`; falta que los datos que ya están
-- lo tengan, y que la auditoría pueda separarse igual que el resto.
--
-- Respaldo previo: backups/backup_2026-09-24_1341.json (441 registros).
-- Ejecutar por pasos y revisar el paso 1 antes de seguir.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — Qué hay sin tienda (no modifica nada)
-- ----------------------------------------------------------------------------
SELECT 'productos'  AS tabla, count(*) AS total, count(tienda_id) AS con_tienda FROM public.productos
UNION ALL
SELECT 'clientes',  count(*), count(tienda_id) FROM public.clientes
UNION ALL
SELECT 'facturas',  count(*), count(tienda_id) FROM public.facturas;

-- Debe haber exactamente una tienda; si hubiera más, el paso 3 asignaría
-- datos a la tienda equivocada.
SELECT id, nombre FROM public.tiendas;


-- ----------------------------------------------------------------------------
-- PASO 2 — La auditoría también se separa por tienda
-- ----------------------------------------------------------------------------
ALTER TABLE public.auditoria
  ADD COLUMN IF NOT EXISTS tienda_id uuid REFERENCES public.tiendas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS auditoria_tienda_id_idx ON public.auditoria(tienda_id);


-- ----------------------------------------------------------------------------
-- PASO 3 — Todo lo que existe es de Beraca
-- ----------------------------------------------------------------------------
-- La tienda se busca dentro de cada UPDATE, con una subconsulta, en vez de
-- escribir el UUID a mano: así no depende de copiar y pegar bien un
-- identificador de 36 caracteres, y cada línea se puede ejecutar suelta.
--
-- El paso 1 ya confirmó que solo hay una tienda; si hubiera más, esto
-- tomaría la más antigua y habría que revisarlo antes de seguir.

UPDATE public.productos
   SET tienda_id = (SELECT id FROM public.tiendas ORDER BY created_at LIMIT 1)
 WHERE tienda_id IS NULL;

UPDATE public.clientes
   SET tienda_id = (SELECT id FROM public.tiendas ORDER BY created_at LIMIT 1)
 WHERE tienda_id IS NULL;

UPDATE public.facturas
   SET tienda_id = (SELECT id FROM public.tiendas ORDER BY created_at LIMIT 1)
 WHERE tienda_id IS NULL;

UPDATE public.auditoria
   SET tienda_id = (SELECT id FROM public.tiendas ORDER BY created_at LIMIT 1)
 WHERE tienda_id IS NULL;


-- ----------------------------------------------------------------------------
-- PASO 4 — El consecutivo de facturas es de cada tienda
-- ----------------------------------------------------------------------------
-- Hoy `numero_factura` es único en toda la base. Con dos tiendas facturando
-- el mismo día, la segunda chocaría con el número de la primera. Cada
-- negocio lleva su propia numeración, que además es lo que se explica ante
-- la DIAN.
--
-- Prisma lo creó como índice único, no como restricción de tabla, así que
-- el DROP CONSTRAINT no lo quita: hace falta el DROP INDEX de la línea
-- siguiente, y sin él la numeración sigue siendo global.
ALTER TABLE public.facturas DROP CONSTRAINT IF EXISTS facturas_numero_factura_key;
DROP INDEX IF EXISTS public.facturas_numero_factura_key;

CREATE UNIQUE INDEX IF NOT EXISTS facturas_tienda_numero_key
  ON public.facturas (tienda_id, numero_factura);


-- ----------------------------------------------------------------------------
-- PASO 5 — Comprobación
-- ----------------------------------------------------------------------------
-- Las tres primeras columnas deben quedar en cero.
SELECT
  (SELECT count(*) FROM public.productos WHERE tienda_id IS NULL) AS productos_sin_tienda,
  (SELECT count(*) FROM public.clientes  WHERE tienda_id IS NULL) AS clientes_sin_tienda,
  (SELECT count(*) FROM public.facturas  WHERE tienda_id IS NULL) AS facturas_sin_tienda,
  (SELECT count(*) FROM public.auditoria WHERE tienda_id IS NULL) AS auditoria_sin_tienda;

-- Y el índice nuevo debe aparecer aquí.
SELECT indexname FROM pg_indexes
 WHERE tablename = 'facturas' AND indexname LIKE '%numero%';


-- ----------------------------------------------------------------------------
-- MARCHA ATRÁS
-- ----------------------------------------------------------------------------
-- No hace falta deshacer el relleno: los datos eran de Beraca de todos modos.
-- Si hiciera falta volver al estado anterior:
--
-- DROP INDEX IF EXISTS public.facturas_tienda_numero_key;
-- ALTER TABLE public.facturas ADD CONSTRAINT facturas_numero_factura_key UNIQUE (numero_factura);
-- ALTER TABLE public.auditoria DROP COLUMN IF EXISTS tienda_id;
