import type { EventoConDias, Nivel } from '../types'
import { nombreAsignatura } from './datos'
import {
  diaSemana,
  diasEntre,
  formatoCorto,
  formatoDiaSemana,
  horaAMinutos,
  minutosDelDia,
  sumarDias,
  textoCuentaAtras,
  textoDuracion,
} from './fechas'
import { clasesDelDia, type Excluidas } from './horario'

/** Una línea de la agenda: a la izquierda "cuándo", a la derecha "qué". */
export type EntradaAgenda = {
  id: string
  cuando: string // "08:15", "Hoy", "lun 16"…
  texto: string
  detalle?: string
  nivel: Nivel
  asignatura?: string | null
  pasada?: boolean
}

export type BloqueAgenda = { titulo: string; entradas: EntradaAgenda[] }

const HORIZONTE = 21
const esPrueba = (e: EventoConDias) => e.tipo !== 'evaluacion'
const queEs = (e: EventoConDias) => `${e.tipo === 'entrega' ? 'Entrega' : 'Examen'} de ${nombreAsignatura(e.asignatura)}`

/** Varias pruebas el mismo día (en las próximas semanas). */
export function dobles(lista: EventoConDias[]): EventoConDias[][] {
  const porFecha = new Map<string, EventoConDias[]>()
  for (const e of lista) {
    if (!esPrueba(e) || e.dias < 0 || e.dias > HORIZONTE) continue
    porFecha.set(e.fecha, [...(porFecha.get(e.fecha) ?? []), e])
  }
  return [...porFecha.values()].filter((g) => g.length > 1)
}

/** La ventana de 8 días con más pruebas, si tiene 4 o más. */
export function bloqueCargado(lista: EventoConDias[]): EventoConDias[] | null {
  const pruebas = lista.filter((e) => esPrueba(e) && e.dias >= 0 && e.dias <= HORIZONTE)
  let mejor: EventoConDias[] = []
  for (const e of pruebas) {
    const ventana = pruebas.filter((o) => {
      const d = diasEntre(e.dia, o.dia)
      return d >= 0 && d < 8
    })
    if (ventana.length > mejor.length) mejor = ventana
  }
  return mejor.length >= 4 ? mejor : null
}

export type Carga = { en3: number; en7: number; diasEvaluacion: number | null }

/** Cuántas pruebas caen en los próximos 3 y 7 días, y cuánto falta para la sesión de evaluación. */
export function carga(lista: EventoConDias[]): Carga {
  const pruebas = lista.filter((e) => esPrueba(e) && e.dias >= 0)
  return {
    en3: pruebas.filter((e) => e.dias <= 3).length,
    en7: pruebas.filter((e) => e.dias <= 7).length,
    diasEvaluacion: lista.find((e) => e.tipo === 'evaluacion' && e.dias >= 0)?.dias ?? null,
  }
}

/**
 * La agenda: cruza el horario y el calendario y devuelve solo lo que necesitas
 * saber, por orden de tiempo. Cada bloque es una lista de "if" sencillos.
 */
export function agenda(ahora: Date, lista: EventoConDias[], excluir: Excluidas): BloqueAgenda[] {
  const min = minutosDelDia(ahora)
  const bloques: BloqueAgenda[] = []
  const pruebasDel = (dias: number) => lista.filter((e) => esPrueba(e) && e.dias === dias)
  // ¿Esta asignatura tiene una prueba en los próximos 7 días?
  const pruebaCerca = (id: string) => lista.find((e) => esPrueba(e) && e.asignatura === id && e.dias >= 1 && e.dias <= 7)

  // ── HOY ───────────────────────────────────────────────
  const hoy: EntradaAgenda[] = pruebasDel(0).map((e) => ({
    id: `hoy-${e.id}`,
    cuando: 'Hoy',
    texto: queEs(e),
    detalle: e.tipo === 'entrega' ? 'Comprueba que está subida antes de acabar el día.' : 'Repasa esquemas; hoy no toca temario nuevo.',
    nivel: 'urgente',
    asignatura: e.asignatura,
  }))
  const clasesHoy = clasesDelDia(diaSemana(ahora), excluir)
  for (const c of clasesHoy) {
    const ini = horaAMinutos(c.inicio)
    const fin = horaAMinutos(c.fin)
    const enCurso = ini <= min && min < fin
    const prueba = pruebaCerca(c.asignatura)
    hoy.push({
      id: `clase-${c.inicio}`,
      cuando: c.inicio,
      texto: nombreAsignatura(c.asignatura),
      detalle: enCurso
        ? `En curso · quedan ${textoDuracion(fin - min)}`
        : prueba && fin > min
          ? `Su ${prueba.tipo} es ${textoCuentaAtras(prueba.dias)}: aprovecha para preguntar dudas`
          : undefined,
      nivel: enCurso ? 'atencion' : 'info',
      asignatura: c.asignatura,
      pasada: fin <= min,
    })
  }
  if (!clasesHoy.length) hoy.push({ id: 'sin-clase', cuando: '—', texto: 'Sin clases hoy', nivel: 'info' })
  bloques.push({ titulo: 'Hoy', entradas: hoy })

  // ── MAÑANA ────────────────────────────────────────────
  const manana: EntradaAgenda[] = pruebasDel(1).map((e) => ({
    id: `manana-${e.id}`,
    cuando: 'Mañana',
    texto: queEs(e),
    detalle: e.tipo === 'entrega' ? 'Déjala entregada hoy y te olvidas.' : 'Repaso ligero esta tarde y a dormir pronto.',
    nivel: 'urgente',
    asignatura: e.asignatura,
  }))
  const clasesManana = clasesDelDia(diaSemana(sumarDias(ahora, 1)), excluir)
  manana.push(
    clasesManana.length
      ? {
          id: 'manana-clases',
          cuando: clasesManana[0].inicio,
          texto: `Empiezas con ${nombreAsignatura(clasesManana[0].asignatura)}`,
          detalle: `${clasesManana.length} clases · terminas a las ${clasesManana[clasesManana.length - 1].fin}`,
          nivel: 'info',
          asignatura: clasesManana[0].asignatura,
        }
      : { id: 'manana-libre', cuando: '—', texto: 'Sin clases', nivel: 'info' },
  )
  bloques.push({ titulo: 'Mañana', entradas: manana })

  // ── ESTA SEMANA (de pasado mañana a 7 días) ──────────────
  const semana = lista
    .filter((e) => esPrueba(e) && e.dias >= 2 && e.dias <= 7)
    .map<EntradaAgenda>((e) => ({
      id: `sem-${e.id}`,
      cuando: `${formatoDiaSemana(e.dia)} ${e.dia.getDate()}`,
      texto: queEs(e),
      detalle: e.detalle ? `${e.detalle} · ${textoCuentaAtras(e.dias)}` : textoCuentaAtras(e.dias),
      nivel: e.dias <= 3 ? 'atencion' : 'info',
      asignatura: e.asignatura,
    }))
  if (semana.length) bloques.push({ titulo: 'Esta semana', entradas: semana })

  // ── A TENER EN CUENTA ─────────────────────────────────
  const avisos: EntradaAgenda[] = dobles(lista).map((g) => ({
    id: `doble-${g[0].fecha}`,
    cuando: `${formatoDiaSemana(g[0].dia)} ${g[0].dia.getDate()}`,
    texto: `${g.length} pruebas el mismo día`,
    detalle: `${g.map((e) => e.asignatura).join(' y ')}: reparte el repaso en los días anteriores.`,
    nivel: 'atencion',
  }))
  const bloque = bloqueCargado(lista)
  if (bloque) {
    const ini = bloque[0]
    const fin = bloque[bloque.length - 1]
    avisos.push({
      id: 'bloque',
      cuando: `${formatoDiaSemana(ini.dia)} ${ini.dia.getDate()}`,
      texto: `Bloque cargado: ${bloque.length} pruebas en ${diasEntre(ini.dia, fin.dia) + 1} días`,
      detalle: `Del ${formatoCorto(ini.dia)} al ${formatoCorto(fin.dia)}. Empieza a adelantar antes de que llegue.`,
      nivel: ini.dias <= 7 ? 'urgente' : 'atencion',
    })
  }
  const evaluacion = lista.find((e) => e.tipo === 'evaluacion' && e.dias >= 0)
  if (evaluacion) {
    avisos.push({
      id: 'evaluacion',
      cuando: `${formatoDiaSemana(evaluacion.dia)} ${evaluacion.dia.getDate()}`,
      texto: 'Sesión de evaluación',
      detalle: `Cierre de notas ${textoCuentaAtras(evaluacion.dias)}`,
      nivel: 'info',
    })
  }
  if (avisos.length) bloques.push({ titulo: 'A tener en cuenta', entradas: avisos })

  return bloques
}
