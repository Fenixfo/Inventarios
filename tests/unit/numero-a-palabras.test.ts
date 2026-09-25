import { describe, it, expect } from 'vitest'
import { montoEnPalabras } from '@/lib/numero-a-palabras'

describe('montoEnPalabras', () => {
  it('convierte cero', () => {
    expect(montoEnPalabras(0)).toBe('Cero pesos M/CTE')
  })

  it('convierte unidades y decenas', () => {
    expect(montoEnPalabras(21)).toBe('Veintiun pesos M/CTE')
    expect(montoEnPalabras(45)).toBe('Cuarenta y cinco pesos M/CTE')
  })

  it('convierte miles', () => {
    expect(montoEnPalabras(1000)).toBe('Mil pesos M/CTE')
    expect(montoEnPalabras(50000)).toBe('Cincuenta mil pesos M/CTE')
  })

  it('convierte un ejemplo típico de factura', () => {
    // 1.245.000 -> un millón doscientos cuarenta y cinco mil
    expect(montoEnPalabras(1_245_000)).toBe(
      'Un millón doscientos cuarenta y cinco mil pesos M/CTE'
    )
  })

  it('convierte cien exacto sin "ciento"', () => {
    expect(montoEnPalabras(100)).toBe('Cien pesos M/CTE')
  })

  it('convierte cientos', () => {
    expect(montoEnPalabras(350000)).toBe('Trescientos cincuenta mil pesos M/CTE')
  })

  it('redondea decimales, porque no se manejan centavos', () => {
    expect(montoEnPalabras(1999.6)).toBe(montoEnPalabras(2000))
  })

  it('acepta el valor como cadena, que es como llega de la API', () => {
    expect(montoEnPalabras('75000')).toBe(montoEnPalabras(75000))
  })
})
