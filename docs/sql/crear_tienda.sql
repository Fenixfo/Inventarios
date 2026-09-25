-- ============================================================================
-- TASK-47: crear tienda
-- ============================================================================
-- Cualquiera con cuenta puede abrir su tienda y queda como dueño. Para que
-- nadie las cree en serie hay dos topes: una tienda propia por persona, que
-- se cuenta sobre `usuarios_tiendas`, y diez al día por IP, que necesita
-- guardar desde dónde se creó cada una.
--
-- El tope por IP es diario y no absoluto a propósito: en un negocio, una
-- casa o un café todos salen por la misma IP, y un tope de por vida dejaría
-- fuera al segundo dueño legítimo sin que pudiera hacer nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — Columna nueva
-- ----------------------------------------------------------------------------
ALTER TABLE public.tiendas
  ADD COLUMN IF NOT EXISTS creada_desde_ip varchar(45);

-- Se consulta "cuántas tiendas se crearon desde esta IP en las últimas 24
-- horas", así que el índice va sobre las dos columnas.
CREATE INDEX IF NOT EXISTS tiendas_ip_creacion_idx
  ON public.tiendas (creada_desde_ip, created_at);


-- ----------------------------------------------------------------------------
-- PASO 2 — Comprobación
-- ----------------------------------------------------------------------------
-- Las tiendas que ya existen quedan sin IP, que es correcto: se crearon
-- antes de que esto existiera y no gastan el cupo de nadie.
SELECT nombre, codigo, creada_desde_ip, created_at
  FROM public.tiendas
 ORDER BY created_at;


-- ----------------------------------------------------------------------------
-- MARCHA ATRÁS
-- ----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS public.tiendas_ip_creacion_idx;
-- ALTER TABLE public.tiendas DROP COLUMN IF EXISTS creada_desde_ip;
