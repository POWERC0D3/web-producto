// Equivalen a los DTO / record de Java: solo describen la forma de los datos.

export type Asignatura = {
  id: string
  nombre: string // corto (máx. ~3 palabras): es el que se lee en toda la interfaz
  completo?: string // el oficial, si es más largo: solo en los tooltips
}

/** 1 = lunes … 5 = viernes (como DayOfWeek de Java, pero sin finde) */
export type DiaLectivo = 1 | 2 | 3 | 4 | 5

export type Clase = {
  dia: DiaLectivo
  asignatura: string
  inicio: string // "HH:MM"
  fin: string
  aula?: string // opcional: el horario aún no la tiene
}

export type Horario = {
  recreo: { inicio: string; fin: string }
  clases: Clase[]
}

export type TipoEvento = 'examen' | 'entrega' | 'evaluacion'

export type Evento = {
  fecha: string // "YYYY-MM-DD"
  asignatura: string | null
  tipo: TipoEvento
  detalle?: string
  /** Actividad o apuntes de esta prueba (futuro backend); si falta, la web del centro */
  url?: string
}

/** Un evento ya "calculado" respecto a hoy */
export type EventoConDias = Evento & {
  id: string
  dia: Date
  dias: number // días que faltan (negativo = ya pasó)
}

/** Calendario escolar oficial (días sin clase del curso) */
export type CalendarioEscolar = {
  curso: string
  inicioClases: string // "YYYY-MM-DD"
  finClases: string
  // url: solo si hay una explicación real del día; motivo: texto deducido cuando no la hay
  dias: { fecha: string; tipo: 'festivo' | 'no-lectivo'; nombre: string; motivo?: string; url?: string }[]
  vacaciones: { inicio: string; fin: string; nombre: string; url?: string }[]
}

export type TipoDiaEscolar = 'festivo' | 'no-lectivo' | 'vacaciones' | 'inicio' | 'fin'

/** Una fecha señalada del calendario escolar, ya calculada respecto a hoy (como EventoConDias) */
export type EntradaEscolar = {
  id: string
  tipo: TipoDiaEscolar
  nombre: string
  inicio: Date
  fin: Date // igual que `inicio` si es un solo día
  dias: number // días hasta `inicio` (negativo si ya empezó)
  motivo?: string // por qué no hay clase, cuando se sabe pero no hay web que lo explique
  url?: string // web que explica ese día (si la hay)
}
