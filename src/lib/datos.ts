import asignaturasJson from '../data/asignaturas.json'
import examenesJson from '../data/examenes.json'
import horarioJson from '../data/horario.json'
import type { Asignatura, Evento, Horario } from '../types'

// Único punto de entrada a los JSON. TypeScript infiere `tipo: string`,
// así que aquí afirmamos (`as`) que cumplen nuestros tipos más estrictos.
export const asignaturas = asignaturasJson as Asignatura[]
export const horario = horarioJson as Horario
export const eventos = examenesJson as Evento[]

const porId = new Map(asignaturas.map((a) => [a.id, a]))

export function nombreAsignatura(id: string | null): string {
  if (!id) return 'General'
  return porId.get(id)?.nombre ?? id
}

/**
 * Color de la asignatura como variable CSS (la evaluación usa el coral).
 * Se usa en `style`, no en clases: Tailwind no puede generar clases
 * construidas en tiempo de ejecución, pero una variable CSS sí funciona.
 */
export function colorAsignatura(id: string | null): string {
  return id && porId.has(id) ? `var(--color-asig-${id.toLowerCase()})` : 'var(--color-coral)'
}
