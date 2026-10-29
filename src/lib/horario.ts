import type { Clase } from '../types'
import { horario } from './datos'
import { diaSemana, horaAMinutos, minutosDelDia, mismoDia, sumarDias } from './fechas'

/** Asignaturas que el usuario ha "apagado" porque no las cursa. */
export type Excluidas = ReadonlySet<string>
const NINGUNA: Excluidas = new Set()

export function clasesDelDia(dia: number, excluir: Excluidas = NINGUNA): Clase[] {
  return horario.clases
    .filter((c) => c.dia === dia && !excluir.has(c.asignatura))
    .sort((a, b) => horaAMinutos(a.inicio) - horaAMinutos(b.inicio))
}

export type ProximaClase = { clase: Clase; fecha: Date }

/** Busca la siguiente clase que empieza después de `ahora`, como mucho una semana adelante. */
export function proximaClase(ahora: Date, excluir: Excluidas = NINGUNA): ProximaClase | null {
  const min = minutosDelDia(ahora)
  for (let i = 0; i <= 7; i++) {
    const fecha = sumarDias(ahora, i)
    const clase = clasesDelDia(diaSemana(fecha), excluir).find((c) => i > 0 || horaAMinutos(c.inicio) > min)
    if (clase) return { clase, fecha }
  }
  return null
}

// Unión discriminada: según `tipo`, TypeScript sabe qué otros campos existen.
// Es parecido a una sealed interface con varios records en Java 17+.
export type EstadoAhora =
  | { tipo: 'clase'; clase: Clase; siguiente: Clase | null; progreso: number; restantes: number }
  | { tipo: 'recreo'; siguiente: ProximaClase | null; restantes: number }
  | { tipo: 'antes'; siguiente: ProximaClase; faltan: number }
  | { tipo: 'libre'; siguiente: ProximaClase | null }

export function estadoAhora(ahora: Date, excluir: Excluidas = NINGUNA): EstadoAhora {
  const min = minutosDelDia(ahora)
  const hoy = clasesDelDia(diaSemana(ahora), excluir)

  const i = hoy.findIndex((c) => horaAMinutos(c.inicio) <= min && min < horaAMinutos(c.fin))
  if (i !== -1) {
    const clase = hoy[i]
    const ini = horaAMinutos(clase.inicio)
    const fin = horaAMinutos(clase.fin)
    return {
      tipo: 'clase',
      clase,
      siguiente: hoy[i + 1] ?? null,
      progreso: (min - ini) / (fin - ini),
      restantes: fin - min,
    }
  }

  const siguiente = proximaClase(ahora, excluir)
  const rIni = horaAMinutos(horario.recreo.inicio)
  const rFin = horaAMinutos(horario.recreo.fin)
  if (hoy.length && rIni <= min && min < rFin) {
    return { tipo: 'recreo', siguiente, restantes: rFin - min }
  }

  // Hay una clase más tarde hoy: estamos antes de empezar (o en un hueco)
  if (siguiente && mismoDia(ahora, siguiente.fecha)) {
    return { tipo: 'antes', siguiente, faltan: horaAMinutos(siguiente.clase.inicio) - min }
  }

  return { tipo: 'libre', siguiente }
}

/** Todas las horas de inicio/fin del horario, ordenadas: son las "líneas" de la rejilla. */
export function franjas(): string[] {
  const horas = new Set<string>([horario.recreo.inicio, horario.recreo.fin])
  for (const c of horario.clases) {
    horas.add(c.inicio)
    horas.add(c.fin)
  }
  return [...horas].sort((a, b) => horaAMinutos(a) - horaAMinutos(b))
}
