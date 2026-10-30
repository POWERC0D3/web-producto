import type { Clase, Horario } from '../types'
import { asignaturas } from './datos'
import { horaAMinutos } from './fechas'

/** Asignaturas que el usuario ha "apagado" porque no las cursa. */
export type Excluidas = ReadonlySet<string>
const NINGUNA: Excluidas = new Set()

// Todas las funciones reciben el horario como parámetro (depende del grupo elegido)

export function clasesDelDia(horario: Horario, dia: number, excluir: Excluidas = NINGUNA): Clase[] {
  return horario.clases
    .filter((c) => c.dia === dia && !excluir.has(c.asignatura))
    .sort((a, b) => horaAMinutos(a.inicio) - horaAMinutos(b.inicio))
}

/** Todas las horas de inicio/fin del horario, ordenadas: son las "líneas" de la rejilla. */
export function franjas(horario: Horario): string[] {
  const horas = new Set<string>([horario.recreo.inicio, horario.recreo.fin])
  for (const c of horario.clases) {
    horas.add(c.inicio)
    horas.add(c.fin)
  }
  return [...horas].sort((a, b) => horaAMinutos(a) - horaAMinutos(b))
}

/** Los módulos que aparecen en un horario, en el orden del catálogo de asignaturas. */
export function modulosDe(horario: Horario): string[] {
  const enHorario = new Set(horario.clases.map((c) => c.asignatura))
  return asignaturas.map((a) => a.id).filter((id) => enHorario.has(id))
}
