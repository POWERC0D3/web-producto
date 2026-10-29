import { useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Clase, DiaLectivo } from '../../types'
import { colorAsignatura, horario, nombreAsignatura } from '../../lib/datos'
import { diaSemana, horaAMinutos, minutosDelDia, NOMBRES_DIA } from '../../lib/fechas'
import { clasesDelDia, franjas, type Excluidas } from '../../lib/horario'
import { EASE_SALIDA } from '../../lib/movimiento'
import { Panel } from '../ui/Panel'

const DIAS: DiaLectivo[] = [1, 2, 3, 4, 5]

type EstadoClase = 'actual' | 'pasada' | 'hoy' | 'normal'

function estadoDe(c: Clase, ahora: Date): EstadoClase {
  if (c.dia !== diaSemana(ahora)) return 'normal'
  const min = minutosDelDia(ahora)
  if (horaAMinutos(c.fin) <= min) return 'pasada'
  if (horaAMinutos(c.inicio) <= min) return 'actual'
  return 'hoy'
}

type PropsBloque = {
  c: Clase
  estado: EstadoClase
  activa: boolean
  resaltada: boolean
  largo?: boolean
  conHora?: boolean
  onResaltar: (id: string | null) => void
  onAlternar: (id: string) => void
}

/**
 * Bloque de una clase. Es un botón: al pasar el ratón se iluminan TODAS las horas
 * de su asignatura (el resaltado vive en el padre, no en cada bloque) y al hacer
 * clic la asignatura se apaga o se enciende.
 */
function BloqueClase({ c, estado, activa, resaltada, largo = false, conHora = false, onResaltar, onAlternar }: PropsBloque) {
  const nombre = nombreAsignatura(c.asignatura)
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

  let clases = 'border-linea/70 bg-fondo/60'
  if (!activa) clases = 'border-dashed border-linea bg-transparent opacity-30 hover:opacity-60'
  else if (estado === 'actual') clases = 'border-arena bg-fondo-alto'
  else if (estado === 'hoy') clases = 'border-linea bg-fondo-alto'
  else if (estado === 'pasada') clases = 'border-linea bg-fondo-alto opacity-45'

  return (
    <button
      type="button"
      aria-pressed={activa}
      title={activa ? `${nombre} · clic si no cursas este módulo` : `${nombre} · apagado (clic para volver a activarlo)`}
      onMouseEnter={() => onResaltar(c.asignatura)}
      onMouseLeave={() => onResaltar(null)}
      onFocus={() => onResaltar(c.asignatura)}
      onBlur={() => onResaltar(null)}
      onClick={() => onAlternar(c.asignatura)}
      style={estilo}
      className={`relative flex h-full w-full min-h-0 flex-col justify-between gap-1 overflow-hidden border py-1.5 pr-2.5 pl-3 text-left transition-[background-color,border-color,opacity] duration-200 ${clases}`}
    >
      {/* Marca fina del color de la asignatura; con el ratón encima se intensifica */}
      <span
        className={`absolute inset-y-0 left-0 w-0.5 bg-(--c) transition-opacity duration-200 ${resaltada && activa ? 'opacity-100' : 'opacity-50'}`}
        aria-hidden="true"
      />
      <span
        className={`text-[0.78rem] leading-[1.2] font-medium ${activa ? '' : 'line-through'} ${
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
  excluidas: Excluidas
  onAlternar: (id: string) => void
  onRestablecer: () => void
  className?: string
}

export function HorarioSemanal({ ahora, excluidas, onAlternar, onRestablecer, className = '' }: Props) {
  const hoy = diaSemana(ahora)
  const [diaSel, setDiaSel] = useState<DiaLectivo>(hoy <= 5 ? (hoy as DiaLectivo) : 1)
  // Estado "levantado": la asignatura bajo el ratón se guarda aquí para que se iluminen todas sus horas
  const [resaltada, setResaltada] = useState<string | null>(null)

  const lineas = franjas()
  const fila = (hora: string) => lineas.indexOf(hora) + 2 // +1 base 1, +1 por la fila de cabecera
  const filasPlantilla = [
    'auto',
    ...lineas.slice(0, -1).map((h) => (h === horario.recreo.inicio ? '0.9rem' : 'minmax(0, 1fr)')),
  ].join(' ')

  const bloque = (c: Clase, extra: Partial<PropsBloque> = {}) => (
    <BloqueClase
      c={c}
      estado={estadoDe(c, ahora)}
      activa={!excluidas.has(c.asignatura)}
      resaltada={resaltada === c.asignatura}
      onResaltar={setResaltada}
      onAlternar={onAlternar}
      {...extra}
    />
  )

  return (
    <Panel
      titulo="Horario"
      descripcion="Pasa el ratón por una asignatura para verla entera. Haz clic si no la cursas: se apaga en todo el panel."
      extra={
        excluidas.size > 0 ? (
          <button
            type="button"
            onClick={onRestablecer}
            className="text-xs text-tinta-suave underline-offset-4 transition-colors hover:text-tinta hover:underline"
          >
            {excluidas.size} {excluidas.size === 1 ? 'módulo apagado' : 'módulos apagados'} · Restablecer
          </button>
        ) : undefined
      }
      className={className}
    >
      {/* Tablet y escritorio: rejilla completa */}
      <div
        className="hidden h-full min-h-[22rem] gap-1.5 md:grid lg:min-h-0"
        style={{ gridTemplateColumns: '2.75rem repeat(5, minmax(0, 1fr))', gridTemplateRows: filasPlantilla }}
      >
        {DIAS.map((d) => (
          <p
            key={d}
            style={{ gridColumn: d + 1, gridRow: 1 }}
            className={`border-b-2 pb-1.5 text-sm ${d === hoy ? 'border-arena font-medium text-tinta' : 'border-transparent text-tinta-suave'}`}
          >
            {NOMBRES_DIA[d]}
          </p>
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
            className="min-h-0"
            style={{ gridColumn: c.dia + 1, gridRow: `${fila(c.inicio)} / ${fila(c.fin)}` }}
          >
            {bloque(c, { largo: fila(c.fin) - fila(c.inicio) > 1 })}
          </div>
        ))}
      </div>

      {/* Móvil: pestañas por día + lista */}
      <div className="md:hidden">
        <div role="tablist" aria-label="Día de la semana" className="mb-3 grid grid-cols-5 border-b border-linea">
          {DIAS.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={diaSel === d}
              onClick={() => setDiaSel(d)}
              className="relative py-2.5 text-sm text-tinta-suave aria-selected:font-medium aria-selected:text-tinta"
            >
              {NOMBRES_DIA[d].slice(0, 3)}
              {d === hoy && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-arena" />}
              {diaSel === d && (
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
            key={diaSel}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25, ease: EASE_SALIDA }}
            className="space-y-1.5"
          >
            {clasesDelDia(diaSel).map((c, i, arr) => (
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
