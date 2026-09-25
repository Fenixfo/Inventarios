-- ============================================================================
-- TASK-46: código de tienda
-- ============================================================================
-- Cada tienda tiene un código de 6 caracteres que su dueño comparte para
-- que le pidan acceso. Sustituye al directorio de tiendas: sin el código no
-- se puede solicitar entrar a ninguna, así que no hace falta publicar la
-- lista de negocios registrados.
--
-- El alfabeto evita los caracteres que se confunden al dictarlos por
-- teléfono: sin 0 ni O, sin 1, I ni L.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — Qué tiendas hay (no modifica nada)
-- ----------------------------------------------------------------------------
SELECT id, nombre, ciudad FROM public.tiendas ORDER BY created_at;


-- ----------------------------------------------------------------------------
-- PASO 2 — Columna nueva
-- ----------------------------------------------------------------------------
ALTER TABLE public.tiendas
  ADD COLUMN IF NOT EXISTS codigo varchar(6);


-- ----------------------------------------------------------------------------
-- PASO 3 — Código para las tiendas que ya existen
-- ----------------------------------------------------------------------------
-- Se saca de un uuid nuevo, que Postgres genera distinto en cada fila. Los
-- dígitos 0 y 1 del hexadecimal se cambian por W y X para que no se
-- confundan con la O y la I al leer el código en voz alta.
UPDATE public.tiendas
   SET codigo = upper(
         translate(
           substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
           '01',
           'wx'
         )
       )
 WHERE codigo IS NULL;


-- ----------------------------------------------------------------------------
-- PASO 4 — Único y obligatorio
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS tiendas_codigo_key ON public.tiendas (codigo);

ALTER TABLE public.tiendas ALTER COLUMN codigo SET NOT NULL;

-- El nombre deja de ser único: dos dueños distintos pueden tener negocios
-- que se llamen igual, y para eso está el código.
ALTER TABLE public.tiendas DROP CONSTRAINT IF EXISTS tiendas_nombre_key;
DROP INDEX IF EXISTS public.tiendas_nombre_key;


-- ----------------------------------------------------------------------------
-- PASO 5 — Comprobación
-- ----------------------------------------------------------------------------
-- Cada tienda con su código, todos distintos.
SELECT nombre, codigo FROM public.tiendas ORDER BY created_at;

SELECT count(*) AS tiendas, count(DISTINCT codigo) AS codigos_distintos
  FROM public.tiendas;


-- ----------------------------------------------------------------------------
-- MARCHA ATRÁS
-- ----------------------------------------------------------------------------
-- BEGIN;
-- DROP INDEX IF EXISTS public.tiendas_codigo_key;
-- ALTER TABLE public.tiendas DROP COLUMN IF EXISTS codigo;
-- CREATE UNIQUE INDEX tiendas_nombre_key ON public.tiendas (nombre);
-- COMMIT;
