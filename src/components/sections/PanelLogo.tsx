import type { Ruta } from '../../hooks/useRuta'
import { URL_CENTRO } from '../../lib/config'
import { Logo3D, type ZonaLogo } from '../ui/Logo3D'
import { Panel } from '../ui/Panel'

// Zonas del logo, en píxeles de la imagen original (medidas sobre src/assets/logo-ies.jpg).
// Fuera del componente: es una constante y Logo3D no tiene que reiniciarse en cada render.
const ZONAS: ZonaLogo[] = [
  { id: 'crear', etiqueta: 'Registro', poligono: [[99, 23], [128, 49], [70, 49]] }, // tejado
  { id: 'entrar', etiqueta: 'Iniciar sesión', poligono: [[74, 49], [126, 49], [126, 107], [74, 107]] }, // puerta central
  { id: 'ajustes', etiqueta: 'Ajustes', poligono: [[129, 49], [171, 49], [171, 114], [129, 114]] }, // puerta derecha
  { id: 'web', etiqueta: 'Web del instituto ↗', poligono: [[29, 49], [71, 49], [71, 114], [29, 114]] }, // puerta izquierda
]

type Props = {
  onNavegar: (ruta: Ruta, centro: { x: number; y: number }) => void
  className?: string
}

/** Celda del logo: cada parte del edificio lleva a un sitio distinto. */
export function PanelLogo({ onNavegar, className = '' }: Props) {
  const alPulsar = (id: string, centro: { x: number; y: number }) => {
    if (id === 'web') window.open(URL_CENTRO, '_blank', 'noopener,noreferrer')
    else onNavegar(id as Ruta, centro)
  }

  return (
    <Panel
      etiqueta="Accesos: registro, inicio de sesión, ajustes y web del instituto"
      className={`h-64 bg-transparent! sm:h-80 lg:h-auto ${className}`}
      fondo={<Logo3D zonas={ZONAS} onZona={alPulsar} className="size-full" />}
    />
  )
}
