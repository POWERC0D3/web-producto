import { useEffect } from 'react'
import { useReducedMotion } from 'motion/react'
import { irA } from '../../hooks/useRuta'
import { sonar } from '../../lib/sonido'
import { LogoMarca } from '../ui/LogoMarca'
import { ScrollTrigger } from '../../lib/gsap'
import type { ModoCuenta } from './Acceso'
import { Hero } from './Hero'

type Props = {
  modo: ModoCuenta
  onVolver: (centro: { x: number; y: number }) => void
  avisar: (texto: string) => void
}

/**
 * La puerta de entrada: una landing de marketing que explica la idea de la web
 * (todo tu curso en un sitio) y termina en el formulario de cuenta.
 * Mismo estilo que el panel, pero otro registro: tipografía enorme, aire y scroll.
 */
export function Landing({ modo, onVolver, avisar }: Props) {
  const reducido = useReducedMotion()

  // Al llegar desde el panel, empezar arriba del todo
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  /** Baja hasta el formulario con la pestaña indicada ya elegida. */
  const irAlAcceso = (destino: ModoCuenta) => {
    sonar('button')
    irA(destino)
    // Con la escena animada, el formulario está "al final" del scroll fijado: se salta a ese punto.
    // Sin escena (movimiento reducido), el formulario es un elemento normal de la página
    const escena = ScrollTrigger.getById('hero')
    if (escena) window.scrollTo({ top: escena.end, behavior: 'smooth' })
    else document.getElementById('acceso')?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'center' })
  }

  return (
    <div className="relative">
      {/* Barra fija y discreta: la marca a la izquierda, salir o entrar a la derecha */}
      <nav className="fixed inset-x-0 top-0 z-40 border-b border-linea/60 bg-fondo/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <span className="flex items-center gap-2.5">
            <LogoMarca className="h-6 w-auto" />
            <span className="font-titulo text-sm font-bold tracking-tight">IES Agenda Digital</span>
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                onVolver({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
              }}
              className="hidden px-3 py-1.5 text-sm text-tinta-suave transition-colors hover:text-tinta sm:block"
            >
              ← Volver al panel
            </button>
            <button
              type="button"
              onClick={() => irAlAcceso('entrar')}
              className="border border-linea px-3.5 py-1.5 text-sm transition-colors hover:border-arena hover:text-arena"
            >
              Entrar
            </button>
          </span>
        </div>
      </nav>

      <main>
        <Hero modo={modo} avisar={avisar} />
      </main>
    </div>
  )
}
