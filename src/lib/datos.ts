import asignaturasJson from '../data/asignaturas.json'
import escolarJson from '../data/calendario-escolar.json'
import type { Asignatura, CalendarioEscolar } from '../types'

// Datos comunes a todos los grupos. El horario y los exámenes dependen del
// grupo y se piden a `datosDelGrupo` (lib/grupos.ts).
// TypeScript infiere `tipo: string` en los JSON, así que aquí afirmamos (`as`)
// que cumplen nuestros tipos más estrictos.
export const asignaturas = asignaturasJson as Asignatura[]
export const calendarioEscolar = escolarJson as CalendarioEscolar

const porId = new Map(asignaturas.map((a) => [a.id, a]))

export function nombreAsignatura(id: string | null): string {
  if (!id) return 'General'
  return porId.get(id)?.nombre ?? id
}

/** El nombre oficial (largo), para los tooltips. */
export function nombreCompleto(id: string | null): string {
  return (id && porId.get(id)?.completo) || nombreAsignatura(id)
}

/**
 * Color de la asignatura como variable CSS (la evaluación usa el coral).
 * Se usa en `style`, no en clases: Tailwind no puede generar clases
 * construidas en tiempo de ejecución, pero una variable CSS sí funciona.
 */
export function colorAsignatura(id: string | null): string {
  return id && porId.has(id) ? `var(--color-asig-${id.toLowerCase()})` : 'var(--color-coral)'
}
