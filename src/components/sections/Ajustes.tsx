import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'motion/react'
import { useSonido } from '../../hooks/useSonido'
import { colorAsignatura, nombreAsignatura } from '../../lib/datos'
import { nombreGrupo, type Grupo } from '../../lib/grupos'
import type { Excluidas } from '../../lib/horario'
import { aparecer, cascada } from '../../lib/movimiento'
import { activarSonido, cambiarVolumen, sonar } from '../../lib/sonido'
import { LogoMarca } from '../ui/LogoMarca'
import { ElegirGrupo } from './ElegirGrupo'

type Props = {
  /** Los módulos del grupo elegido (vacío si aún no hay datos de ese grupo) */
  modulos: string[]
  grupo: Grupo
  onGrupo: (g: Grupo) => void
  excluidas: Excluidas
  onAlternar: (id: string) => void
  onRestablecer: () => void
  onVolver: (centro: { x: number; y: number }) => void
  avisar: (texto: string) => void
}

function Grupo({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <motion.section variants={aparecer} className="border-t border-linea pt-6">
      <h2 className="font-titulo text-xl leading-none font-bold">{titulo}</h2>
      <p className="mt-1.5 mb-5 text-sm text-tinta-suave">{descripcion}</p>
      {children}
    </motion.section>
  )
}

/**
 * Cuántas columnas usar para que todas las filas tengan (casi) los mismos elementos.
 * Ej.: 10 con máximo 5 → 2 filas → 5 columnas; 7 con máximo 5 → 2 filas → 4 columnas (4 + 3).
 */
function columnasEquilibradas(n: number, max: number) {
  const filas = Math.ceil(n / max)
  return Math.ceil(n / filas)
}

/** Botón grande de cuenta externa: aún no conecta, solo avisa. */
function BotonCuenta({ nombre, detalle, onClick }: { nombre: string; detalle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        sonar('disabled', { x: e.clientX }) // aún no disponible: sonido "apagado" + aviso
        onClick()
      }}
      className="group flex w-full items-center justify-between gap-4 border border-linea bg-fondo-alto/60 px-5 py-4 text-left transition-colors hover:border-tinta/40 hover:bg-fondo-alto"
    >
      <span>
        <span className="block font-medium">{nombre}</span>
        <span className="block text-xs text-tinta-suave">{detalle}</span>
      </span>
      <span className="flex items-center gap-3 text-xs text-tinta-suave">
        Próximamente
        <span className="transition-transform duration-300 ease-salida group-hover:translate-x-1">→</span>
      </span>
    </button>
  )
}

/** Página aparte, minimalista: módulos que cursas y cuentas para sincronizar. */
export function Ajustes({ modulos, grupo, onGrupo, excluidas, onAlternar, onRestablecer, onVolver, avisar }: Props) {
  const sonido = useSonido()
  const centro = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  return (
    <main className="grid min-h-svh place-items-center px-4 py-16">
      <motion.div variants={cascada} initial="oculto" animate="visible" className="w-full max-w-xl space-y-10">
        <motion.header variants={aparecer} className="text-center">
          <LogoMarca className="mx-auto h-10 w-auto" />
          <h1 className="mt-6 font-titulo text-5xl leading-none font-bold tracking-tight">Ajustes</h1>
          <p className="mt-3 text-sm text-tinta-suave">Configura el panel y conecta tus cuentas.</p>
        </motion.header>

        <Grupo
          titulo="Tu grupo"
          descripcion="Ciclo, curso y grupo: de esto dependen el horario y el calendario de exámenes que ves."
        >
          <ElegirGrupo grupo={grupo} onCambio={onGrupo} />
        </Grupo>

        <Grupo
          titulo="Tus módulos"
          descripcion={`${nombreGrupo(grupo)}. Los que no cursas se apagan para siempre en el horario, el calendario y la agenda.`}
        >
          {modulos.length === 0 && <p className="text-sm text-tinta-suave">Aún no hay módulos de este grupo.</p>}
          {/* Rejilla equilibrada: mismas columnas en cada fila (10 → 2×5 en escritorio, 5×2 en móvil) */}
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
            style={{ '--cols': columnasEquilibradas(modulos.length, 5) } as CSSProperties}
          >
            {modulos.map((id) => {
              const activa = !excluidas.has(id)
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={activa}
                  onClick={(e) => {
                    sonar(activa ? 'toggle_off' : 'toggle_on', { x: e.clientX })
                    onAlternar(id)
                  }}
                  title={nombreAsignatura(id)}
                  style={{ '--c': colorAsignatura(id) } as CSSProperties}
                  className={`flex min-w-0 items-center gap-2 border px-3 py-2 text-sm transition-colors ${
                    activa
                      ? 'border-(--c)/50 bg-(--c)/10 text-tinta hover:bg-(--c)/20'
                      : 'border-dashed border-linea text-tinta-suave line-through hover:text-tinta'
                  }`}
                >
                  <span className={`size-2 ${activa ? 'bg-(--c)' : 'bg-linea'}`} aria-hidden="true" />
                  <span className="font-mono text-xs">{id}</span>
                </button>
              )
            })}
          </div>
          {excluidas.size > 0 && (
            <button
              type="button"
              onClick={onRestablecer}
              className="mt-4 text-xs text-tinta-suave underline-offset-4 transition-colors hover:text-tinta hover:underline"
            >
              Activar todos
            </button>
          )}
        </Grupo>

        <Grupo titulo="Sonido" descripcion="Sonidos cortos que responden a lo que haces. Sin música de fondo.">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border border-linea bg-fondo-alto/60 px-5 py-4">
            <button
              type="button"
              role="switch"
              aria-checked={sonido.activo}
              onClick={(e) => {
                const activo = !sonido.activo
                activarSonido(activo)
                if (activo) sonar('toggle_on', { x: e.clientX })
              }}
              className="flex items-center gap-3 text-sm"
            >
              {/* Interruptor: la bola se desplaza con translate */}
              <span
                className={`relative h-5 w-9 border transition-colors ${sonido.activo ? 'border-arena bg-arena/20' : 'border-linea bg-fondo'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 size-3.5 transition-transform duration-200 ease-salida ${sonido.activo ? 'translate-x-4 bg-arena' : 'bg-tinta-suave'}`}
                />
              </span>
              {sonido.activo ? 'Activado' : 'Silenciado'}
            </button>
            <label className={`flex flex-1 items-center gap-3 text-xs text-tinta-suave ${sonido.activo ? '' : 'opacity-40'}`}>
              Volumen
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={sonido.volumen}
                disabled={!sonido.activo}
                onChange={(e) => {
                  cambiarVolumen(Number(e.target.value))
                  sonar('tap', { cada: 70 }) // se oye el volumen nuevo mientras mueves
                }}
                className="min-w-32 flex-1 accent-arena"
              />
              <span className="w-8 text-right font-mono text-tinta">{Math.round(sonido.volumen * 100)}%</span>
            </label>
          </div>
          <p className="mt-3 text-xs text-tinta-suave">
            Sonidos de interfaz:{' '}
            <a
              href="https://snd.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:text-tinta hover:underline"
            >
              SND
            </a>{' '}
            (Dentsu Lab Tokyo), de uso libre.
          </p>
        </Grupo>

        <Grupo titulo="Sincronizar" descripcion="Trae tu calendario de exámenes automáticamente en vez de copiarlo a mano.">
          <div className="space-y-2">
            <BotonCuenta
              nombre="Microsoft 365"
              detalle="Teams, Outlook y el Excel del calendario del centro"
              onClick={() => avisar('La conexión con Microsoft 365 llegará en la versión 2')}
            />
            <BotonCuenta
              nombre="Google Calendar"
              detalle="Tus exámenes y entregas en tu calendario personal"
              onClick={() => avisar('La conexión con Google Calendar llegará en la versión 2')}
            />
            <BotonCuenta
              nombre="Importar archivo .ics"
              detalle="Un calendario exportado desde cualquier aplicación"
              onClick={() => avisar('La importación de .ics llegará en la versión 2')}
            />
          </div>
        </Grupo>

        <motion.div variants={aparecer} className="text-center">
          <button
            type="button"
            onClick={(e) => onVolver(centro(e.currentTarget))}
            className="bg-tinta px-6 py-3 text-sm font-medium text-fondo transition-colors hover:bg-arena"
          >
            ← Volver al panel
          </button>
        </motion.div>
      </motion.div>
    </main>
  )
}
