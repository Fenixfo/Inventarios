-- ============================================================================
-- TASK-55: buscar por nombre en el servidor, sin tildes
-- ============================================================================
-- Hasta ahora el buscador filtraba lo que ya estaba cargado: si el catálogo
-- traía 9 productos, buscar "gris" solo miraba en esos 9 y el resto no
-- aparecía nunca.
--
-- Al pasar la búsqueda al servidor hay que resolver las tildes: en la base
-- hay 28 productos con tilde o ñ —toda la familia "Café", entre otros— y
-- quien escribe "cafe" tiene que encontrarlos. Postgres compara sin
-- distinguir mayúsculas, pero no ignora las tildes.
--
-- Se añade una columna que guarda el nombre ya normalizado. La calcula la
-- base sola en cada inserción o cambio: no hay que mantenerla desde la
-- aplicación y no se puede desincronizar.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — Columna normalizada
-- ----------------------------------------------------------------------------
-- `translate` cambia cada carácter acentuado por su equivalente simple, y
-- `lower` iguala mayúsculas y minúsculas. GENERATED ALWAYS quiere decir que
-- la mantiene Postgres: si alguien intenta escribirla, la rechaza.
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS nombre_busqueda text
  GENERATED ALWAYS AS (
    lower(translate(nombre, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))
  ) STORED;


-- ----------------------------------------------------------------------------
-- PASO 2 — Comprobación
-- ----------------------------------------------------------------------------
-- El nombre y su versión para buscar, uno al lado del otro.
SELECT nombre, nombre_busqueda
  FROM public.productos
 WHERE nombre <> nombre_busqueda
 ORDER BY nombre
 LIMIT 10;

-- Lo que hará la aplicación al buscar "cafe": debe encontrar los "Café".
SELECT count(*) AS encontrados
  FROM public.productos
 WHERE nombre_busqueda LIKE '%cafe%';


-- ----------------------------------------------------------------------------
-- NOTA SOBRE RENDIMIENTO
-- ----------------------------------------------------------------------------
-- Una búsqueda "que contenga" no aprovecha un índice normal, así que aquí no
-- se crea ninguno: con unos cientos de productos por tienda, Postgres los
-- recorre sin despeinarse.
--
-- El día que una tienda tenga decenas de miles, el índice que sirve es uno
-- de trigramas:
--
--   CREATE EXTENSION IF NOT EXISTS pg_trgm;
--   CREATE INDEX productos_nombre_busqueda_trgm
--     ON public.productos USING gin (nombre_busqueda gin_trgm_ops);


-- ----------------------------------------------------------------------------
-- MARCHA ATRÁS
-- ----------------------------------------------------------------------------
-- ALTER TABLE public.productos DROP COLUMN IF EXISTS nombre_busqueda;
