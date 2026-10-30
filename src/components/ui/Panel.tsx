import { useId, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { aparecer } from '../../lib/movimiento'

type Props = {
  /** Sin título, la celda no tiene cabecera (y usa `etiqueta` como nombre accesible) */
  titulo?: string
  etiqueta?: string
  /** Qué hace la celda: aparece al dejar el ratón (o el foco) un momento sobre el título */
  ayuda?: string
  /** Controles o datos a la derecha del título */
  extra?: ReactNode
  /** Capa que ocupa TODA la celda por detrás de la cabecera (p. ej. el logo) */
  fondo?: ReactNode
  className?: string
  /** Clases para el cuerpo (p. ej. scroll interno) */
  cuerpo?: string
  children?: ReactNode
}

/**
 * Una celda del panel de control. Todas comparten cabecera, márgenes y
 * animación de entrada; el contenido decide si necesita scroll interno.
 *
 * El borde es una sombra de 1px (no un `border`): así dos celdas vecinas
 * comparten la misma línea en vez de sumar 2px.
 */
export function Panel({ titulo, etiqueta, ayuda, extra, fondo, className = '', cuerpo = '', children }: Props) {
  const id = useId()
  return (
    <motion.section
      variants={aparecer}
      aria-labelledby={titulo ? `${id}-t` : undefined}
      aria-label={titulo ? undefined : etiqueta}
      className={`relative flex min-h-0 flex-col bg-fondo/90 shadow-[0_0_0_1px_var(--color-linea)] ${className}`}
    >
      {fondo && <div className="absolute inset-0">{fondo}</div>}

      {/* Con fondo, la cabecera deja pasar el ratón (al logo) salvo en el propio título */}
      {titulo && (
        <header
          className={`relative z-20 flex items-start justify-between gap-3 px-5 pt-4 pb-3 ${fondo ? 'pointer-events-none' : ''}`}
        >
          <div className="group/ayuda pointer-events-auto relative min-w-0">
            <h2
              id={`${id}-t`}
              tabIndex={ayuda ? 0 : undefined}
              aria-describedby={ayuda ? `${id}-a` : undefined}
              className={`font-titulo text-xl leading-none font-bold tracking-tight ${ayuda ? 'cursor-help' : ''}`}
            >
              {titulo}
            </h2>
            {/* Tooltip: invisible por defecto; aparece tras medio segundo de hover y al instante con el teclado */}
            {ayuda && (
              <p
                id={`${id}-a`}
                role="tooltip"
                className="invisible absolute top-full left-0 mt-2 w-72 max-w-[80vw] border border-linea bg-fondo-alto px-3 py-2 text-xs leading-relaxed text-tinta-suave opacity-0 shadow-2xl shadow-black/60 transition-[opacity,visibility] duration-200 group-focus-within/ayuda:visible group-focus-within/ayuda:opacity-100 group-hover/ayuda:visible group-hover/ayuda:opacity-100 group-hover/ayuda:delay-500"
              >
                {ayuda}
              </p>
            )}
          </div>
          {extra && <div className="pointer-events-auto shrink-0 pt-0.5">{extra}</div>}
        </header>
      )}
      {children && <div className={`relative min-h-0 flex-1 px-5 pb-5 ${cuerpo}`}>{children}</div>}
    </motion.section>
  )
}
