/**
 * Convierte un monto en pesos a su forma escrita, como se exige en muchas
 * facturas físicas ("Son: Un millón doscientos mil pesos M/CTE").
 */

const UNIDADES = [
  '', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte',
]

const DECENAS = [
  '', '', 'veinti', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta',
  'ochenta', 'noventa',
]

const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
]

/** Convierte un número de 0 a 999. */
function trescientos(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'

  const c = Math.floor(n / 100)
  const resto = n % 100

  let texto = c > 0 ? CENTENAS[c] : ''

  if (resto > 0) {
    if (texto) texto += ' '

    if (resto <= 20) {
      texto += UNIDADES[resto]
    } else {
      const d = Math.floor(resto / 10)
      const u = resto % 10

      if (d === 2) {
        // "veinti" se pega a la unidad: veintiuno, veintidós...
        texto += u > 0 ? `${DECENAS[d]}${UNIDADES[u]}` : 'veinte'
      } else {
        texto += DECENAS[d] + (u > 0 ? ` y ${UNIDADES[u]}` : '')
      }
    }
  }

  return texto
}

/** Convierte un entero no negativo a palabras, en español. */
function enteroAPalabras(n: number): string {
  if (n === 0) return 'cero'

  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000

  const partes: string[] = []

  if (millones > 0) {
    partes.push(millones === 1 ? 'un millón' : `${trescientos(millones)} millones`)
  }

  if (miles > 0) {
    partes.push(miles === 1 ? 'mil' : `${trescientos(miles)} mil`)
  }

  if (resto > 0) {
    partes.push(trescientos(resto))
  }

  return partes.join(' ')
}

/**
 * Monto en pesos colombianos, en palabras y con mayúscula inicial.
 *
 * Los centavos no se manejan: las facturas de la tienda son en pesos
 * enteros, no en fracciones de peso.
 */
export function montoEnPalabras(valor: number | string): string {
  const monto = Math.round(Number(valor))
  const texto = enteroAPalabras(Math.abs(monto))
  const signo = monto < 0 ? 'menos ' : ''
  const capitalizado = signo + texto.charAt(0).toUpperCase() + texto.slice(1)

  return `${capitalizado} pesos M/CTE`
}
