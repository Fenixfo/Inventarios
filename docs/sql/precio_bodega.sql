-- ============================================================================
-- Tres precios por producto: costo, bodega y público
-- ============================================================================
-- Hoy `precio_unitario` guarda lo que en realidad es el precio de bodega
-- (la columna "Depósito $" del Excel). Este script lo mueve a su sitio y
-- deja `precio_unitario` como precio al público.
--
-- Los +5.000 son un valor de arranque para que el precio al cliente no
-- quede vacío, no una regla del negocio: a partir de aquí cada precio se
-- edita por separado desde la ficha del producto.
--
-- Ejecutar por pasos, en el SQL Editor de Supabase, y revisar el paso 1
-- antes de seguir.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — Cómo están los precios ahora (no modifica nada)
-- ----------------------------------------------------------------------------
SELECT count(*)                                   AS productos,
       min(precio_unitario)                       AS precio_min,
       max(precio_unitario)                       AS precio_max,
       round(avg(precio_unitario), 0)             AS precio_promedio,
       count(*) FILTER (WHERE costo IS NULL)      AS sin_costo,
       round(sum(stock_actual * precio_unitario)) AS valor_a_precio_venta,
       round(sum(stock_actual * costo))           AS valor_al_costo
  FROM public.productos;


-- ----------------------------------------------------------------------------
-- PASO 2 — Columnas nuevas
-- ----------------------------------------------------------------------------
-- precio_bodega queda anulable a propósito: si un producto se crea sin él,
-- el sistema cobra el precio al público en vez de venderlo a cero.
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS precio_bodega            numeric(10, 2),
  ADD COLUMN IF NOT EXISTS precio_bodega_updated_at timestamptz;

-- Marca en la factura si se vendió a precio de bodega. Sin esto, dentro de
-- unos meses nadie puede explicar por qué dos facturas del mismo producto
-- tienen precios distintos.
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS es_bodega boolean NOT NULL DEFAULT false;


-- ----------------------------------------------------------------------------
-- PASO 3 — Traslado de precios
-- ----------------------------------------------------------------------------
-- El orden importa: primero se copia, después se sube. Al revés los dos
-- quedarían iguales.
BEGIN;

-- 3.1 El precio actual pasa a ser el de bodega.
UPDATE public.productos
   SET precio_bodega            = precio_unitario,
       precio_bodega_updated_at = now()
 WHERE precio_bodega IS NULL;

-- 3.2 El precio al público arranca 5.000 por encima del de bodega.
--     La condición `precio_unitario = precio_bodega` hace que repetir el
--     script no vuelva a sumar: la segunda vez ya no coinciden.
UPDATE public.productos
   SET precio_unitario            = precio_bodega + 5000,
       precio_unitario_updated_at = now()
 WHERE precio_unitario = precio_bodega;

COMMIT;


-- ----------------------------------------------------------------------------
-- PASO 4 — Comprobación
-- ----------------------------------------------------------------------------
-- Se espera: 168 productos, ninguno sin precio de bodega, y la diferencia
-- entre público y bodega igual a 5.000 en todos.
SELECT count(*)                                            AS productos,
       count(*) FILTER (WHERE precio_bodega IS NULL)       AS sin_precio_bodega,
       count(*) FILTER (WHERE precio_unitario
                            - precio_bodega <> 5000)       AS diferencia_distinta_de_5000,
       round(sum(stock_actual * precio_unitario))          AS valor_a_precio_publico,
       round(sum(stock_actual * precio_bodega))            AS valor_a_precio_bodega,
       round(sum(stock_actual * costo))                    AS valor_al_costo
  FROM public.productos;

-- Muestra para revisar a ojo.
SELECT sku, nombre, costo, precio_bodega, precio_unitario
  FROM public.productos
 ORDER BY sku
 LIMIT 15;


-- ----------------------------------------------------------------------------
-- MARCHA ATRÁS, por si hiciera falta antes de tocar precios a mano
-- ----------------------------------------------------------------------------
-- BEGIN;
-- UPDATE public.productos
--    SET precio_unitario = precio_bodega
--  WHERE precio_bodega IS NOT NULL;
-- ALTER TABLE public.productos
--   DROP COLUMN IF EXISTS precio_bodega,
--   DROP COLUMN IF EXISTS precio_bodega_updated_at;
-- ALTER TABLE public.facturas DROP COLUMN IF EXISTS es_bodega;
-- COMMIT;
