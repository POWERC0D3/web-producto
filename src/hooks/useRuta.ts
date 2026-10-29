import { useSyncExternalStore } from 'react'

export type Ruta = 'panel' | 'ajustes'

const suscribir = (avisar: () => void) => {
  window.addEventListener('hashchange', avisar)
  return () => window.removeEventListener('hashchange', avisar)
}
const leer = (): Ruta => (window.location.hash === '#/ajustes' ? 'ajustes' : 'panel')

/**
 * "Router" mínimo con el # de la URL: #/ajustes → página de ajustes; cualquier
 * otra cosa → el panel. Así funcionan el botón atrás y los enlaces directos sin
 * instalar React Router.
 *
 * useSyncExternalStore es la forma oficial de leer en React un dato que vive
 * fuera de React (aquí, la URL) y re-renderizar cuando cambia.
 */
export function useRuta(): Ruta {
  return useSyncExternalStore(suscribir, leer)
}

export function irA(ruta: Ruta) {
  window.location.hash = ruta === 'ajustes' ? '/ajustes' : '/'
}
