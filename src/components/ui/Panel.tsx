import { useId, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { aparecer } from '../../lib/movimiento'

type Props = {
  titulo: string
  /** Una frase que explica qué muestra la celda */
  descripcion?: string
  /** Controles o datos a la derecha del título */
  extra?: ReactNode
  className?: string
  /** Clases para el cuerpo (p. ej. scroll interno) */
  cuerpo?: string
  children: ReactNode
}

/**
 * Una celda del panel de control. Todas comparten cabecera (título en serif +
 * qué muestra), márgenes y animación de entrada; el contenido decide si
 * necesita scroll interno.
 *
 * El borde es una sombra de 1px (no un `border`): así dos celdas vecinas
 * comparten la misma línea en vez de sumar 2px.
 */
export function Panel({ titulo, descripcion, extra, className = '', cuerpo = '', children }: Props) {
  const id = useId()
  return (
    <motion.section
      variants={aparecer}
      aria-labelledby={id}
      className={`flex min-h-0 flex-col bg-fondo/90 shadow-[0_0_0_1px_var(--color-linea)] ${className}`}
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 id={id} className="font-serif text-2xl leading-none tracking-tight">
            {titulo}
          </h2>
          {descripcion && <p className="mt-1.5 text-xs text-tinta-suave">{descripcion}</p>}
        </div>
        {extra && <div className="shrink-0 pt-0.5">{extra}</div>}
      </header>
      <div className={`min-h-0 flex-1 px-5 pb-5 ${cuerpo}`}>{children}</div>
    </motion.section>
  )
}
