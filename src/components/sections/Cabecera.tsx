import type { EventoConDias } from '../../types'
import { proximoEvento } from '../../lib/eventos'
import { formatoLargo, textoCuentaAtras } from '../../lib/fechas'
import { LogoMarca } from '../ui/LogoMarca'

const hora = (f: Date) => f.toTimeString().slice(0, 5)

type Props = { ahora: Date; lista: EventoConDias[]; onCuenta: (accion: 'entrar' | 'crear') => void }

/**
 * Barra superior en tres columnas (grid 1fr · auto · 1fr): así el bloque central
 * queda centrado de verdad aunque la izquierda y la derecha midan distinto.
 */
export function Cabecera({ ahora, lista, onCuenta }: Props) {
  const prox = proximoEvento(lista)
  const pendientes = lista.filter((e) => e.dias >= 0).length

  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-linea bg-fondo/80 px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <LogoMarca className="h-6 w-auto shrink-0" />
        <h1 className="truncate text-sm">
          <span className="font-serif text-lg">Monte Naranco</span>
          <span className="hidden text-tinta-suave xl:inline"> · DAW1A · 1ª evaluación</span>
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onCuenta('entrar')}
          className="px-3 py-1.5 text-sm text-tinta-suave transition-colors hover:text-tinta"
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => onCuenta('crear')}
          className="bg-tinta px-3.5 py-1.5 text-sm font-medium text-fondo transition-colors hover:bg-arena"
        >
          Crear cuenta
        </button>
      </div>

      <div className="flex items-center justify-end gap-6 text-xs text-tinta-suave">
        <dl className="hidden items-center gap-6 lg:flex">
          <div className="flex gap-1.5">
            <dt>Pendientes</dt>
            <dd className="font-mono text-tinta">{pendientes}</dd>
          </div>
          {prox && (
            <div className="flex gap-1.5">
              <dt>Próxima</dt>
              <dd className={prox.dias <= 1 ? 'text-coral' : 'text-tinta'}>
                {prox.asignatura ?? 'Evaluación'} {textoCuentaAtras(prox.dias)}
              </dd>
            </div>
          )}
        </dl>
        <p className="hidden shrink-0 font-mono sm:block">
          <span className="hidden capitalize 2xl:inline">{formatoLargo(ahora)} · </span>
          <span className="text-tinta">{hora(ahora)}</span>
        </p>
      </div>
    </header>
  )
}
