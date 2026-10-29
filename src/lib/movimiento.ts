import type { Variants } from 'motion/react'

// Misma curva que --ease-salida en index.css: un solo sitio de verdad por idioma.
export const EASE_SALIDA = [0.22, 1, 0.36, 1] as const

/** Contenedor que reparte la entrada de sus hijos en cascada (stagger). */
export const cascada: Variants = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.07 } },
}

/** Hijo de una cascada: sube un poco y aparece. */
export const aparecer: Variants = {
  oculto: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_SALIDA } },
}
