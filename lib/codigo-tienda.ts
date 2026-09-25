/**
 * Código de tienda: seis caracteres que el dueño comparte para que le
 * pidan acceso.
 *
 * Existe para no tener que publicar un directorio con todos los negocios
 * registrados: sin el código no se puede pedir entrar a ninguna tienda.
 */

/**
 * Alfabeto sin los caracteres que se confunden al dictarlos por teléfono:
 * fuera el 0 y la O, el 1, la I y la L.
 *
 * Quedan 31 símbolos, o sea 31⁶ ≈ 887 millones de combinaciones. Probar
 * códigos al azar no lleva a ningún lado, y aun así la consulta va
 * limitada por IP.
 */
export const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export const LARGO_CODIGO = 6

/** Genera un código al azar. Quien lo use debe comprobar que no exista ya. */
export function generarCodigo(): string {
  let codigo = ''
  for (let i = 0; i < LARGO_CODIGO; i++) {
    codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)]
  }
  return codigo
}

/**
 * Deja el código como se guarda: mayúsculas y sin espacios ni guiones.
 *
 * La gente lo escribe como se lo dictaron —"ab3 k9m", "AB3-K9M"—, y todas
 * esas formas tienen que encontrar la misma tienda.
 */
export function normalizarCodigo(valor: string): string {
  return valor.trim().toUpperCase().replace(/[\s-]/g, '')
}

/** ¿Tiene la forma de un código? No dice que exista, solo que puede existir. */
export function codigoValido(valor: string): boolean {
  const limpio = normalizarCodigo(valor)
  if (limpio.length !== LARGO_CODIGO) return false

  return [...limpio].every((c) => ALFABETO.includes(c))
}
