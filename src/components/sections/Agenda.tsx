import type { CSSProperties } from 'react'
import { motion } from 'motion/react'
import type { EventoConDias, Nivel } from '../../types'
import { agenda, carga } from '../../lib/agenda'
import { colorAsignatura } from '../../lib/datos'
import type { Excluidas } from '../../lib/horario'
import { EASE_SALIDA } from '../../lib/movimiento'
import { Panel } from '../ui/Panel'

const estiloNivel: Record<Nivel, string> = {
  urgente: 'text-coral',
  atencion: 'text-arena',
  info: 'text-tinta',
}

type Props = { ahora: Date; lista: EventoConDias[]; excluidas: Excluidas; className?: string }

/** Lo que necesitas saber, por orden de tiempo, sacado del horario y del calendario. */
export function Agenda({ ahora, lista, excluidas, className = '' }: Props) {
  const bloques = agenda(ahora, lista, excluidas)
  const c = carga(lista)

  const resumen = [
    c.en3 ? `${c.en3} ${c.en3 === 1 ? 'prueba' : 'pruebas'} en 3 días` : 'Nada en 3 días',
    `${c.en7} en 7 días`,
    c.diasEvaluacion !== null ? `evaluación en ${c.diasEvaluacion} días` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Panel titulo="Agenda" descripcion={resumen} className={className} cuerpo="lg:overflow-y-auto">
      <motion.div
        className="space-y-5"
        initial="oculto"
        animate="visible"
        variants={{ oculto: {}, visible: { transition: { staggerChildren: 0.04, delayChildren: 0.3 } } }}
      >
        {bloques.map((b) => (
          <section key={b.titulo}>
            <h3 className="mb-1.5 font-serif text-lg leading-none">{b.titulo}</h3>
            <ol>
              {b.entradas.map((e) => (
                <motion.li
                  key={e.id}
                  variants={{ oculto: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_SALIDA } } }}
                  style={{ '--c': e.asignatura !== undefined ? colorAsignatura(e.asignatura) : 'transparent' } as CSSProperties}
                  className={`grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 border-b border-linea/60 py-2 last:border-0 ${e.pasada ? 'opacity-40' : ''}`}
                >
                  <span className="pt-px font-mono text-xs text-tinta-suave capitalize">{e.cuando}</span>
                  <span className="relative min-w-0 pl-3">
                    {/* Marca del color de la asignatura (si la entrada es de una) */}
                    <span className="absolute top-1 bottom-1 left-0 w-0.5 bg-(--c)" aria-hidden="true" />
                    <span className={`block text-sm leading-snug font-medium ${estiloNivel[e.nivel]}`}>{e.texto}</span>
                    {e.detalle && <span className="block text-xs leading-relaxed text-tinta-suave">{e.detalle}</span>}
                  </span>
                </motion.li>
              ))}
            </ol>
          </section>
        ))}
      </motion.div>
    </Panel>
  )
}
