'use client'

import { useEffect, useEffectEvent } from 'react'

/**
 * Teclado y scroll de un pop-up del catálogo mientras está en pantalla.
 *
 * Bloquea el scroll del fondo y pasa cada tecla a `alPulsar`. El pop-up solo
 * se monta cuando está abierto, así que basta con engancharse al montarlo.
 * `useEffectEvent` hace que `alPulsar` lea siempre los valores actuales (la
 * cantidad escrita, por ejemplo) sin volver a registrar el listener.
 */
export function useTeclasDialogo(alPulsar: (tecla: string) => void) {
  const onTecla = useEffectEvent(alPulsar)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => onTecla(e.key)

    document.addEventListener('keydown', onKeyDown)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflowPrevio
    }
  }, [])
}
