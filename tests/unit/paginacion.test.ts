import { describe, it, expect } from 'vitest'
import { leerBusqueda, leerPagina, normalizarBusqueda, POR_PAGINA, MAXIMO_POR_PAGINA } from '@/lib/paginacion'

const params = (texto: string) => new URLSearchParams(texto)

describe('leerPagina', () => {
  it('sin nada, la primera página de 10', () => {
    expect(leerPagina(params(''))).toEqual({ limite: POR_PAGINA, desde: 0 })
  })

  it('respeta lo pedido', () => {
    expect(leerPagina(params('limite=10&desde=20'))).toEqual({ limite: 10, desde: 20 })
  })

  it('no deja pedir la tabla entera', () => {
    expect(leerPagina(params('limite=100000')).limite).toBe(MAXIMO_POR_PAGINA)
  })

  it('ignora valores inválidos o negativos', () => {
    expect(leerPagina(params('limite=abc&desde=-5'))).toEqual({ limite: POR_PAGINA, desde: 0 })
  })
})

describe('leerBusqueda', () => {
  it('menos de 3 letras no busca', () => {
    expect(leerBusqueda(params('busqueda=po'))).toBeNull()
    expect(leerBusqueda(params('busqueda=  po  '))).toBeNull()
  })

  it('sin tildes y en minúsculas, como la columna nombre_busqueda', () => {
    expect(leerBusqueda(params('busqueda=Cerámica'))).toBe('ceramica')
    expect(normalizarBusqueda('  PIÑA ')).toBe('pina')
  })

  it('sin parámetro no busca', () => {
    expect(leerBusqueda(params(''))).toBeNull()
  })
})
