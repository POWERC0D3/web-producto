import { motion } from 'motion/react'
import { nombreAsignatura } from '../../lib/datos'
import { diaSemana, mismoDia, NOMBRES_DIA, textoDuracion } from '../../lib/fechas'
import { estadoAhora, type EstadoAhora, type Excluidas, type ProximaClase } from '../../lib/horario'
import { EASE_SALIDA } from '../../lib/movimiento'
import { Logo3D } from '../ui/Logo3D'
import { Panel } from '../ui/Panel'
import { Scramble } from '../ui/Scramble'

function cuando(p: ProximaClase, ahora: Date) {
  const dia = mismoDia(p.fecha, ahora) ? 'hoy' : NOMBRES_DIA[diaSemana(p.fecha)].toLowerCase()
  return `${dia} a las ${p.clase.inicio}`
}

/** Los tres textos de la celda según el estado (un `switch` sobre la unión discriminada). */
function textos(e: EstadoAhora, ahora: Date): { etiqueta: string; titulo: string; detalle: string } {
  switch (e.tipo) {
    case 'clase':
      return {
        etiqueta: 'En clase',
        titulo: nombreAsignatura(e.clase.asignatura),
        detalle: e.siguiente ? `Después: ${nombreAsignatura(e.siguiente.asignatura)}` : 'Última clase del día',
      }
    case 'recreo':
      return {
        etiqueta: 'Recreo',
        titulo: `${textoDuracion(e.restantes)} de descanso`,
        detalle: e.siguiente ? `Después: ${nombreAsignatura(e.siguiente.clase.asignatura)}` : '',
      }
    case 'antes':
      return {
        etiqueta: `Empiezas en ${textoDuracion(e.faltan)}`,
        titulo: nombreAsignatura(e.siguiente.clase.asignatura),
        detalle: `A las ${e.siguiente.clase.inicio}`,
      }
    case 'libre':
      return {
        etiqueta: 'Sin clase',
        titulo: e.siguiente && mismoDia(e.siguiente.fecha, ahora) ? 'Hueco libre' : 'Por hoy, ya está',
        detalle: e.siguiente ? `Próxima clase: ${cuando(e.siguiente, ahora)}` : '',
      }
  }
}

/** Celda con el logo de puntos y lo que toca ahora mismo. */
type Props = {
  ahora: Date
  excluidas: Excluidas
  onAbrirAjustes: (centro: { x: number; y: number }) => void
  className?: string
}

export function Ahora({ ahora, excluidas, onAbrirAjustes, className = '' }: Props) {
  const e = estadoAhora(ahora, excluidas)
  const { etiqueta, titulo, detalle } = textos(e, ahora)
  const vivo = e.tipo === 'clase' || e.tipo === 'recreo'

  return (
    <Panel
      titulo="Ahora"
      descripcion="Qué toca en este momento · pulsa el logo para los ajustes"
      className={`bg-transparent! ${className}`}
      cuerpo="flex flex-col"
    >
      {/* Contenedor de tamaño: el logo mide lo máximo que quepa sin deformarse.
          100cqw = ancho del contenedor; 140cqh = 1,4 × su alto (la proporción del logo) */}
      <div className="grid h-56 min-h-0 place-items-center [container-type:size] sm:h-72 lg:h-auto lg:flex-1">
        <div className="w-[min(100cqw,140cqh)]">
          <Logo3D onActivar={onAbrirAjustes} />
        </div>
      </div>

      {/* Zona de texto con fondo sólido: la trama de puntos solo se ve alrededor del logo */}
      <div className="-mx-5 -mb-5 border-t border-linea bg-fondo px-5 pt-4 pb-5">
        <p className="flex items-center gap-2 text-xs text-tinta-suave">
          <span className="relative flex size-2">
            {vivo && <span className="absolute inline-flex size-full rounded-full bg-arena opacity-60 motion-safe:animate-ping" />}
            <span className={`relative inline-flex size-2 rounded-full ${vivo ? 'bg-arena' : 'bg-tinta-suave'}`} />
          </span>
          {etiqueta}
        </p>
        <p className="mt-1.5 font-serif text-3xl leading-tight">
          <Scramble texto={titulo} />
        </p>

        {e.tipo === 'clase' && (
          <div className="mt-3">
            <div
              className="h-1 bg-linea"
              role="progressbar"
              aria-valuenow={Math.round(e.progreso * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progreso de la clase"
            >
              <motion.div
                className="h-full origin-left bg-arena"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: e.progreso }}
                transition={{ duration: 1, ease: EASE_SALIDA }}
              />
            </div>
            <p className="mt-1.5 flex justify-between font-mono text-xs text-tinta-suave">
              <span>
                {e.clase.inicio}–{e.clase.fin}
              </span>
              <span className="text-tinta">quedan {textoDuracion(e.restantes)}</span>
            </p>
          </div>
        )}
        {detalle && <p className="mt-2 text-sm text-tinta-suave">{detalle}</p>}
      </div>
    </Panel>
  )
}
