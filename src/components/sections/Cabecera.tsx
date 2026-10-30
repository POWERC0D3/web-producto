import type { CSSProperties } from 'react'
import type { EventoConDias, Horario } from '../../types'
import { useAhora } from '../../hooks/useAhora'
import { colorAsignatura, nombreAsignatura } from '../../lib/datos'
import { proximaClase } from '../../lib/escolar'
import { diaSemana, formatoLargo, horaAMinutos } from '../../lib/fechas'
import { nombreGrupo, type Grupo } from '../../lib/grupos'
import { clasesDelDia, type Excluidas } from '../../lib/horario'
import { Odometro } from '../ui/Odometro'

const dos = (n: number) => String(n).padStart(2, '0')

/** Cuenta atrás siempre en horas (aunque falte una semana) y minutos: "63 h 07 min". Sin segundos: distraían. */
function textoFalta(desde: Date, hasta: Date): string {
  // Redondeo hacia arriba: con 30 s de margen dice "1 min", nunca "0 min"
  const total = Math.max(0, Math.ceil((hasta.getTime() - desde.getTime()) / 60000))
  const h = Math.floor(total / 60)
  const m = total % 60
  return h ? `${h} h ${dos(m)} min` : `${m} min`
}

/**
 * Los exámenes solo tienen fecha. Para la cuenta atrás se toma la hora de la
 * primera clase de esa asignatura ese día (o, si no hay, el inicio de la jornada).
 */
function inicioDePrueba(e: EventoConDias, horario: Horario | null): Date {
  const clases = horario ? clasesDelDia(horario, diaSemana(e.dia)) : []
  const hora = clases.find((c) => c.asignatura === e.asignatura)?.inicio ?? clases[0]?.inicio ?? '08:15'
  const d = new Date(e.dia)
  d.setMinutes(horaAMinutos(hora))
  return d
}

/**
 * "Próxima clase Programación · en 63 h 07 min": el nombre en el color de su asignatura.
 * Con `horaPrimero` (lado izquierdo) la hora va delante, pegada a la esquina: "en 63 h 07 min · Próxima prueba Inglés".
 */
function Cuenta({
  etiqueta,
  asignatura,
  nombre,
  hasta,
  reloj,
  titulo,
  horaPrimero = false,
  className = '',
}: {
  etiqueta: string
  asignatura: string | null
  nombre: string
  hasta: Date
  reloj: Date
  titulo: string
  horaPrimero?: boolean
  className?: string
}) {
  const hora = <Odometro texto={`en ${textoFalta(reloj, hasta)}`} className="shrink-0 font-mono text-tinta" />
  const punto = (
    <span className="shrink-0" aria-hidden="true">
      ·
    </span>
  )
  return (
    <div className={`min-w-0 items-center gap-1.5 whitespace-nowrap ${className}`} title={titulo}>
      {horaPrimero && (
        <>
          {hora}
          {punto}
        </>
      )}
      <dt className="shrink-0">{etiqueta}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate font-medium text-(--c)" style={{ '--c': colorAsignatura(asignatura) } as CSSProperties}>
          {nombre}
        </span>
        {!horaPrimero && (
          <>
            {punto}
            {hora}
          </>
        )}
      </dd>
    </div>
  )
}

type Props = {
  horario: Horario | null
  lista: EventoConDias[]
  excluidas: Excluidas
  grupo: Grupo // solo se muestra: se cambia en Ajustes
}

/**
 * Barra superior en tres columnas (grid 1fr · auto · 1fr): el nombre queda
 * centrado de verdad aunque los lados midan distinto.
 * Izquierda: cuánto falta para la próxima prueba. Derecha: para la próxima clase.
 */
export function Cabecera({ horario, lista, excluidas, grupo }: Props) {
  // Reloj propio que late cada segundo: solo la cabecera se re-renderiza tan a menudo
  const reloj = useAhora(1000)
  const clase = horario ? proximaClase(horario, reloj, excluidas) : null
  // La primera prueba que aún no ha empezado
  const prueba = lista
    .filter((e) => e.dias >= 0)
    .map((e) => ({ e, inicio: inicioDePrueba(e, horario) }))
    .find((p) => p.inicio > reloj)

  // Las dos cuentas atrás se definen una vez y se colocan en dos sitios: a los lados del título (escritorio)
  // o en una segunda fila, una debajo de otra (móvil, donde no caben junto al título)
  const cuentaPrueba = (className: string) =>
    prueba && (
      <Cuenta
        etiqueta={prueba.e.tipo === 'entrega' ? 'Próxima entrega' : 'Próxima prueba'}
        horaPrimero
        asignatura={prueba.e.asignatura}
        nombre={prueba.e.asignatura ? nombreAsignatura(prueba.e.asignatura) : (prueba.e.detalle ?? 'Evaluación')}
        hasta={prueba.inicio}
        reloj={reloj}
        titulo={`${formatoLargo(prueba.inicio)}${prueba.e.detalle ? ` · ${prueba.e.detalle}` : ''}`}
        className={className}
      />
    )
  const cuentaClase = (className: string, horaPrimero = false) =>
    clase ? (
      <Cuenta
        etiqueta="Próxima clase"
        horaPrimero={horaPrimero}
        asignatura={clase.clase.asignatura}
        nombre={nombreAsignatura(clase.clase.asignatura)}
        hasta={clase.inicio}
        reloj={reloj}
        titulo={`${formatoLargo(clase.inicio)} a las ${clase.clase.inicio}`}
        className={className}
      />
    ) : (
      <div className={`gap-1.5 ${className}`}>
        <dt>Próxima clase</dt>
        <dd className="font-mono">—</dd>
      </div>
    )

  return (
    <header className="cristal relative z-30 shrink-0 border-b border-linea bg-fondo/60 px-4 text-xs text-tinta-suave">
      <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-4">
        <dl className="flex min-w-0">{cuentaPrueba('hidden md:flex')}</dl>

        <div className="flex items-center gap-2.5">
          <h1 className="font-titulo text-base font-bold tracking-tight whitespace-nowrap text-tinta">Monte Naranco Agenda Digital</h1>
          <span
            className="border border-linea px-1.5 py-0.5 font-mono text-[0.7rem] whitespace-nowrap text-arena"
            title="Tu grupo (se cambia en Ajustes)"
          >
            {nombreGrupo(grupo)}
          </span>
        </div>

        <dl className="flex min-w-0 justify-end">{cuentaClase('hidden md:flex')}</dl>
      </div>

      {/* Móvil: segunda fila con las dos cuentas, la hora delante para que queden alineadas */}
      <dl className="-mt-1.5 grid gap-1 pb-2.5 md:hidden">
        {cuentaPrueba('flex')}
        {cuentaClase('flex', true)}
      </dl>
    </header>
  )
}
