import { describe, it, expect } from 'vitest'
import { fechaYHora, soloFecha, soloHora, diaColombiano } from '@/lib/fechas'

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

// TASK-56. El servidor de Vercel corre en UTC y el navegador usa la hora del
// dispositivo; sin fijar la zona, la misma factura salía con horas distintas.
describe('hora de Colombia (UTC-5)', () => {
  it('muestra las 20:42 UTC como las 3:42 de la tarde', () => {
    expect(soloHora(MOMENTO)).toMatch(/3:42/)
    expect(fechaYHora(MOMENTO)).toMatch(/24\/09\/2026.*3:42/)
  })

  it('una venta de las 8 de la noche sigue siendo del mismo día', () => {
    // 2026-09-25T01:30Z ya es día 25 en UTC, pero aquí son las 8:30 p. m. del 24.
    const deNoche = new Date('2026-09-25T01:30:00.000Z')

    expect(soloFecha(deNoche)).toMatch(/24\/09\/2026/)
    expect(diaColombiano(deNoche)).toBe('2026-09-24')
  })
})

describe('diaColombiano', () => {
  it('devuelve año-mes-día, que ordena bien como texto', () => {
    expect(diaColombiano(MOMENTO)).toBe('2026-09-24')
  })
})
