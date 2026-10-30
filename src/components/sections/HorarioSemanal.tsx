import { useRef, useState, type CSSProperties, type KeyboardEvent, type WheelEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Clase, DiaLectivo, Horario, TipoDiaEscolar } from '../../types'
import { colorAsignatura, nombreAsignatura, nombreCompleto } from '../../lib/datos'
import { esLectivo, FIN, infoDia, INICIO } from '../../lib/escolar'
import {
  diaSemana,
  horaAMinutos,
  isoLocal,
  lunesDe,
  MESES_CORTOS,
  minutosDelDia,
  mismoDia,
  NOMBRES_DIA,
  sumarDias,
} from '../../lib/fechas'
import { clasesDelDia, franjas, type Excluidas } from '../../lib/horario'
import { EASE_SALIDA } from '../../lib/movimiento'
import { canica, sonar } from '../../lib/sonido'
import { LupaCristal } from '../ui/LupaCristal'
import { Panel } from '../ui/Panel'
import { SinDatos } from '../ui/SinDatos'

const DIAS: DiaLectivo[] = [1, 2, 3, 4, 5]

type EstadoClase = 'actual' | 'pasada' | 'hoy' | 'normal'

/** `fecha`: el día concreto de la clase en la semana enseñada (el jueves de otra semana no es "hoy"). */
function estadoDe(c: Clase, ahora: Date, fecha: Date): EstadoClase {
  if (!mismoDia(fecha, ahora) || !esLectivo(fecha)) return 'normal' // un día sin clase no tiene "Ahora"
  const min = minutosDelDia(ahora)
  if (horaAMinutos(c.fin) <= min) return 'pasada'
  if (horaAMinutos(c.inicio) <= min) return 'actual'
  return 'hoy'
}

type PropsBloque = {
  c: Clase
  estado: EstadoClase
  activa: boolean
  fija: boolean // apagada desde Ajustes: aquí no se puede encender
  resaltada: boolean
  enLupa?: boolean // su día está bajo la lupa: se amplía y se levanta
  atenuada?: boolean // hay lupa y su día es otro: se apaga para que el día elegido se lea mejor
  progreso?: number // 0..1, solo en la clase en curso: dónde dibujar la línea de "ahora"
  largo?: boolean
  conHora?: boolean
  onResaltar: (id: string | null) => void
  onAlternar: (id: string) => void
}

/**
 * Bloque de una clase. Es un botón: al pasar el ratón se iluminan TODAS las horas
 * de su asignatura (el resaltado vive en el padre, no en cada bloque) y al hacer
 * clic la asignatura se apaga o se enciende solo para esta sesión.
 */
function BloqueClase({
  c,
  estado,
  activa,
  fija,
  resaltada,
  enLupa = false,
  atenuada = false,
  progreso,
  largo = false,
  conHora = false,
  onResaltar,
  onAlternar,
}: PropsBloque) {
  const nombre = nombreAsignatura(c.asignatura)
  const completo = nombreCompleto(c.asignatura)
  const titulo = fija
    ? `${completo} · convalidado: apagado en Ajustes (se cambia allí)`
    : activa
      ? `${completo} · clic si no cursas este módulo (solo por ahora; para siempre, en Ajustes)`
      : `${completo} · oculto por ahora (clic para volver a mostrarlo)`
  // El color de la asignatura llega como variable CSS (--c) y se mezcla muy diluido con el fondo
  const estilo = {
    '--c': colorAsignatura(c.asignatura),
    ...(activa && resaltada
      ? {
          backgroundColor: 'color-mix(in oklab, var(--c) 16%, var(--color-fondo-alto))',
          borderColor: 'color-mix(in oklab, var(--c) 60%, transparent)',
        }
      : {}),
  } as CSSProperties

  // Hoy se marca con el borde, no oscureciendo: el fondo es el mismo para todas las clases
  let clases = 'border-linea/70 bg-fondo/60'
  // Dos apagados, dos FORMAS (no solo dos texturas):
  // - convalidada (Ajustes, para siempre) = HUECO: sin caja, sin nombre, solo un rayado finísimo. Esa hora no es tuya.
  // - no seleccionada (clic, por ahora) = OCULTA: la caja sigue, con borde discontinuo y el nombre tenue.
  // --rayado avisa al cristal de la lupa, que no sabe pintar degradados de CSS
  if (!activa)
    clases = fija
      ? 'border-transparent bg-transparent bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.09)_0_1px,transparent_1px_7px)] [--rayado:1]'
      : 'border-dashed border-linea bg-transparent'
  else if (estado === 'actual') clases = 'border-arena bg-fondo/60'
  else if (estado === 'hoy') clases = 'border-arena/30 bg-fondo/60'
  // Bajo la lupa: sombra cercana y nítida + lejana y difusa = la clase "flota" sobre el panel
  if (enLupa && activa) clases += ' shadow-[0_2px_4px_rgb(0_0_0/0.5),0_10px_22px_-8px_rgb(0_0_0/0.8)]'
  // Fuera del día de la lupa, todo (colores y texto) baja; la asignatura bajo el ratón sí se ve entera
  if (atenuada && !resaltada) clases += ' opacity-45'

  return (
    <button
      type="button"
      aria-pressed={activa}
      title={titulo}
      onMouseEnter={(e) => {
        // Roce suave al pasar a otra asignatura (no al moverse dentro de la misma)
        if (!resaltada) sonar('tap', { volumen: 0.35, x: e.clientX, cada: 60 })
        onResaltar(c.asignatura)
      }}
      onMouseLeave={() => onResaltar(null)}
      onFocus={() => onResaltar(c.asignatura)}
      onBlur={() => onResaltar(null)}
      onClick={(e) => {
        if (!fija) sonar(activa ? 'toggle_off' : 'toggle_on', { x: e.clientX })
        onAlternar(c.asignatura)
      }}
      style={estilo}
      className={`relative flex h-full w-full min-h-0 flex-col justify-between gap-1 overflow-hidden border py-1.5 pr-2.5 pl-3 text-left transition-[background-color,border-color,opacity,box-shadow] duration-200 ${clases}`}
    >
      {/* Marca fina del color de la asignatura; con el ratón encima se intensifica */}
      <span
        className={`absolute inset-y-0 left-0 w-0.5 bg-(--c) transition-opacity duration-200 ${fija ? 'opacity-0' : !activa ? 'opacity-20' : resaltada ? 'opacity-100' : 'opacity-50'}`}
        aria-hidden="true"
      />
      {progreso !== undefined && activa && (
        <span
          className="pointer-events-none absolute inset-x-0 h-px bg-arena"
          style={{ top: `${progreso * 100}%` }}
          aria-hidden="true"
        >
          <span className="absolute -top-[2.5px] left-0 size-1.5 bg-arena" />
        </span>
      )}
      <span
        className={`text-[0.78rem] leading-[1.2] font-medium transition-colors ${fija ? 'opacity-0' : !activa ? 'text-tinta/35' : estado === 'normal' && !enLupa ? 'text-tinta/60' : 'text-tinta'} ${
          largo ? 'line-clamp-3' : 'line-clamp-2 lg:[@media(max-height:820px)]:line-clamp-1'
        }`}
      >
        {nombre}
      </span>
      {(conHora || (estado === 'actual' && activa)) && (
        <span className="flex justify-between gap-2 font-mono text-[0.7rem] text-tinta-suave">
          {conHora && (
            <span>
              {c.inicio}–{c.fin}
            </span>
          )}
          {estado === 'actual' && activa && <span className="font-sans font-medium text-arena">Ahora</span>}
        </span>
      )}
    </button>
  )
}

type Props = {
  ahora: Date
  horario: Horario | null // null: el grupo elegido aún no tiene datos
  grupo: string // nombre del grupo, para el estado vacío
  excluidas: Excluidas // todo lo apagado (Ajustes + temporal)
  permanentes: Excluidas // solo lo apagado en Ajustes
  onAlternar: (id: string) => void
  lunes: Date // la semana que se enseña
  lupa: Date | null // el día bajo la lupa (null: fin de semana y aún sin elegir)
  onElegir: (fecha: Date) => void
  className?: string
}

const TIPO_SIN_CLASE: Partial<Record<TipoDiaEscolar, string>> = {
  festivo: 'Festivo',
  'no-lectivo': 'No lectivo',
  vacaciones: 'Vacaciones',
}

// Hasta dónde llega la lupa: las semanas del curso y una más a cada lado (del lunes de antes al viernes de después)
const PRIMER_DIA = sumarDias(lunesDe(INICIO), -7)
const ULTIMO_DIA = sumarDias(lunesDe(FIN), 11)

/** Un paso de día lectivo: del viernes, al lunes siguiente; del lunes, al viernes anterior. */
function pasoLectivo(desde: Date, paso: 1 | -1): Date {
  let f = sumarDias(desde, paso)
  while (diaSemana(f) > 5) f = sumarDias(f, paso)
  return f
}

export function HorarioSemanal({
  ahora,
  horario,
  grupo,
  excluidas,
  permanentes,
  onAlternar,
  lunes,
  lupa,
  onElegir,
  className = '',
}: Props) {
  // Estado "levantado": la asignatura bajo el ratón se guarda aquí para que se iluminen todas sus horas
  const [resaltada, setResaltada] = useState<string | null>(null)
  // La rejilla, para que el cristal WebGL la "fotografíe" (callback ref en estado: el cristal se monta cuando existe)
  const [rejilla, setRejilla] = useState<HTMLDivElement | null>(null)
  const [cristal, setCristal] = useState(false) // true cuando el cristal WebGL está funcionando
  const ultimaRueda = useRef(0)
  const botonesDia = useRef<(HTMLButtonElement | null)[]>([])
  const dia = lupa ? (diaSemana(lupa) as DiaLectivo) : null // columna de la lupa en esta semana
  const fechaDe = (d: number) => sumarDias(lunes, d - 1)

  /** Lleva la lupa a otra fecha (dentro del curso). La canica suena más aguda cuanto más avanzada la semana. */
  const ir = (f: Date, x?: number) => {
    if (lupa && mismoDia(f, lupa)) return
    if (f < PRIMER_DIA || f > ULTIMO_DIA) {
      sonar('disabled', { volumen: 0.5 }) // más allá no hay horario que ver
      return false
    }
    canica({ altura: (diaSemana(f) - 1) / 4, x })
    onElegir(f)
    return true
  }
  // Sin lupa (fin de semana): hacia delante entra por el lunes de la semana enseñada; hacia atrás, por el viernes anterior
  const siguiente = (paso: 1 | -1) => (lupa ? pasoLectivo(lupa, paso) : paso > 0 ? lunes : sumarDias(lunes, -3))

  // La rueda dispara muchos eventos seguidos: un paso cada 250 ms como mucho (throttle, como en el carrusel).
  // Solo en escritorio: ahí el panel ocupa la pantalla y no hay página que desplazar; en tablet la rueda es del scroll
  const rueda = (e: WheelEvent) => {
    if (!window.matchMedia('(min-width: 64rem)').matches) return
    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    const t = performance.now()
    if (t - ultimaRueda.current < 250 || Math.abs(delta) < 4) return
    ultimaRueda.current = t
    ir(siguiente(delta > 0 ? 1 : -1), e.clientX)
  }
  const tecla = (e: KeyboardEvent) => {
    const paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!paso) return
    e.preventDefault()
    const f = siguiente(paso)
    if (ir(f)) botonesDia.current[diaSemana(f)]?.focus() // también al cruzar de semana: el botón de ese día
  }

  const cabecera = {
    titulo: 'Horario',
    ayuda:
      'Tu semana de clases. La lupa marca el día que ves en la Agenda: muévela con la rueda (pasa de semana al llegar al viernes o al lunes), las flechas o pulsando el nombre del día. Pasa el ratón por una asignatura para ver todas sus horas; haz clic para apagarla solo por ahora (para siempre, desde Ajustes).',
    extra: (
      <span
        className={`font-mono text-xs ${mismoDia(lunes, lunesDe(ahora)) ? 'text-tinta-suave' : 'text-arena'}`}
        aria-live="polite"
      >
        Semana del {lunes.getDate()} {MESES_CORTOS[lunes.getMonth()]}
      </span>
    ),
    className: `tinte-verde ${className}`,
  }
  // Los hooks (useState) van antes de este return: React exige llamarlos siempre en el mismo orden
  if (!horario) {
    return (
      <Panel {...cabecera}>
        <SinDatos que="horario" grupo={grupo} />
      </Panel>
    )
  }

  // En móvil no hay lupa: las pestañas eligen el mismo día (sin elegir, el lunes)
  const diaMovil: DiaLectivo = dia ?? 1
  // Cómo es cada columna: su fecha, si es hoy y si ese día no hay clase
  const columnas = DIAS.map((d) => {
    const fecha = fechaDe(d)
    return { d, fecha, esHoy: mismoDia(fecha, ahora), sinClase: esLectivo(fecha) ? null : infoDia(fecha) }
  })
  const lineas = franjas(horario)
  const fila = (hora: string) => lineas.indexOf(hora) + 2 // +1 base 1, +1 por la fila de cabecera
  const filasPlantilla = [
    'auto',
    ...lineas.slice(0, -1).map((h) => (h === horario.recreo.inicio ? '0.9rem' : 'minmax(0, 1fr)')),
  ].join(' ')

  const bloque = (c: Clase, extra: Partial<PropsBloque> = {}) => {
    const estado = estadoDe(c, ahora, fechaDe(c.dia))
    const ini = horaAMinutos(c.inicio)
    return (
      <BloqueClase
        c={c}
        estado={estado}
        activa={!excluidas.has(c.asignatura)}
        fija={permanentes.has(c.asignatura)}
        resaltada={resaltada === c.asignatura}
        enLupa={c.dia === dia}
        atenuada={dia !== null && c.dia !== dia}
        progreso={estado === 'actual' ? (minutosDelDia(ahora) - ini) / (horaAMinutos(c.fin) - ini) : undefined}
        onResaltar={setResaltada}
        onAlternar={onAlternar}
        {...extra}
      />
    )
  }

  return (
    <Panel {...cabecera}>
      {/* Tablet y escritorio: rejilla completa, con el cristal WebGL encima */}
      <div className="relative hidden h-full min-h-[22rem] md:block lg:min-h-0" onWheel={rueda}>
        <LupaCristal rejilla={rejilla} dia={dia} semana={isoLocal(lunes)} onActiva={setCristal} />
        <div
          ref={setRejilla}
          className="grid h-full gap-1.5"
          style={{ gridTemplateColumns: '2.75rem repeat(5, minmax(0, 1fr))', gridTemplateRows: filasPlantilla }}
        >
          {columnas.map(({ d, fecha, esHoy, sinClase }) => (
            <button
              key={d}
              ref={(el) => {
                botonesDia.current[d] = el
              }}
              type="button"
              aria-pressed={dia === d}
              data-dia={d}
              aria-label={`Ver la agenda del ${NOMBRES_DIA[d].toLowerCase()} ${fecha.getDate()}`}
              title={sinClase?.nombre}
              onClick={(e) => ir(fecha, e.clientX)}
              onKeyDown={tecla}
              style={{ gridColumn: d + 1, gridRow: 1 }}
              className={`flex min-w-0 items-center gap-1.5 border-b-2 pb-1.5 text-left text-sm transition-colors ${esHoy ? 'border-arena' : 'border-transparent'} ${esHoy || d === dia ? 'font-medium text-tinta' : 'text-tinta-suave hover:text-tinta'}`}
            >
              {NOMBRES_DIA[d]}
              <span className="font-mono text-[0.7rem] font-normal text-tinta-suave">{fecha.getDate()}</span>
              {esHoy && <span className="bg-arena px-1 text-[0.65rem] leading-[1.4] font-medium text-oscuro-fijo">Hoy</span>}
              {sinClase && TIPO_SIN_CLASE[sinClase.tipo] && (
                <span className="truncate text-[0.62rem] text-coral/80">{TIPO_SIN_CLASE[sinClase.tipo]}</span>
              )}
            </button>
          ))}

          {lineas.slice(0, -1).map((h, i) => (
            <p
              key={h}
              style={{ gridColumn: 1, gridRow: i + 2 }}
              className={`font-mono text-[0.7rem] text-tinta-suave ${h === horario.recreo.inicio ? 'self-center' : 'pt-1.5'}`}
            >
              {h}
            </p>
          ))}

          <div
            style={{ gridColumn: '2 / -1', gridRow: fila(horario.recreo.inicio) }}
            className="flex items-center gap-3 text-[0.7rem] text-tinta-suave"
          >
            <span className="h-px flex-1 bg-linea" />
            Recreo
            <span className="h-px flex-1 bg-linea" />
          </div>

          {horario.clases.map((c) => (
            <div
              key={`${c.dia}-${c.inicio}`}
              // Bajo la lupa la clase se amplía un poco: es el "aumento" (el cristal de encima solo decora)
              // Un día sin clase (festivo, vacaciones…) deja su columna en penumbra; bajo la lupa, algo menos (se lee)
              className={`min-h-0 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-salida ${c.dia === dia && !cristal ? 'relative z-[5] scale-[1.045]' : ''} ${columnas[c.dia - 1].sinClase ? (c.dia === dia ? 'opacity-60' : 'opacity-35') : ''}`}
              style={{ gridColumn: c.dia + 1, gridRow: `${fila(c.inicio)} / ${fila(c.fin)}` }}
            >
              {bloque(c, { largo: fila(c.fin) - fila(c.inicio) > 1 })}
            </div>
          ))}

          {/* Lupa de respaldo (sin WebGL): un cristal CSS sobre la columna del día. `layout` hace que Motion
              anime el salto de columna (FLIP) con un muelle. No captura el ratón: las clases se siguen pulsando */}
          {dia !== null && !cristal && (
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              style={{ gridColumn: dia + 1, gridRow: '1 / -1' }}
              className="pointer-events-none relative z-10 -mx-[3px] -my-1.5 border border-tinta/[0.14] bg-[linear-gradient(100deg,rgb(255_255_255/0.07),rgb(255_255_255/0.015)_30%,transparent_55%,rgb(255_255_255/0.03))] shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_-18px_28px_-18px_rgb(0_0_0/0.6),0_6px_14px_-6px_rgb(0_0_0/0.7),0_26px_44px_-16px_rgb(0_0_0/0.9)]"
              aria-hidden="true"
            >
              {/* Canto del cristal: una línea de luz arriba y un reflejo diagonal muy tenue */}
              <span className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.4),transparent)]" />
              <span className="absolute inset-y-0 left-[14%] w-[16%] -skew-x-12 bg-white/[0.03]" />
            </motion.div>
          )}
        </div>
      </div>

      {/* Móvil: pestañas por día + lista */}
      <div className="md:hidden">
        <div role="tablist" aria-label="Día de la semana" className="mb-3 grid grid-cols-5 border-b border-linea">
          {DIAS.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={diaMovil === d}
              onClick={(e) => ir(fechaDe(d), e.clientX)}
              className="relative py-2.5 text-sm text-tinta-suave aria-selected:font-medium aria-selected:text-tinta"
            >
              {NOMBRES_DIA[d].slice(0, 3)}
              {columnas[d - 1].esHoy && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-arena" />}
              {diaMovil === d && (
                <motion.span
                  layoutId="dia-activo"
                  className="absolute inset-x-2 -bottom-px h-0.5 bg-arena"
                  transition={{ duration: 0.35, ease: EASE_SALIDA }}
                />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.ol
            key={diaMovil}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25, ease: EASE_SALIDA }}
            className="space-y-1.5"
          >
            {clasesDelDia(horario, diaMovil).map((c, i, arr) => (
              <li key={c.inicio}>
                {i > 0 && arr[i - 1].fin === horario.recreo.inicio && (
                  <p className="my-2 flex items-center gap-3 text-xs text-tinta-suave">
                    <span className="h-px flex-1 bg-linea" />
                    Recreo
                    <span className="h-px flex-1 bg-linea" />
                  </p>
                )}
                {bloque(c, { conHora: true })}
              </li>
            ))}
          </motion.ol>
        </AnimatePresence>
      </div>
    </Panel>
  )
}
