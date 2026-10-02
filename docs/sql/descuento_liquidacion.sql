-- ----------------------------------------------------------------------------
-- Descuento en las liquidaciones
-- ----------------------------------------------------------------------------
-- El admin puede restarle un valor a lo que gana el vendedor en una
-- liquidación, con la razón. Ejecutar en el SQL Editor de Supabase ANTES de
-- publicar el código: sin estas columnas, liquidar falla.

ALTER TABLE public.liquidaciones
  ADD COLUMN IF NOT EXISTS descuento numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descuento_motivo text;

-- Comprobación: deben salir las dos columnas.
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'liquidaciones' AND column_name IN ('descuento', 'descuento_motivo');

-- MARCHA ATRÁS
-- ALTER TABLE public.liquidaciones
--   DROP COLUMN IF EXISTS descuento,
--   DROP COLUMN IF EXISTS descuento_motivo;
