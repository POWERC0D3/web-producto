import { AnimatePresence, motion } from 'motion/react'
import { EASE_SALIDA } from '../../lib/movimiento'

/** Mensaje flotante abajo en el centro (role="status": los lectores de pantalla lo leen). */
export function Aviso({ aviso }: { aviso: { texto: string; id: number } | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <AnimatePresence>
        {aviso && (
          <motion.p
            key={aviso.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.35, ease: EASE_SALIDA }}
            className="flex items-center gap-2.5 border border-linea bg-fondo-alto px-4 py-2.5 text-sm shadow-2xl shadow-black/60"
          >
            <span className="size-1.5 rounded-full bg-arena" aria-hidden="true" />
            {aviso.texto}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
