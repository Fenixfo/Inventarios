/**
 * Formato de fechas de la aplicación.
 *
 * Las facturas se guardan con fecha y hora —la columna es `timestamptz`—,
 * pero al mostrarlas se perdía la hora. En un día con varias ventas al
 * mismo cliente, saber solo el día no alcanza para distinguirlas ni para
 * cuadrar la caja al cierre.
 */

const ZONA = 'es-CO'

/** Día y hora: `24/09/2026, 3:42 p. m.` */
export function fechaYHora(valor: string | Date): string {
  return new Date(valor).toLocaleString(ZONA, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Solo el día, para cuando la hora no aporta. */
export function soloFecha(valor: string | Date): string {
  return new Date(valor).toLocaleDateString(ZONA, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Solo la hora: `3:42 p. m.` */
export function soloHora(valor: string | Date): string {
  return new Date(valor).toLocaleTimeString(ZONA, {
    hour: '2-digit',
    minute: '2-digit',
  })
}
