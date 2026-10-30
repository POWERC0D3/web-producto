import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { EntradaEscolar, EventoConDias, TipoDiaEscolar, TipoEvento } from '../../types'
import { colorAsignatura, nombreAsignatura } from '../../lib/datos'
import { entradasEscolares, FIN, infoDia, INICIO } from '../../lib/escolar'
import { agruparPorSemana, proximoEvento, urlDe } from '../../lib/eventos'
import { diasEntre, formatoCorto, formatoDiaSemana, formatoMes, isoLocal, mismoDia, textoCuentaAtras } from '../../lib/fechas'
import { EASE_SALIDA } from '../../lib/movimiento'
import { sonar } from '../../lib/sonido'
import { CuentaAtras } from '../ui/CuentaAtras'
import { EnlaceExterno } from '../ui/EnlaceExterno'
import { Panel } from '../ui/Panel'
import { SinDatos } from '../ui/SinDatos'

type Modo = 'examenes' | 'escolar'
type Filtro = 'todos' | TipoEvento

const MODOS: { valor: Modo; texto: string }[] = [
  { valor: 'examenes', texto: 'Exámenes' },
  { valor: 'escolar', texto: 'Escolar' },
]

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: 'todos', texto: 'Todo' },
  { valor: 'examen', texto: 'Solo exámenes' },
  { valor: 'entrega', texto: 'Solo entregas' },
]

const TIPO: Record<TipoEvento, string> = { examen: 'Examen', entrega: 'Entrega', evaluacion: 'Evaluación' }

// Mismos colores que el calendario oficial (amarillo, rosa, verde), pasados a la paleta del panel
const ESCOLAR: Record<TipoDiaEscolar, { texto: string; celda: string; barra: string }> = {
  vacaciones: { texto: 'Vacaciones', celda: 'bg-arena/15 text-arena', barra: 'bg-arena' },
  festivo: { texto: 'Festivo', celda: 'bg-coral/20 text-coral', barra: 'bg-coral' },
  'no-lectivo': { texto: 'No lectivo', celda: 'bg-verde/45 text-tinta', barra: 'bg-verde' },
  inicio: { texto: 'Curso', celda: 'border-tinta/50! text-tinta', barra: 'bg-tinta' },
  fin: { texto: 'Curso', celda: 'border-tinta/50! text-tinta', barra: 'bg-tinta' },
}

const conColor = (id: string | null) => ({ '--c': colorAsignatura(id) }) as CSSProperties

/** Qué pinta y qué hace cada casilla del mes (lo decide cada modo). */
type Celda = { contenido?: ReactNode; clase?: string; titulo?: string; alPulsar?: () => void; resaltada?: boolean }

/** Cuadrícula de un mes. El contenido de cada casilla llega desde fuera (`celda`). */
function Mes({
  ahora,
  anio,
  mes,
  celda,
  onHover,
}: {
  ahora: Date
  anio: number
  mes: number
  celda: (dia: Date) => Celda
  onHover?: (fecha: string | null) => void
}) {
  const diasMes = new Date(anio, mes + 1, 0).getDate()
  const hueco = (new Date(anio, mes, 1).getDay() + 6) % 7 // lunes = 0
  const dias = Array.from({ length: diasMes }, (_, i) => new Date(anio, mes, i + 1))

  return (
    <div className="grid h-full min-h-[18rem] grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-1 lg:min-h-0">
      {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
        <span key={d} className="pb-1 text-center text-[0.7rem] text-tinta-suave">
          {d}
        </span>
      ))}
      {hueco > 0 && <span style={{ gridColumn: `span ${hueco}` }} />}
      {dias.map((dia) => {
        const fecha = isoLocal(dia)
        const c = celda(dia)
        const hoy = mismoDia(dia, ahora)
        const finde = dia.getDay() === 0 || dia.getDay() === 6
        return (
          <div
            key={fecha}
            title={c.titulo}
            onClick={c.alPulsar}
            onMouseEnter={() => onHover?.(fecha)}
            onMouseLeave={() => onHover?.(null)}
            className={`flex min-h-0 flex-col gap-0.5 overflow-hidden border p-1 transition-colors ${
              hoy ? 'border-arena' : c.resaltada ? 'border-tinta/40 bg-fondo-alto' : 'border-linea/60'
            } ${diasEntre(ahora, dia) < 0 ? 'opacity-40' : ''} ${c.alPulsar ? 'cursor-pointer hover:border-tinta/40' : ''} ${c.clase ?? ''}`}
          >
            <span
              className={`font-mono text-[0.7rem] leading-none ${hoy ? 'text-arena' : finde ? 'text-tinta-suave/60' : 'opacity-80'}`}
            >
              {dia.getDate()}
            </span>
            {c.contenido}
          </div>
        )
      })}
    </div>
  )
}

/** Fila de una prueba: color de la asignatura · fecha · qué es · cuánto falta. */
function FilaPrueba({
  e,
  foco,
  resaltada,
  marcada,
  registrar,
  onHover,
}: {
  e: EventoConDias
  foco: boolean
  resaltada: boolean
  marcada: boolean
  registrar: (el: HTMLElement | null) => void
  onHover: (f: string | null) => void
}) {
  return (
    <li
      ref={registrar}
      onMouseEnter={() => onHover(e.fecha)}
      onMouseLeave={() => onHover(null)}
      style={conColor(e.asignatura)}
      className={`group/fila relative grid grid-cols-[2.5rem_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-linea/60 py-2.5 pr-1 pl-3 transition-colors duration-500 ${
        marcada ? 'bg-arena/15' : resaltada || foco ? 'bg-fondo-alto' : ''
      }`}
    >
      <span className="absolute inset-y-1.5 left-0 w-1 bg-(--c)" aria-hidden="true" />
      <span className="text-center leading-none">
        <span className="block text-[0.65rem] text-tinta-suave capitalize">{formatoDiaSemana(e.dia)}</span>
        <span className="mt-0.5 block font-mono text-base font-medium">{e.dia.getDate()}</span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">
          {e.asignatura ? nombreAsignatura(e.asignatura) : (e.detalle ?? 'Evaluación')}
        </span>
        <span className="block truncate text-xs text-tinta-suave">
          <span className="text-(--c)">{TIPO[e.tipo]}</span>
          {e.detalle && ` · ${e.detalle}`}
          {foco && <span className="text-arena"> · la próxima</span>}
        </span>
      </span>
      <CuentaAtras dias={e.dias} />
      <EnlaceExterno href={urlDe(e)} etiqueta={`Abrir ${e.asignatura ? nombreAsignatura(e.asignatura) : 'la evaluación'}`} alPasar />
    </li>
  )
}

/** Fila de una fecha del calendario escolar (un día o un periodo). */
function FilaEscolar({
  e,
  marcada,
  registrar,
}: {
  e: EntradaEscolar
  marcada: boolean
  registrar: (el: HTMLElement | null) => void
}) {
  const periodo = !mismoDia(e.inicio, e.fin)
  const enCurso = e.dias <= 0 && periodo
  return (
    <li
      ref={registrar}
      className={`group/fila relative grid grid-cols-[2.5rem_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-linea/60 py-2.5 pr-1 pl-3 transition-colors duration-500 ${marcada ? 'bg-arena/15' : ''}`}
    >
      <span className={`absolute inset-y-1.5 left-0 w-1 ${ESCOLAR[e.tipo].barra}`} aria-hidden="true" />
      <span className="text-center leading-none">
        <span className="block text-[0.65rem] text-tinta-suave capitalize">{formatoDiaSemana(e.inicio)}</span>
        <span className="mt-0.5 block font-mono text-base font-medium">{e.inicio.getDate()}</span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{e.nombre}</span>
        <span className="block truncate text-xs text-tinta-suave">
          {ESCOLAR[e.tipo].texto}
          {periodo && ` · del ${formatoCorto(e.inicio)} al ${formatoCorto(e.fin)}`}
          {e.motivo && ` · ${e.motivo}`}
        </span>
      </span>
      {/* Sin coral: un festivo que se acerca no es una urgencia */}
      <span className={`font-mono text-xs whitespace-nowrap ${enCurso ? 'text-arena' : 'text-tinta-suave'}`}>
        {enCurso ? 'ahora' : textoCuentaAtras(e.dias)}
      </span>
      {/* Enlace solo si hay una explicación real; si no, un hueco del mismo ancho para que las columnas cuadren */}
      {e.url ? <EnlaceExterno href={e.url} etiqueta={`Qué es: ${e.nombre}`} alPasar /> : <span className="size-7" aria-hidden="true" />}
    </li>
  )
}

/** Botones con subrayado que se desliza entre opciones (layoutId de Motion). */
function Selector<T extends string>({
  id,
  opciones,
  valor,
  onCambio,
}: {
  id: string
  opciones: { valor: T; texto: string }[]
  valor: T
  onCambio: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-0.5">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onCambio(o.valor)}
          aria-pressed={valor === o.valor}
          className="relative px-2 py-1 text-xs text-tinta-suave transition-colors hover:text-tinta aria-pressed:text-tinta"
        >
          {o.texto}
          {valor === o.valor && (
            <motion.span
              layoutId={id}
              className="absolute inset-x-2 -bottom-px h-0.5 bg-arena"
              transition={{ duration: 0.35, ease: EASE_SALIDA }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

type Props = {
  ahora: Date
  lista: EventoConDias[]
  /** Nombre del grupo si aún no tiene exámenes cargados (el calendario escolar sí se muestra: es común) */
  sinDatos?: string
  className?: string
}

export function Calendario({ ahora, lista, sinDatos, className = '' }: Props) {
  const reducido = useReducedMotion()
  const [modo, setModo] = useState<Modo>('examenes')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  // Día "compartido" entre la cuadrícula y la lista: al pasar el ratón por uno se ilumina el otro
  const [diaResaltado, setDiaResaltado] = useState<string | null>(null)
  // Fila (id) o día (fecha) al que acabamos de saltar: se ilumina un momento
  const [marcada, setMarcada] = useState<string | null>(null)
  const temporizador = useRef(0)
  // Mes visible: por defecto, el de la próxima prueba
  const [vista, setVista] = useState(() => {
    const ref = proximoEvento(lista)?.dia ?? ahora
    return { anio: ref.getFullYear(), mes: ref.getMonth() }
  })

  // Sin registro del pasado: solo lo que queda por llegar
  const pruebas = lista.filter((e) => e.dias >= 0 && (filtro === 'todos' || e.tipo === filtro))
  const semanas = agruparPorSemana(pruebas)
  const foco = proximoEvento(lista)
  const escolares = entradasEscolares(ahora)

  // Elementos de la lista por id, para poder desplazarse hasta ellos (como un Map<String, Node>)
  const filas = useRef(new Map<string, HTMLElement>())
  const registrar = (id: string) => (el: HTMLElement | null) => {
    if (el) filas.current.set(id, el)
    else filas.current.delete(id)
  }

  /** Desplaza la lista hasta la fila `id` y la ilumina (`marca` puede ser el id o la fecha entera). */
  const irA = (id: string | undefined, marca = id) => {
    const el = id && filas.current.get(id)
    if (!el) return
    sonar('select', { volumen: 0.8 }) // "ahí está"
    el.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'center' })
    setMarcada(marca ?? null)
    clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(() => setMarcada(null), 1400)
  }

  // Hasta dónde se puede navegar: los meses con información y uno más a cada lado (siempre con el actual).
  // Los meses se cuentan como un número (año·12 + mes) para poder compararlos y sumarles sin líos
  const n = (d: Date) => d.getFullYear() * 12 + d.getMonth()
  const conInfo =
    modo === 'examenes' ? lista.filter((e) => e.dias >= 0).map((e) => n(e.dia)) : [n(INICIO), n(FIN)]
  const minimo = Math.min(n(ahora), ...conInfo) - 1
  const maximo = Math.max(n(ahora), ...conInfo) + 1
  // El mes visible se ajusta al rango (valor derivado: si cambias de modo y se sale, se corrige solo)
  const visible = Math.min(maximo, Math.max(minimo, vista.anio * 12 + vista.mes))
  const mesVisible = { anio: Math.floor(visible / 12), mes: visible % 12 }

  const moverMes = (delta: number) => {
    sonar('tap', { tono: delta > 0 ? 1.12 : 0.9 }) // más agudo hacia delante, más grave hacia atrás
    const d = Math.min(maximo, Math.max(minimo, visible + delta))
    setVista({ anio: Math.floor(d / 12), mes: d % 12 })
  }

  // ── Casillas en modo exámenes: siglas (o cuadraditos si hay varias), cada una es un botón ──
  const celdaPruebas = (dia: Date): Celda => {
    const fecha = isoLocal(dia)
    const evs = pruebas.filter((e) => e.fecha === fecha)
    if (!evs.length) return {}
    const boton = (e: EventoConDias, contenido: ReactNode, clase: string) => (
      <button
        key={e.id}
        type="button"
        style={conColor(e.asignatura)}
        title={`${e.asignatura ? nombreAsignatura(e.asignatura) : 'Evaluación'} · ${TIPO[e.tipo]}`}
        onClick={(ev) => {
          ev.stopPropagation() // que no salte también el clic del día
          irA(e.id)
        }}
        className={`transition-transform hover:scale-110 ${clase}`}
      >
        {contenido}
      </button>
    )
    return {
      resaltada: diaResaltado === fecha,
      alPulsar: () => irA(evs[0].id, fecha),
      // Un cuadradito del color de la asignatura por prueba (el nombre está en el tooltip y en la lista)
      contenido: <span className="flex flex-wrap gap-0.5">{evs.map((e) => boton(e, null, 'size-2.5 bg-(--c)'))}</span>,
    }
  }

  // ── Casillas en modo escolar: el día toma el color de lo que es; si tiene explicación, la abre ──
  const celdaEscolar = (dia: Date): Celda => {
    const info = infoDia(dia)
    if (!info) return {}
    const { url } = info
    return {
      clase: ESCOLAR[info.tipo].celda,
      titulo: [info.nombre, info.motivo, url && 'clic para saber más'].filter(Boolean).join(' · '),
      alPulsar: url
        ? () => {
            sonar('button')
            window.open(url, '_blank', 'noopener,noreferrer')
          }
        : undefined,
    }
  }

  const leyenda = (['vacaciones', 'festivo', 'no-lectivo'] as const).map((t) => (
    <span key={t} className="flex items-center gap-1.5">
      <span className={`size-2 ${ESCOLAR[t].barra}`} />
      {ESCOLAR[t].texto}
    </span>
  ))

  // Al cambiar de modo, el contenido se desliza hacia el lado que toca
  const lado = modo === 'escolar' ? 1 : -1

  return (
    <Panel
      titulo="Calendario"
      ayuda="Exámenes y entregas, o el calendario escolar (festivos y vacaciones). Pulsa un día o una prueba para saltar a ella en la lista."
      extra={
        <Selector
          id="modo-calendario"
          opciones={MODOS}
          valor={modo}
          onCambio={(m) => {
            sonar('swipe', { tono: m === 'escolar' ? 1.08 : 0.94 }) // desliza hacia un lado u otro
            setModo(m)
          }}
        />
      }
      className={`tinte-verde ${className}`}
      cuerpo="overflow-hidden"
    >
      <AnimatePresence mode="wait" initial={false} custom={lado}>
        <motion.div
          key={modo}
          custom={lado}
          variants={{ fuera: (l: number) => ({ opacity: 0, x: 24 * l }), dentro: { opacity: 1, x: 0 } }}
          initial="fuera"
          animate="dentro"
          exit={{ opacity: 0, x: -24 * lado }}
          transition={{ duration: 0.3, ease: EASE_SALIDA }}
          className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        >
          {/* Mes */}
          <div className="flex min-h-0 flex-col">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => moverMes(-1)}
                disabled={visible <= minimo}
                className="px-2 py-0.5 text-tinta-suave transition-colors hover:text-tinta disabled:pointer-events-none disabled:opacity-20"
                aria-label="Mes anterior"
              >
                ‹
              </button>
              <p className="font-titulo text-base font-semibold first-letter:uppercase">
                {formatoMes(new Date(mesVisible.anio, mesVisible.mes, 1))}
              </p>
              <button
                type="button"
                onClick={() => moverMes(1)}
                disabled={visible >= maximo}
                className="px-2 py-0.5 text-tinta-suave transition-colors hover:text-tinta disabled:pointer-events-none disabled:opacity-20"
                aria-label="Mes siguiente"
              >
                ›
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Mes
                ahora={ahora}
                anio={mesVisible.anio}
                mes={mesVisible.mes}
                celda={modo === 'examenes' ? celdaPruebas : celdaEscolar}
                onHover={
                  modo === 'examenes'
                    ? (f) => {
                        // Tic muy suave solo al pasar por días con pruebas
                        if (f && pruebas.some((e) => e.fecha === f)) sonar('type', { volumen: 0.35, cada: 50 })
                        setDiaResaltado(f)
                      }
                    : undefined
                }
              />
            </div>
            {modo === 'escolar' && <p className="mt-2 flex gap-4 text-[0.7rem] text-tinta-suave">{leyenda}</p>}
          </div>

          {/* Lista */}
          <div className="flex min-h-0 flex-col">
            {modo === 'examenes' && !sinDatos && (
              <div className="mb-1 -ml-2">
                <Selector
                  id="filtro-calendario"
                  opciones={FILTROS}
                  valor={filtro}
                  onCambio={(f) => {
                    sonar('select', { volumen: 0.6 })
                    setFiltro(f)
                  }}
                />
              </div>
            )}
            <div className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">
              {modo === 'examenes' && sinDatos ? (
                <SinDatos que="calendario de exámenes" grupo={sinDatos} />
              ) : modo === 'examenes' ? (
                <>
                  {semanas.length === 0 && <p className="py-6 text-sm text-tinta-suave">No queda nada con este filtro.</p>}
                  {semanas.map((s) => (
                    <section key={s.lunes.getTime()} className="mb-3 last:mb-0">
                      <h3 className="sticky top-0 z-10 bg-fondo py-1 text-[0.7rem] text-tinta-suave">
                        Semana del {formatoCorto(s.lunes)}
                      </h3>
                      <ul>
                        {s.eventos.map((e) => (
                          <FilaPrueba
                            key={e.id}
                            e={e}
                            foco={e.id === foco?.id}
                            resaltada={diaResaltado === e.fecha}
                            marcada={marcada === e.id || marcada === e.fecha}
                            registrar={registrar(e.id)}
                            onHover={setDiaResaltado}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </>
              ) : (
                <ul>
                  {escolares.map((e) => (
                    <FilaEscolar key={e.id} e={e} marcada={marcada === e.id} registrar={registrar(e.id)} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </Panel>
  )
}
