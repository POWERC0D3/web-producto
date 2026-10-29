// Equivalen a los DTO / record de Java: solo describen la forma de los datos.

export type Asignatura = {
  id: string
  nombre: string
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
}

/** Un evento ya "calculado" respecto a hoy */
export type EventoConDias = Evento & {
  id: string
  dia: Date
  dias: number // días que faltan (negativo = ya pasó)
}

export type Nivel = 'urgente' | 'atencion' | 'info'
