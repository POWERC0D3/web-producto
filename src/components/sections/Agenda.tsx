import { useEffect, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import type { EventoConDias, Horario } from '../../types'
import { useHechas } from '../../hooks/useHechas'
import { colorAsignatura } from '../../lib/datos'
import { diasEntre, diaSemana, isoLocal, NOMBRES_DIA, textoCuentaAtras } from '../../lib/fechas'
import type { Excluidas } from '../../lib/horario'
import { EASE_SALIDA } from '../../lib/movimiento'
import { sonar } from '../../lib/sonido'
import { tareasDelDia, type Prioridad, type Tarea } from '../../lib/tareas'
import { Panel } from '../ui/Panel'
import { Escritura } from '../ui/Escritura'
import { SinDatos } from '../ui/SinDatos'

// La prioridad ya no se escribe: se nota en el brillo del texto (y un punto coral en las urgentes).
// El orden de la lista hace el resto
const BRILLO: Record<Prioridad, string> = {
  prioritario: 'text-tinta',
  importante: 'text-tinta',
  opcional: 'text-tinta/70',
}

// Cuánto tienes que quedarte en un día para que la IA "termine de pensar" y se escriba el plan
const PENSAR_MS = 1200
// Con movimiento reducido no hay pantalla de "pensando": el plan sale directamente
const sinAnimacion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Profundidad en dibujo técnico isométrico: la Agenda es la cara frontal de un taco de post-its.
 * Dos caras más, la de arriba y la izquierda, retroceden a 30° (la derecha es el borde de la pantalla).
 * Cada cara es un <div> torcido con skew: la de arriba con skewX(60°) (avanza 24 px por cada 14 de
 * alto) y la lateral con skewY(30°): las dos acaban en la misma esquina de atrás. Las líneas finas
 * de dentro son los cantos de las hojas. La cara de arriba, más clara (le da la luz); la lateral, más oscura.
 */
function Taco() {
  const linea = 'border-arena/45'
  const canto = 'bg-arena/20'
  return (
    <div className="pointer-events-none hidden lg:block" aria-hidden="true">
      {/* Cara de arriba: su borde inferior es el borde superior de la Agenda */}
      <div className={`absolute bottom-full left-0 h-3.5 w-full origin-bottom skew-x-[60deg] border-x border-t bg-[#1d1c1b] ${linea}`}>
        <span className={`absolute inset-x-0 top-1/3 h-px ${canto}`} />
        <span className={`absolute inset-x-0 top-2/3 h-px ${canto}`} />
      </div>
      {/* Cara izquierda: su borde derecho es el borde izquierdo de la Agenda */}
      <div className={`absolute top-0 right-full h-full w-6 origin-right skew-y-[30deg] border-y border-l bg-[#0d0d0c] ${linea}`}>
        <span className={`absolute inset-y-0 left-1/3 w-px ${canto}`} />
        <span className={`absolute inset-y-0 left-2/3 w-px ${canto}`} />
      </div>
    </div>
  )
}

/** Mientras "piensa": una línea de luz que barre el borde de arriba de la Agenda, de lado a lado. */
function Pensando() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden" aria-hidden="true">
      <span className="absolute inset-0 animate-barrido bg-[linear-gradient(90deg,transparent,var(--color-arena),transparent)]" />
    </div>
  )
}

// La celda más importante de la web, LEVANTADA sobre las demás (profundidad, no un objeto literal):
// - superficie con luz: un halo arena muy tenue arriba y un degradado que oscurece hacia abajo
// - sombras en capas: canto de luz arriba (inset), borde arena, sombra cercana y nítida + lejana y difusa, halo
// `!` (important) porque Panel ya trae su propio borde (sombra de 1px) y fondo.
const FOCO = [
  'z-10',
  // En escritorio la cara frontal retrocede lo que mide el taco (24 × 14 px): así sus caras de
  // profundidad caben dentro de la celda y el canto de atrás coincide con las líneas del resto del panel
  'lg:mt-3.5 lg:ml-6',
  'bg-[radial-gradient(120%_55%_at_50%_0%,color-mix(in_oklab,var(--color-arena)_8%,transparent),transparent_70%),linear-gradient(180deg,#1c1b1a,#141414_50%,#0f0f0f)]!',
  'shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_0_0_1px_color-mix(in_oklab,var(--color-arena)_55%,transparent),0_10px_20px_-6px_rgb(0_0_0/0.75),0_34px_70px_-18px_rgb(0_0_0/0.95),0_0_60px_-14px_color-mix(in_oklab,var(--color-arena)_35%,transparent)]!',
].join(' ')

/** Esqueleto mientras "la IA prepara el plan": barras grises con un barrido de luz que las recorre. */
function Cargando() {
  const barra = (ancho: string) => (
    <span className={`relative block h-3 overflow-hidden bg-fondo ${ancho}`}>
      <span className="absolute inset-0 animate-barrido bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--color-arena)_22%,transparent),transparent)]" />
    </span>
  )
  return (
    <div className="space-y-4" aria-busy="true">
      <p className="flex items-center gap-2 font-mono text-xs text-arena">
        <span className="size-1.5 animate-pulse bg-arena" aria-hidden="true" />
        <Escritura texto="Pensando tu plan…" ritmo={35} />
      </p>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3">
          {barra('size-4')}
          <span className="space-y-1.5">
            {barra('w-20 opacity-60')}
            {barra(i % 2 ? 'w-2/3' : 'w-5/6')}
            {barra('w-1/2 opacity-60')}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Casilla de "hecho": cuadrada, como en una libreta; marcada, se rellena de arena con un ✓. */
function Casilla({ marcada }: { marcada: boolean }) {
  return (
    <span
      className={`mt-0.5 grid size-4 shrink-0 place-items-center border transition-colors ${marcada ? 'border-arena bg-arena' : 'border-tinta-suave/60 group-hover:border-arena'}`}
      aria-hidden="true"
    >
      <motion.svg
        viewBox="0 0 12 12"
        className="size-3 text-oscuro-fijo"
        initial={false}
        animate={{ opacity: marcada ? 1 : 0, scale: marcada ? 1 : 0.5 }}
      >
        <path d="M2.5 6.5l2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </motion.svg>
    </span>
  )
}

function FilaTarea({
  t,
  hecha,
  retraso,
  onAlternar,
  estatica = false,
}: {
  t: Tarea
  hecha: boolean
  retraso: number
  onAlternar: (x: number) => void
  estatica?: boolean // copia para medir: mismo tamaño, sin animaciones
}) {
  const p = BRILLO[t.prioridad]
  return (
    <motion.li
      layout={!estatica} // al marcarla baja al final: Motion anima el cambio de posición
      transition={{ layout: { duration: 0.45, ease: EASE_SALIDA } }}
      variants={{ oculto: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_SALIDA } } }}
      style={{ '--c': t.asignatura ? colorAsignatura(t.asignatura) : 'var(--color-linea)' } as CSSProperties}
      className="border-b border-linea/60 last:border-0"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={hecha}
        onClick={(e) => onAlternar(e.clientX)}
        className="group relative grid w-full grid-cols-[1rem_minmax(0,1fr)] gap-x-3 py-2.5 pl-2 text-left"
      >
        {/* Marca del color de la asignatura */}
        <span className="absolute top-2.5 bottom-2.5 left-0 w-0.5 bg-(--c)" aria-hidden="true" />
        <Casilla marcada={hecha} />
        <span className={`min-w-0 transition-opacity ${hecha ? 'opacity-40' : ''}`}>
          <span className={`flex items-center gap-1.5 text-sm leading-snug font-medium ${hecha ? 'line-through' : p}`}>
            {/* La prioridad sin palabras: un punto coral si es para ya; texto tenue si es "si te da tiempo" */}
            {t.prioridad === 'prioritario' && !hecha && (
              <span className="size-1.5 shrink-0 rounded-full bg-coral" title="Prioritario" />
            )}
            <span className="min-w-0">{estatica ? t.texto : <Escritura texto={t.texto} retraso={retraso} ritmo={9} />}</span>
          </span>
          {/* El motivo empieza casi a la vez que el título y va más deprisa: todo queda escrito en ~0,6 s */}
          <span className="block text-xs leading-relaxed text-tinta-suave">
            {estatica ? t.motivo : <Escritura texto={t.motivo} retraso={retraso + 120} ritmo={6} />}
          </span>
        </span>
      </button>
    </motion.li>
  )
}

// Cambiar de día: el plan se desliza hacia el lado al que avanzas (como Exámenes/Escolar en el Calendario).
// `dir` llega por `custom` desde AnimatePresence, también al plan que ya se está yendo.
const PLAN: Variants = {
  entra: (dir: number) => ({ x: dir * 36, opacity: 0 }),
  quieto: { x: 0, opacity: 1, transition: { duration: 0.45, ease: EASE_SALIDA } },
  sale: (dir: number) => ({ x: dir * -36, opacity: 0, transition: { duration: 0.25, ease: EASE_SALIDA } }),
}

type PropsPlan = {
  ahora: Date
  fecha: Date
  horario: Horario
  lista: EventoConDias[]
  excluidas: Excluidas
  cargando: boolean
  dir: number // 1: se avanza de día; -1: se vuelve atrás
}

/** El plan de UN día, con sus tareas marcadas y su propia medida de lo que cabe. */
function PlanDelDia({ ahora, fecha, horario, lista, excluidas, cargando, dir }: PropsPlan) {
  const iso = isoLocal(fecha)
  const esHoy = iso === isoLocal(ahora)
  const { hechas, alternar } = useHechas(iso)
  // Cuántas tareas caben sin scroll. Se miden en una copia invisible de la lista (en orden de
  // prioridad) y se suman alturas hasta llenar el hueco. Callback refs en estado: los elementos
  // aparecen tras la animación de carga y el efecto debe enterarse.
  const [zona, setZona] = useState<HTMLDivElement | null>(null)
  const [medidor, setMedidor] = useState<HTMLOListElement | null>(null)
  const [cabe, setCabe] = useState(Infinity)
  useEffect(() => {
    if (!zona || !medidor) return
    const calcular = () => {
      let usado = 0
      let n = 0
      for (const li of medidor.children) {
        usado += (li as HTMLElement).offsetHeight
        if (usado > zona.clientHeight) break
        n++
      }
      setCabe(Math.max(1, n))
    }
    // Recalcula si cambia el hueco (ventana) o el contenido (otras tareas)
    const ro = new ResizeObserver(calcular)
    ro.observe(zona)
    ro.observe(medidor)
    return () => ro.disconnect()
  }, [zona, medidor])

  const todas = tareasDelDia(horario, fecha, lista, excluidas)
  // El plan del día: las de más prioridad que caben (las hechas siguen dentro, al final)
  const tareas = todas.slice(0, cabe)
  const ordenadas = [...tareas.filter((t) => !hechas.has(t.id)), ...tareas.filter((t) => hechas.has(t.id))]
  const nHechas = tareas.filter((t) => hechas.has(t.id)).length
  const todo = tareas.length > 0 && nHechas === tareas.length

  const marcar = (t: Tarea, x: number) => {
    const marcando = !hechas.has(t.id)
    if (marcando && nHechas + 1 === tareas.length)
      sonar('celebration', { volumen: 0.4, x }) // ¡última!
    else sonar(marcando ? 'toggle_on' : 'toggle_off', { x })
    alternar(t.id)
  }

  return (
    <motion.div
      custom={dir}
      variants={PLAN}
      initial="entra"
      animate="quieto"
      exit="sale"
      className="flex min-h-0 flex-col [grid-area:1/1]"
    >
      {/* Qué día es y cuánto llevas, en una sola línea: "Martes 10 · Hoy ··· 2/5" y la barra debajo */}
      <div className="mb-2 shrink-0">
        <p className="flex items-baseline justify-between gap-3">
          <span className="flex items-baseline gap-2">
            <span className="font-titulo text-base leading-none font-bold tracking-tight">
              {NOMBRES_DIA[diaSemana(fecha)]} {fecha.getDate()}
            </span>
            <span className={`font-mono text-[0.65rem] tracking-widest uppercase ${esHoy ? 'text-arena' : 'text-tinta-suave'}`}>
              {esHoy ? 'Hoy' : textoCuentaAtras(diasEntre(ahora, fecha))}
            </span>
          </span>
          {!cargando && tareas.length > 0 && (
            <span className={`font-mono text-xs ${todo ? 'text-arena' : 'text-tinta-suave'}`}>
              {todo ? 'Todo listo' : `${nHechas}/${tareas.length}`}
            </span>
          )}
        </p>
        {!cargando && tareas.length > 0 && (
          <div className="mt-2 h-px bg-linea">
            <motion.div
              className="h-full origin-left bg-arena"
              initial={false}
              animate={{ scaleX: tareas.length ? nHechas / tareas.length : 0 }}
              transition={{ duration: 0.6, ease: EASE_SALIDA }}
            />
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {cargando ? (
          <motion.div key="cargando" exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <Cargando />
          </motion.div>
        ) : (
          <motion.div
            key="plan"
            className="flex min-h-0 flex-1 flex-col"
            initial="oculto"
            animate="visible"
            variants={{ oculto: {}, visible: { transition: { staggerChildren: 0.06 } } }}
          >
            {todas.length === 0 ? (
              <p className="py-8 text-center text-sm text-tinta-suave">
                <Escritura texto={esHoy ? 'Hoy no tienes nada pendiente. Descansa.' : 'Nada pendiente para este día.'} />
              </p>
            ) : (
              // Hueco que llenar: alto fijo en móvil, el resto de la celda en escritorio
              <div ref={setZona} className="relative h-[28rem] min-h-0 lg:h-auto lg:flex-1">
                <ol>
                  {ordenadas.map((t) => (
                    // retraso según la posición ORIGINAL (por prioridad): al marcar una tarea no cambia, así el
                    // texto de las demás no vuelve a "decodificarse"
                    <FilaTarea
                      key={t.id}
                      t={t}
                      hecha={hechas.has(t.id)}
                      retraso={tareas.indexOf(t) * 60}
                      onAlternar={(x) => marcar(t, x)}
                    />
                  ))}
                </ol>
                {/* Copia invisible de TODAS las tareas, solo para medir sus alturas */}
                <ol ref={setMedidor} aria-hidden="true" inert className="pointer-events-none invisible absolute inset-x-0 top-0">
                  {todas.map((t) => (
                    <FilaTarea key={t.id} t={t} hecha={false} retraso={0} onAlternar={() => {}} estatica />
                  ))}
                </ol>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

type Props = {
  ahora: Date // la hora real
  fecha: Date // el día que se mira (lo elige la lupa del horario)
  horario: Horario | null
  grupo: string
  lista: EventoConDias[] // pruebas vistas desde `fecha`
  excluidas: Excluidas
  onHoy: () => void
  className?: string
}

/** La agenda del día: lo que tienes que hacer, por prioridad, y lo que llevas hecho. */
export function Agenda({ ahora, fecha, horario, grupo, lista, excluidas, onHoy, className = '' }: Props) {
  // Estado de "carga": al montar, la agenda finge que la IA está preparando el plan
  const [cargando, setCargando] = useState(() => !sinAnimacion())
  const iso = isoLocal(fecha)
  const esHoy = iso === isoLocal(ahora)
  // Hacia dónde se desliza el plan: se deduce al cambiar de día ("ajustar el estado durante el render").
  // Las fechas ISO se ordenan bien como texto: "2026-11-13" > "2026-11-12"
  const [vista, setVista] = useState(iso)
  const [dir, setDir] = useState(1)
  if (vista !== iso) {
    setDir(iso > vista ? 1 : -1)
    setVista(iso)
    // Día nuevo: vuelve a "pensar". Las tareas no se montan hasta que te quedes quieto en él
    if (!sinAnimacion()) setCargando(true)
  }

  // DEBOUNCE: el plan aparece cuando llevas PENSAR_MS en el mismo día. Como `iso` está en las
  // dependencias, cada cambio de día cancela la cuenta anterior (cleanup) y empieza otra: si pasas
  // los días deprisa con la rueda, por los intermedios solo pasa el esqueleto (ligero), nunca la lista
  useEffect(() => {
    if (!cargando) return
    // Mientras "piensa": tecleo de datos muy tenue y a ritmo irregular (como un terminal procesando)
    const tecleo = window.setInterval(() => {
      if (Math.random() < 0.55) sonar('type', { volumen: 0.18, tono: 0.85 + Math.random() * 0.5, cada: 0 })
    }, 85)
    const t = window.setTimeout(() => {
      setCargando(false)
      sonar('transition_up', { volumen: 0.5 }) // listo: el plan "aparece"
    }, PENSAR_MS)
    return () => {
      clearInterval(tecleo)
      clearTimeout(t)
    }
  }, [cargando, iso])

  const cabecera = {
    titulo: 'Agenda',
    ayuda:
      'Tu plan del día: lo que tienes que estudiar y hacer, ordenado por prioridad según tus exámenes y entregas. Márcalo cuando lo termines. Con la lupa del horario puedes ver el de otro día.',
    extra: !esHoy && (
      <button
        type="button"
        onClick={onHoy}
        // block + -my-1: no debe hacer más alta la cabecera (cabría una tarea menos).
        // En línea (inline) no bastaría: la altura de línea heredada seguiría ocupando sus 24px
        className="-my-1 block border border-linea px-2 py-0.5 font-mono text-xs text-tinta-suave transition-colors hover:border-arena hover:text-arena"
      >
        ↩ Volver a hoy
      </button>
    ),
    className: `${FOCO} ${className}`,
  }
  if (!horario) {
    return (
      <Panel {...cabecera}>
        <SinDatos que="agenda" grupo={grupo} />
      </Panel>
    )
  }

  return (
    <Panel
      {...cabecera}
      fondo={
        <>
          <Taco />
          {cargando && <Pensando />}
        </>
      }
      cuerpo="grid grid-rows-[minmax(0,1fr)] overflow-hidden"
    >
      <AnimatePresence initial={false} custom={dir}>
        <PlanDelDia key={iso} ahora={ahora} fecha={fecha} horario={horario} lista={lista} excluidas={excluidas} cargando={cargando} dir={dir} />
      </AnimatePresence>
    </Panel>
  )
}
