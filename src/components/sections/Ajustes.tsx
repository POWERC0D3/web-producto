import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'motion/react'
import { asignaturas, colorAsignatura } from '../../lib/datos'
import type { Excluidas } from '../../lib/horario'
import { aparecer, cascada } from '../../lib/movimiento'
import { LogoMarca } from '../ui/LogoMarca'

type Props = {
  excluidas: Excluidas
  onAlternar: (id: string) => void
  onRestablecer: () => void
  onVolver: (centro: { x: number; y: number }) => void
  avisar: (texto: string) => void
}

function Grupo({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <motion.section variants={aparecer} className="border-t border-linea pt-6">
      <h2 className="font-serif text-2xl leading-none">{titulo}</h2>
      <p className="mt-1.5 mb-5 text-sm text-tinta-suave">{descripcion}</p>
      {children}
    </motion.section>
  )
}

/** Botón grande de cuenta externa: aún no conecta, solo avisa. */
function BotonCuenta({ nombre, detalle, onClick }: { nombre: string; detalle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
export function Ajustes({ excluidas, onAlternar, onRestablecer, onVolver, avisar }: Props) {
  const centro = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  return (
    <main className="grid min-h-svh place-items-center px-4 py-16">
      <motion.div variants={cascada} initial="oculto" animate="visible" className="w-full max-w-xl space-y-10">
        <motion.header variants={aparecer} className="text-center">
          <LogoMarca className="mx-auto h-10 w-auto" />
          <h1 className="mt-6 font-serif text-5xl leading-none tracking-tight">Ajustes</h1>
          <p className="mt-3 text-sm text-tinta-suave">Configura el panel y conecta tus cuentas.</p>
        </motion.header>

        <Grupo titulo="Tus módulos" descripcion="Los que no cursas se apagan en el horario, el calendario y la agenda.">
          <div className="flex flex-wrap gap-2">
            {asignaturas.map((a) => {
              const activa = !excluidas.has(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => onAlternar(a.id)}
                  title={a.nombre}
                  style={{ '--c': colorAsignatura(a.id) } as CSSProperties}
                  className={`flex items-center gap-2 border px-3 py-2 text-sm transition-colors ${
                    activa
                      ? 'border-(--c)/50 bg-(--c)/10 text-tinta hover:bg-(--c)/20'
                      : 'border-dashed border-linea text-tinta-suave line-through hover:text-tinta'
                  }`}
                >
                  <span className={`size-2 ${activa ? 'bg-(--c)' : 'bg-linea'}`} aria-hidden="true" />
                  <span className="font-mono text-xs">{a.id}</span>
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
