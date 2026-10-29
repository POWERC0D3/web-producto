import { useState, type CSSProperties } from 'react'
import { motion } from 'motion/react'
import type { EventoConDias, TipoEvento } from '../../types'
import { colorAsignatura, nombreAsignatura } from '../../lib/datos'
import { agruparPorSemana, proximoEvento } from '../../lib/eventos'
import { diasEntre, formatoCorto, formatoDiaSemana, formatoMes, mismoDia } from '../../lib/fechas'
import { EASE_SALIDA } from '../../lib/movimiento'
import { CuentaAtras } from '../ui/CuentaAtras'
import { Panel } from '../ui/Panel'

type Filtro = 'todos' | TipoEvento

const filtros: { valor: Filtro; texto: string }[] = [
  { valor: 'todos', texto: 'Todo' },
  { valor: 'examen', texto: 'Exámenes' },
  { valor: 'entrega', texto: 'Entregas' },
]

const TIPO: Record<TipoEvento, string> = { examen: 'Examen', entrega: 'Entrega', evaluacion: 'Evaluación' }
const conColor = (id: string | null) => ({ '--c': colorAsignatura(id) }) as CSSProperties

/** Cuadrícula de un mes. Cada prueba aparece como sus siglas sobre el color de la asignatura. */
function Mes({
  ahora,
  lista,
  anio,
  mes,
  diaResaltado,
  onResaltar,
}: {
  ahora: Date
  lista: EventoConDias[]
  anio: number
  mes: number
  diaResaltado: string | null
  onResaltar: (fecha: string | null) => void
}) {
  const primero = new Date(anio, mes, 1)
  const diasMes = new Date(anio, mes + 1, 0).getDate()
  const hueco = (primero.getDay() + 6) % 7 // lunes = 0
  const celdas = Array.from({ length: diasMes }, (_, i) => new Date(anio, mes, i + 1))

  return (
    <div className="grid h-full min-h-[18rem] grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-1 lg:min-h-0">
      {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
        <span key={d} className="pb-1 text-center text-[0.7rem] text-tinta-suave">
          {d}
        </span>
      ))}
      {hueco > 0 && <span style={{ gridColumn: `span ${hueco}` }} />}
      {celdas.map((dia) => {
        const fecha = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`
        const evs = lista.filter((e) => e.fecha === fecha)
        const hoy = mismoDia(dia, ahora)
        const pasado = diasEntre(ahora, dia) < 0
        const finde = dia.getDay() === 0 || dia.getDay() === 6
        const resaltado = diaResaltado === fecha
        return (
          <div
            key={fecha}
            onMouseEnter={() => evs.length && onResaltar(fecha)}
            onMouseLeave={() => onResaltar(null)}
            className={`flex min-h-0 flex-col gap-0.5 overflow-hidden border p-1 transition-colors ${
              hoy ? 'border-arena' : resaltado ? 'border-tinta/40 bg-fondo-alto' : 'border-linea/60'
            } ${pasado ? 'opacity-40' : ''}`}
          >
            <span className={`font-mono text-[0.7rem] leading-none ${hoy ? 'text-arena' : finde ? 'text-tinta-suave/60' : 'text-tinta-suave'}`}>
              {dia.getDate()}
            </span>
            {/* Una prueba: sus siglas. Varias: un cuadradito de color por cada una (no caben las siglas) */}
            {evs.length === 1 && (
              <span
                style={conColor(evs[0].asignatura)}
                className="truncate bg-(--c)/20 px-1 font-mono text-[0.6rem] leading-[1.35] font-medium text-(--c)"
                title={`${evs[0].asignatura ? nombreAsignatura(evs[0].asignatura) : 'Evaluación'} · ${TIPO[evs[0].tipo]}`}
              >
                {evs[0].asignatura ?? 'EVAL'}
              </span>
            )}
            {evs.length > 1 && (
              <span
                className="flex flex-wrap gap-0.5"
                title={evs.map((e) => `${e.asignatura ?? 'Evaluación'} · ${TIPO[e.tipo]}`).join('\n')}
              >
                {evs.map((e) => (
                  <span key={e.id} style={conColor(e.asignatura)} className="size-2 bg-(--c)" />
                ))}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Una fila: color de la asignatura · fecha · qué es · cuánto falta. */
function Fila({ e, foco, resaltada, onResaltar }: { e: EventoConDias; foco: boolean; resaltada: boolean; onResaltar: (f: string | null) => void }) {
  return (
    <li
      onMouseEnter={() => onResaltar(e.fecha)}
      onMouseLeave={() => onResaltar(null)}
      style={conColor(e.asignatura)}
      className={`relative grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-linea/60 py-2.5 pr-1 pl-3 transition-colors ${
        resaltada || foco ? 'bg-fondo-alto' : ''
      } ${e.dias < 0 ? 'opacity-45' : ''}`}
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
          {e.asignatura && ` · ${e.asignatura}`}
          {e.asignatura && e.detalle && ` · ${e.detalle}`}
          {foco && <span className="text-arena"> · la próxima</span>}
        </span>
      </span>
      <CuentaAtras dias={e.dias} />
    </li>
  )
}

type Props = { ahora: Date; lista: EventoConDias[]; className?: string }

export function Calendario({ ahora, lista, className = '' }: Props) {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [verPasados, setVerPasados] = useState(false)
  // Día "compartido" entre la cuadrícula y la lista: al pasar el ratón por uno se ilumina el otro
  const [diaResaltado, setDiaResaltado] = useState<string | null>(null)
  // Mes visible: por defecto, el de la próxima prueba
  const [vista, setVista] = useState(() => {
    const ref = proximoEvento(lista)?.dia ?? ahora
    return { anio: ref.getFullYear(), mes: ref.getMonth() }
  })

  const filtrados = lista.filter((e) => filtro === 'todos' || e.tipo === filtro)
  const visibles = filtrados.filter((e) => verPasados || e.dias >= 0)
  const semanas = agruparPorSemana(visibles)
  const foco = proximoEvento(lista)

  const moverMes = (delta: number) =>
    setVista((v) => {
      const d = new Date(v.anio, v.mes + delta, 1)
      return { anio: d.getFullYear(), mes: d.getMonth() }
    })

  const filtrosUI = (
    <div className="flex items-center gap-0.5">
      {filtros.map((f) => (
        <button
          key={f.valor}
          type="button"
          onClick={() => setFiltro(f.valor)}
          aria-pressed={filtro === f.valor}
          className="relative px-2 py-1 text-xs text-tinta-suave transition-colors hover:text-tinta aria-pressed:text-tinta"
        >
          {f.texto}
          {filtro === f.valor && (
            <motion.span
              layoutId="filtro-activo"
              className="absolute inset-x-2 -bottom-px h-0.5 bg-arena"
              transition={{ duration: 0.35, ease: EASE_SALIDA }}
            />
          )}
        </button>
      ))}
    </div>
  )

  return (
    <Panel
      titulo="Calendario"
      descripcion="Exámenes y entregas. Cada asignatura tiene su color; pasa el ratón por un día o una prueba para relacionarlos."
      extra={filtrosUI}
      className={className}
    >
      <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* Mes */}
        <div className="flex min-h-0 flex-col">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => moverMes(-1)}
              className="px-2 py-0.5 text-tinta-suave transition-colors hover:text-tinta"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <p className="font-serif text-lg capitalize">{formatoMes(new Date(vista.anio, vista.mes, 1))}</p>
            <button
              type="button"
              onClick={() => moverMes(1)}
              className="px-2 py-0.5 text-tinta-suave transition-colors hover:text-tinta"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <Mes
              ahora={ahora}
              lista={filtrados}
              anio={vista.anio}
              mes={vista.mes}
              diaResaltado={diaResaltado}
              onResaltar={setDiaResaltado}
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">
            {semanas.length === 0 && <p className="py-6 text-sm text-tinta-suave">No hay nada con este filtro.</p>}
            {semanas.map((s) => (
              <section key={s.lunes.getTime()} className="mb-3 last:mb-0">
                <h3 className="sticky top-0 z-10 bg-fondo py-1 text-[0.7rem] text-tinta-suave">
                  Semana del {formatoCorto(s.lunes)}
                </h3>
                <ul>
                  {s.eventos.map((e) => (
                    <Fila
                      key={e.id}
                      e={e}
                      foco={e.id === foco?.id}
                      resaltada={diaResaltado === e.fecha}
                      onResaltar={setDiaResaltado}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-tinta-suave">
            <input
              type="checkbox"
              checked={verPasados}
              onChange={(e) => setVerPasados(e.target.checked)}
              className="size-3.5 accent-arena"
            />
            Ver pasados
          </label>
        </div>
      </div>
    </Panel>
  )
}
