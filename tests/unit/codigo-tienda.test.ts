import { describe, it, expect } from 'vitest'
import {
  generarCodigo,
  normalizarCodigo,
  codigoValido,
  ALFABETO,
  LARGO_CODIGO,
} from '@/lib/codigo-tienda'

describe('alfabeto del código', () => {
  // Se dicta por teléfono o por WhatsApp: un cero y una O que se confundan
  // mandan a la persona a pedir acceso a la tienda equivocada.
  it('no incluye caracteres que se confundan al dictarlos', () => {
    for (const confuso of ['0', 'O', '1', 'I', 'L']) {
      expect(ALFABETO).not.toContain(confuso)
    }
  })

  it('tiene suficientes combinaciones para no agotarse', () => {
    expect(ALFABETO.length ** LARGO_CODIGO).toBeGreaterThan(100_000_000)
  })
})

describe('generarCodigo', () => {
  it('genera códigos del largo correcto y con el alfabeto correcto', () => {
    for (let i = 0; i < 200; i++) {
      const codigo = generarCodigo()
      expect(codigo).toHaveLength(LARGO_CODIGO)
      expect([...codigo].every((c) => ALFABETO.includes(c))).toBe(true)
    }
  })

  it('no repite en una tanda razonable', () => {
    const generados = new Set(Array.from({ length: 500 }, () => generarCodigo()))
    expect(generados.size).toBe(500)
  })
})

describe('normalizarCodigo', () => {
  // La gente lo escribe como se lo dictaron.
  it('acepta minúsculas, espacios y guiones', () => {
    expect(normalizarCodigo('ab3k9m')).toBe('AB3K9M')
    expect(normalizarCodigo('AB3 K9M')).toBe('AB3K9M')
    expect(normalizarCodigo(' ab3-k9m ')).toBe('AB3K9M')
  })
})

describe('codigoValido', () => {
  it('acepta un código bien formado, como sea que lo escriban', () => {
    expect(codigoValido('AB3K9M')).toBe(true)
    expect(codigoValido('ab3 k9m')).toBe(true)
  })

  it('rechaza largos distintos de seis', () => {
    expect(codigoValido('AB3K9')).toBe(false)
    expect(codigoValido('AB3K9MX')).toBe(false)
    expect(codigoValido('')).toBe(false)
  })

  it('rechaza los caracteres que no están en el alfabeto', () => {
    expect(codigoValido('AB3K90')).toBe(false) // el cero
    expect(codigoValido('AB3K9O')).toBe(false) // la letra O
    expect(codigoValido('AB3K9I')).toBe(false)
    expect(codigoValido('AB3K9!')).toBe(false)
  })

  it('da por bueno todo lo que genera', () => {
    for (let i = 0; i < 100; i++) {
      expect(codigoValido(generarCodigo())).toBe(true)
    }
  })
})
