import { AnimatePresence, motion } from 'motion/react'
import { EASE_SALIDA } from '../../lib/movimiento'

/** Un dígito en su "ventanita": al cambiar, el nuevo sube desde abajo y el viejo sale por arriba. */
function Digito({ d }: { d: string }) {
  return (
    <span className="relative inline-block h-[1.25em] w-[1ch] overflow-hidden align-bottom">
      <AnimatePresence initial={false}>
        <motion.span
          key={d}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.35, ease: EASE_SALIDA }}
          className="absolute inset-0 text-center"
        >
          {d}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/**
 * Texto con efecto cuentakilómetros: los números ruedan, el resto queda fijo.
 * Usa fuente monoespaciada (todas las cifras miden 1ch), así nada "baila" al cambiar.
 * El texto real va en `sr-only` y sin aria-live: no se anuncia cada segundo.
 */
export function Odometro({ texto, className = '' }: { texto: string; className?: string }) {
  return (
    <span className={className}>
      <span className="sr-only">{texto}</span>
      <span aria-hidden="true" className="inline-flex whitespace-pre">
        {[...texto].map((c, i) => (/\d/.test(c) ? <Digito key={i} d={c} /> : <span key={i}>{c}</span>))}
      </span>
    </span>
  )
}
