import type { Evento, Horario } from '../types'
import daw1aExamenes from '../data/grupos/daw1a/examenes.json'
import daw1aHorario from '../data/grupos/daw1a/horario.json'

export const CICLOS = ['DAW', 'DAM'] as const
export const CURSOS = ['1º', '2º'] as const
export const LETRAS = ['A', 'B'] as const

/** Tu grupo: ciclo + curso + letra (p. ej. DAW · 1º · A). */
export type Grupo = { ciclo: (typeof CICLOS)[number]; curso: (typeof CURSOS)[number]; letra: (typeof LETRAS)[number] }

export const GRUPO_INICIAL: Grupo = { ciclo: 'DAW', curso: '1º', letra: 'A' }

export const idGrupo = (g: Grupo) => `${g.ciclo}${g.curso.charAt(0)}${g.letra}`.toLowerCase() // "daw1a"
export const nombreGrupo = (g: Grupo) => `${g.ciclo} ${g.curso} ${g.letra}`

export type DatosGrupo = { horario: Horario; eventos: Evento[] }

// De momento los datos viven en el propio proyecto y solo hay los de DAW 1º A.
// TypeScript infiere `tipo: string` en los JSON: por eso el `as`.
const DISPONIBLES: Record<string, DatosGrupo> = {
  daw1a: { horario: daw1aHorario as Horario, eventos: daw1aExamenes as Evento[] },
}

/**
 * Horario y exámenes de un grupo, o null si aún no los tenemos.
 * Es el único punto de acceso a esos datos (como un repositorio en Java): el
 * día que haya backend, esta función hará el `fetch` y el resto de la app no cambia.
 */
export function datosDelGrupo(g: Grupo): DatosGrupo | null {
  return DISPONIBLES[idGrupo(g)] ?? null
}
