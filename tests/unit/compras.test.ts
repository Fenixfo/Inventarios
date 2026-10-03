import { describe, it, expect } from 'vitest'
import {
  camposACompletar,
  costoFinalUnitario,
  nombresParecidos,
  normalizarNombre,
  repartirCostosExtra,
} from '@/lib/compras'

const suma = (valores: number[]) => Math.round(valores.reduce((s, v) => s + v, 0) * 100) / 100

describe('repartirCostosExtra', () => {
  it('por valor: 100 de flete en líneas de 300 y 700 → 30 y 70', () => {
    const lineas = [
      { cantidad: 3, precioFactura: 100 }, // 300
      { cantidad: 7, precioFactura: 100 }, // 700
    ]
    expect(repartirCostosExtra(lineas, 100, 'valor')).toEqual([30, 70])
  })

  it('por cantidad: respeta las cantidades, no el precio', () => {
    const lineas = [
      { cantidad: 1, precioFactura: 1000 },
      { cantidad: 3, precioFactura: 1 },
    ]
    expect(repartirCostosExtra(lineas, 100, 'cantidad')).toEqual([25, 75])
  })

  it('la suma repartida es exactamente el total aunque no divida exacto', () => {
    const lineas = [
      { cantidad: 1, precioFactura: 10 },
      { cantidad: 1, precioFactura: 10 },
      { cantidad: 1, precioFactura: 10 },
    ]
    const partes = repartirCostosExtra(lineas, 100, 'valor')
    expect(suma(partes)).toBe(100)
  })

  it('el centavo sobrante va a la línea de mayor valor', () => {
    const lineas = [
      { cantidad: 1, precioFactura: 1 },
      { cantidad: 1, precioFactura: 5 },
      { cantidad: 1, precioFactura: 1 },
    ]
    const partes = repartirCostosExtra(lineas, 0.1, 'valor') // 10 centavos entre 1:5:1
    expect(suma(partes)).toBe(0.1)
    expect(partes[1]).toBeGreaterThan(partes[0])
    expect(partes[1]).toBeGreaterThan(partes[2])
  })

  it('si todas las líneas valen cero, el reparto por valor sigue sumando el total', () => {
    const lineas = [
      { cantidad: 1, precioFactura: 0 },
      { cantidad: 3, precioFactura: 0 },
    ]
    const partes = repartirCostosExtra(lineas, 100, 'valor')
    expect(suma(partes)).toBe(100)
    expect(partes).toEqual([25, 75])
  })

  it('sin extras o sin líneas no reparte nada', () => {
    expect(repartirCostosExtra([{ cantidad: 1, precioFactura: 5 }], 0, 'valor')).toEqual([0])
    expect(repartirCostosExtra([], 100, 'valor')).toEqual([])
  })

  it('una línea se lleva todo', () => {
    expect(repartirCostosExtra([{ cantidad: 4, precioFactura: 10 }], 33.33, 'cantidad')).toEqual([33.33])
  })
})

describe('costoFinalUnitario', () => {
  it('es el precio de factura más el extra repartido entre la cantidad', () => {
    // 10 unidades a 50.000 con 30.000 de flete repartido → 53.000
    expect(costoFinalUnitario(50000, 10, 30000)).toBe(53000)
  })

  it('se redondea a dos decimales', () => {
    expect(costoFinalUnitario(100, 3, 10)).toBe(103.33)
  })

  it('un costo manual manda y no se recalcula', () => {
    expect(costoFinalUnitario(50000, 10, 30000, 51234.5)).toBe(51234.5)
    expect(costoFinalUnitario(50000, 10, 99999, 51234.5)).toBe(51234.5)
  })

  it('un costo manual de cero es válido; uno negativo se ignora', () => {
    expect(costoFinalUnitario(50, 10, 0, 0)).toBe(0)
    expect(costoFinalUnitario(50, 10, 0, -5)).toBe(50)
  })

  it('con cantidad no válida devuelve el precio de factura sin dividir por cero', () => {
    expect(costoFinalUnitario(50, 0, 10)).toBe(50)
  })
})

describe('camposACompletar', () => {
  it('llena solo lo que el producto tiene vacío', () => {
    const { completar, diferencias } = camposACompletar(
      { color: null, acabado: '', dimensiones: '60x60' },
      { color: 'Gris', acabado: 'Mate', dimensiones: '60x60' }
    )
    expect(completar).toEqual({ color: 'Gris', acabado: 'Mate' })
    expect(diferencias).toEqual([])
  })

  it('informa las diferencias y deja el valor del producto', () => {
    const { completar, diferencias } = camposACompletar(
      { color: 'Gris' },
      { color: 'Blanco' }
    )
    expect(completar).toEqual({})
    expect(diferencias).toEqual([{ campo: 'color', actual: 'Gris', escrito: 'Blanco' }])
  })

  it('no marca diferencia si solo cambian mayúsculas o espacios', () => {
    const { diferencias } = camposACompletar({ color: 'Gris' }, { color: ' gris ' })
    expect(diferencias).toEqual([])
  })

  it('un campo que la línea no trae no se completa ni difiere', () => {
    const { completar, diferencias } = camposACompletar({ color: null }, { color: '' })
    expect(completar).toEqual({})
    expect(diferencias).toEqual([])
  })

  it('compara los numéricos por valor y un cero no cuenta como dato', () => {
    const { completar, diferencias } = camposACompletar(
      { espesorMm: 8, m2PorCaja: 0, precioBodega: null },
      { espesorMm: '8', m2PorCaja: 1.44, precioBodega: 0 }
    )
    expect(completar).toEqual({ m2PorCaja: 1.44 })
    expect(diferencias).toEqual([])
  })

  it('no toca nombre, categoría, precio de venta ni stock mínimo', () => {
    const { completar, diferencias } = camposACompletar(
      { color: null },
      { color: 'Gris', nombre: 'Otro', categoria: 'Otra', precioUnitario: 1, stockMinimo: 9 } as never
    )
    expect(Object.keys(completar)).toEqual(['color'])
    expect(diferencias).toEqual([])
  })

  it('completa la imagen solo si el producto no tiene una', () => {
    expect(camposACompletar({ imagenUrl: null }, { imagenUrl: 'https://x/a.png' }).completar).toEqual({
      imagenUrl: 'https://x/a.png',
    })
    const conImagen = camposACompletar({ imagenUrl: 'https://x/a.png' }, { imagenUrl: 'https://x/b.png' })
    expect(conImagen.completar).toEqual({})
    expect(conImagen.diferencias).toHaveLength(1)
  })
})

describe('normalizarNombre', () => {
  it('quita tildes, pasa a minúsculas y junta espacios', () => {
    expect(normalizarNombre('  Cerámica   ÁCABADO  Mate ')).toBe('ceramica acabado mate')
  })
})

describe('nombresParecidos', () => {
  const catalogo = [
    { id: 'a', nombre: 'Porcelanato Marfil 60x60' },
    { id: 'b', nombre: 'Porcelanato Marfil 80x80' },
    { id: 'c', nombre: 'Baldosa Gris 60x60 Mate' },
    { id: 'd', nombre: 'Baldosa 2' },
    { id: 'e', nombre: 'Liston Dorado' },
  ]

  it('encuentra el mismo nombre con otras mayúsculas y tildes', () => {
    const r = nombresParecidos('PORCELANATO marfil 60X60', catalogo)
    expect(r.map((p) => p.id)).toContain('a')
  })

  it('encuentra un nombre contenido en otro', () => {
    expect(nombresParecidos('Baldosa Gris 60x60', catalogo).map((p) => p.id)).toEqual(['c'])
  })

  it('no confunde productos de una misma serie numerada', () => {
    // Una compra con "Baldosa 1", "Baldosa 2", ... no debe avisar entre sí.
    expect(nombresParecidos('Baldosa 1', catalogo)).toEqual([])
  })

  it('no confunde la misma línea en otra medida', () => {
    const r = nombresParecidos('Porcelanato Marfil 100x100', catalogo)
    expect(r).toEqual([])
  })

  it('respeta el límite y ordena del más parecido al menos', () => {
    const lista = [
      { nombre: 'Baldosa gris 60x60 brillante extra' },
      { nombre: 'Baldosa gris 60x60' },
      { nombre: 'Baldosa gris 60x60 mate' },
    ]
    const r = nombresParecidos('Baldosa gris 60x60', lista, 2)
    expect(r).toHaveLength(2)
    expect(r[0].nombre).toBe('Baldosa gris 60x60')
  })

  it('sin parecidos o con nombre vacío devuelve lista vacía', () => {
    expect(nombresParecidos('Cemento', catalogo)).toEqual([])
    expect(nombresParecidos('   ', catalogo)).toEqual([])
  })
})
