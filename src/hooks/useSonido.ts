import { useSyncExternalStore } from 'react'
import { leerConfigSonido, suscribirConfig } from '../lib/sonido'

/** Preferencias de sonido (activo y volumen) como estado de React: se re-renderiza cuando cambian. */
export function useSonido() {
  return useSyncExternalStore(suscribirConfig, leerConfigSonido)
}
