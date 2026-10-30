import { useSyncExternalStore } from 'react'

export type Ruta = 'panel' | 'ajustes' | 'entrar' | 'crear'

// Cada ruta ↔ su hash en la URL (como un @RequestMapping, pero en el navegador)
const HASH: Record<Ruta, string> = { panel: '/', ajustes: '/ajustes', entrar: '/entrar', crear: '/crear' }

const suscribir = (avisar: () => void) => {
  window.addEventListener('hashchange', avisar)
  return () => window.removeEventListener('hashchange', avisar)
}
const leer = (): Ruta => {
  const encontrada = (Object.keys(HASH) as Ruta[]).find((r) => `#${HASH[r]}` === window.location.hash)
  return encontrada ?? 'panel'
}

/**
 * "Router" mínimo con el # de la URL: #/ajustes, #/entrar, #/crear → su
 * página; cualquier otra cosa → el panel. Así funcionan el botón atrás y los
 * enlaces directos sin instalar React Router.
 *
 * useSyncExternalStore es la forma oficial de leer en React un dato que vive
 * fuera de React (aquí, la URL) y re-renderizar cuando cambia.
 */
export function useRuta(): Ruta {
  return useSyncExternalStore(suscribir, leer)
}

export function irA(ruta: Ruta) {
  window.location.hash = HASH[ruta]
}
