import type { Clase, EntradaEscolar, Horario, TipoDiaEscolar } from '../types'
import { calendarioEscolar as cal } from './datos'
import { diaSemana, diasEntre, horaAMinutos, inicioDelDia, isoLocal, parseFecha, sumarDias } from './fechas'
import { clasesDelDia, type Excluidas } from './horario'

// Límites del curso: la lupa del horario no navega fuera de ellos
export const INICIO = parseFecha(cal.inicioClases)
export const FIN = parseFecha(cal.finClases)

// Índice "YYYY-MM-DD" → qué pasa ese día. Las vacaciones se expanden día a día,
// así cada consulta es un simple get (como un HashMap<LocalDate, …> en Java).
// Solo las fechas con una explicación real llevan `url`; las demás, como mucho, un `motivo` en texto
type InfoDia = { tipo: TipoDiaEscolar; nombre: string; motivo?: string; url?: string }

const sinClase = new Map<string, InfoDia>()
for (const v of cal.vacaciones) {
  for (let d = parseFecha(v.inicio); d <= parseFecha(v.fin); d = sumarDias(d, 1)) {
    sinClase.set(isoLocal(d), { tipo: 'vacaciones', nombre: v.nombre, url: v.url })
  }
}
for (const d of cal.dias) sinClase.set(d.fecha, { tipo: d.tipo, nombre: d.nombre, motivo: d.motivo, url: d.url })

/** Qué tiene de especial un día en el calendario escolar (null si es un día normal). */
export function infoDia(fecha: Date): InfoDia | null {
  const clave = isoLocal(fecha)
  if (clave === cal.inicioClases) return { tipo: 'inicio', nombre: 'Inicio de las clases' }
  if (clave === cal.finClases) return { tipo: 'fin', nombre: 'Fin de las clases' }
  return sinClase.get(clave) ?? null
}

/** Hay clase: de lunes a viernes, dentro del curso y sin festivo, día no lectivo ni vacaciones. */
export function esLectivo(fecha: Date): boolean {
  const d = inicioDelDia(fecha)
  return diaSemana(d) <= 5 && d >= INICIO && d <= FIN && !sinClase.has(isoLocal(d))
}

/** Las clases de ese día teniendo en cuenta el calendario escolar (vacío si no es lectivo). */
export function clasesDeLaFecha(horario: Horario, fecha: Date, excluir?: Excluidas): Clase[] {
  return esLectivo(fecha) ? clasesDelDia(horario, diaSemana(fecha), excluir) : []
}

/** La siguiente clase que EMPIEZA después de `ahora`, saltándose festivos y vacaciones. */
export function proximaClase(horario: Horario, ahora: Date, excluir?: Excluidas): { clase: Clase; inicio: Date } | null {
  // 60 días de margen cubren las vacaciones más largas del curso (Navidad: 19 días)
  for (let i = 0; i <= 60; i++) {
    const fecha = sumarDias(ahora, i)
    for (const clase of clasesDeLaFecha(horario, fecha, excluir)) {
      const inicio = new Date(fecha)
      inicio.setMinutes(horaAMinutos(clase.inicio))
      if (inicio > ahora) return { clase, inicio }
    }
  }
  return null // verano o todo apagado
}

/** Fechas señaladas del curso (festivos, puentes, vacaciones…) que aún no han terminado. */
export function entradasEscolares(ahora: Date): EntradaEscolar[] {
  const lista: Omit<EntradaEscolar, 'dias'>[] = [
    ...cal.dias.map((d) => ({ id: d.fecha, tipo: d.tipo, nombre: d.nombre, motivo: d.motivo, inicio: parseFecha(d.fecha), fin: parseFecha(d.fecha), url: d.url })),
    ...cal.vacaciones.map((v) => ({ id: v.inicio, tipo: 'vacaciones' as const, nombre: v.nombre, inicio: parseFecha(v.inicio), fin: parseFecha(v.fin), url: v.url })),
    { id: 'inicio', tipo: 'inicio' as const, nombre: 'Inicio de las clases', inicio: INICIO, fin: INICIO },
    { id: 'fin', tipo: 'fin' as const, nombre: 'Fin de las clases', inicio: FIN, fin: FIN },
  ]
  return lista
    .map((e) => ({ ...e, dias: diasEntre(ahora, e.inicio) }))
    .filter((e) => diasEntre(ahora, e.fin) >= 0) // sin registro del pasado
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
}
