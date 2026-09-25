import { describe, it, expect } from 'vitest'
import { fechaYHora, soloFecha, soloHora } from '@/lib/fechas'

// Una factura del 24 de septiembre de 2026 a las 15:42 en Colombia.
const MOMENTO = new Date('2026-09-24T20:42:00.000Z')

describe('fechaYHora', () => {
  // Lo que motivó el cambio: con dos ventas al mismo cliente el mismo día,
  // el día solo no distingue una factura de otra.
  it('incluye el día y la hora', () => {
    const texto = fechaYHora(MOMENTO)

    expect(texto).toMatch(/24\/09\/2026/)
    expect(texto).toMatch(/\d{1,2}:\d{2}/)
  })

  it('acepta la fecha como cadena, que es como llega de la API', () => {
    expect(fechaYHora(MOMENTO.toISOString())).toBe(fechaYHora(MOMENTO))
  })

  it('el día va con dos dígitos, para que la columna no baile', () => {
    expect(fechaYHora(new Date('2026-01-05T15:00:00.000Z'))).toMatch(/^05\/01\/2026/)
  })
})

describe('soloFecha', () => {
  it('no lleva hora', () => {
    const texto = soloFecha(MOMENTO)

    expect(texto).toMatch(/24\/09\/2026/)
    expect(texto).not.toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('soloHora', () => {
  it('lleva hora y minuto, sin la fecha', () => {
    const texto = soloHora(MOMENTO)

    expect(texto).toMatch(/\d{1,2}:\d{2}/)
    expect(texto).not.toMatch(/2026/)
  })
})
