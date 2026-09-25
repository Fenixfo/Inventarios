/**
 * Formato de fechas de la aplicación.
 *
 * Las facturas se guardan con fecha y hora —la columna es `timestamptz`—,
 * pero al mostrarlas se perdía la hora. En un día con varias ventas al
 * mismo cliente, saber solo el día no alcanza para distinguirlas ni para
 * cuadrar la caja al cierre.
 *
 * Todo se muestra en la hora de Colombia, sin depender de dónde se mire.
 * Sin fijarla, cada quien veía una hora distinta: el navegador usa la del
 * dispositivo —que puede estar mal puesto o ser de otro país— y el servidor
 * de Vercel trabaja en UTC, así que el PDF salía cinco horas adelantado.
 *
 * `America/Bogota` y no un desfase fijo: es el nombre de la zona, y si
 * algún día cambiara la regla horaria, se ajusta sola.
 */

const ZONA = 'es-CO'
export const ZONA_HORARIA = 'America/Bogota'

/** Día y hora: `24/09/2026, 3:42 p. m.` */
export function fechaYHora(valor: string | Date): string {
  return new Date(valor).toLocaleString(ZONA, {
    timeZone: ZONA_HORARIA,
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
    timeZone: ZONA_HORARIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Solo la hora: `3:42 p. m.` */
export function soloHora(valor: string | Date): string {
  return new Date(valor).toLocaleTimeString(ZONA, {
    timeZone: ZONA_HORARIA,
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * El día al que pertenece una fecha en Colombia, como `2026-09-24`.
 *
 * Sirve para agrupar: una venta de las 8 de la noche es del día 24 aquí,
 * aunque en UTC ya sea el 25.
 */
export function diaColombiano(valor: string | Date): string {
  // en-CA da el formato año-mes-día, que además ordena bien como texto.
  return new Date(valor).toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA })
}
