const MS_DIA = 24 * 60 * 60 * 1000

/**
 * "2026-11-13" → Date a las 00:00 HORA LOCAL.
 * Ojo: `new Date("2026-11-13")` la interpretaría como UTC y en España
 * podría caer en el día anterior.
 */
export function parseFecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Date → "2026-11-13" en hora local (la inversa de parseFecha) */
export function isoLocal(fecha: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`
}

export function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
}

export function sumarDias(fecha: Date, n: number): Date {
  const r = inicioDelDia(fecha)
  r.setDate(r.getDate() + n)
  return r
}

/** El lunes de la semana de `fecha` (a las 00:00). */
export function lunesDe(fecha: Date): Date {
  return sumarDias(fecha, 1 - diaSemana(fecha))
}

/** Fecha del día `dia` (1 = lunes … 5 = viernes) de esta semana; en fin de semana, de la que viene. */
export function fechaDeLaSemana(ahora: Date, dia: number): Date {
  const hoy = diaSemana(ahora)
  const lunes = sumarDias(ahora, hoy <= 5 ? 1 - hoy : 8 - hoy)
  return sumarDias(lunes, dia - 1)
}

/** Días naturales entre dos fechas. Math.round absorbe el cambio de hora. */
export function diasEntre(desde: Date, hasta: Date): number {
  return Math.round((inicioDelDia(hasta).getTime() - inicioDelDia(desde).getTime()) / MS_DIA)
}

export function mismoDia(a: Date, b: Date): boolean {
  return diasEntre(a, b) === 0
}

/** "08:15" → 495 (minutos desde medianoche) */
export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export function minutosDelDia(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes()
}

/** 1 = lunes … 7 = domingo (getDay() empieza en domingo = 0) */
export function diaSemana(fecha: Date): number {
  return fecha.getDay() === 0 ? 7 : fecha.getDay()
}

const fmtLargo = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtCorto = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtDiaSemana = new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
const fmtMes = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })

export const formatoLargo = (f: Date) => fmtLargo.format(f)
export const formatoCorto = (f: Date) => fmtCorto.format(f).replace(/\./g, '')
export const formatoDiaSemana = (f: Date) => fmtDiaSemana.format(f).replace('.', '')
export const formatoMes = (f: Date) => fmtMes.format(f)

export function textoCuentaAtras(dias: number): string {
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  if (dias === -1) return 'ayer'
  if (dias < 0) return `hace ${-dias} días`
  return `en ${dias} días`
}

export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

export const NOMBRES_DIA =['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
