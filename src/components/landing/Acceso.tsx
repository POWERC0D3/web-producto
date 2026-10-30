import type { FormEvent } from 'react'
import { motion } from 'motion/react'
import { irA, type Ruta } from '../../hooks/useRuta'
import { EASE_SALIDA } from '../../lib/movimiento'
import { sonar } from '../../lib/sonido'

export type ModoCuenta = 'entrar' | 'crear'

const PESTANAS: { modo: ModoCuenta; texto: string }[] = [
  { modo: 'crear', texto: 'Crear cuenta' },
  { modo: 'entrar', texto: 'Iniciar sesión' },
]

function Campo({ etiqueta, tipo, autocompletar }: { etiqueta: string; tipo: string; autocompletar: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-tinta-suave">{etiqueta}</span>
      {/* required: el navegador no deja enviar el formulario con el campo vacío (y type="email" exige una @).
          Es la validación nativa de HTML: sin JavaScript, accesible y con sus mensajes en el idioma del navegador */}
      <input
        type={tipo}
        required
        autoComplete={autocompletar}
        onFocus={() => sonar('tap', { volumen: 0.4 })}
        className="w-full border border-linea bg-fondo px-3 py-2.5 text-sm transition-colors outline-none focus:border-arena user-invalid:border-coral"
      />
    </label>
  )
}

type Props = {
  modo: ModoCuenta
  /** Adónde ir al enviar (con la cortina desde el botón): entrar → panel; crear cuenta → ajustes.
   *  `mensaje` se enseña al llegar */
  onAcceder: (destino: Ruta, centro: { x: number; y: number }, mensaje: string) => void
  className?: string
}

/**
 * La tarjeta de cuenta. Aún no hay cuentas de verdad (ni base de datos): los datos son obligatorios
 * pero no se comprueban ni se guardan. Iniciar sesión lleva al panel; crear cuenta, a Ajustes,
 * para elegir grupo y módulos antes de empezar. En la landing sube y sustituye a la lista.
 */
export function TarjetaCuenta({ modo, onAcceder, className = '' }: Props) {
  const crear = modo === 'crear'

  // Solo llega aquí si todos los campos son válidos: si no, el navegador corta el envío antes
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault() // sin esto, el navegador recargaría la página al enviar el formulario
    const boton = (e.nativeEvent as SubmitEvent).submitter ?? e.currentTarget
    const r = boton.getBoundingClientRect()
    onAcceder(
      crear ? 'ajustes' : 'panel',
      { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      crear ? 'Cuenta de muestra creada: elige tu grupo y tus módulos' : 'Sesión de muestra iniciada',
    )
  }

  return (
    <div
      id="acceso"
      className={`w-full border border-arena/50 bg-fondo-alto p-5 shadow-[0_0_60px_-15px_color-mix(in_oklab,var(--color-arena)_45%,transparent)] sm:p-6 ${className}`}
    >
      <div role="tablist" className="grid grid-cols-2 border-b border-linea">
        {PESTANAS.map((p) => (
          <button
            key={p.modo}
            type="button"
            role="tab"
            aria-selected={modo === p.modo}
            onClick={() => {
              if (p.modo !== modo) sonar('swipe', { tono: p.modo === 'crear' ? 1.08 : 0.94 })
              irA(p.modo)
            }}
            className="relative py-2.5 text-sm text-tinta-suave transition-colors hover:text-tinta aria-selected:text-tinta"
          >
            {p.texto}
            {modo === p.modo && (
              <motion.span
                layoutId="pestana-cuenta"
                className="absolute inset-x-0 -bottom-px h-0.5 bg-arena"
                transition={{ duration: 0.35, ease: EASE_SALIDA }}
              />
            )}
          </button>
        ))}
      </div>

      {/* invalid no burbujea: se escucha en fase de captura para sonar una vez por intento fallido */}
      <form onSubmit={enviar} onInvalidCapture={() => sonar('caution', { volumen: 0.5, cada: 400 })} className="mt-5 space-y-3">
        {crear && <Campo etiqueta="Nombre" tipo="text" autocompletar="name" />}
        <Campo etiqueta="Correo del centro" tipo="email" autocompletar="email" />
        <Campo etiqueta="Contraseña" tipo="password" autocompletar={crear ? 'new-password' : 'current-password'} />
        <button
          type="submit"
          className="mt-2 w-full bg-arena py-3 text-sm font-semibold text-oscuro-fijo transition-colors hover:bg-tinta"
        >
          {crear ? 'Crear cuenta' : 'Entrar'}
        </button>
        <p className="text-center text-xs text-tinta-suave">De muestra: los datos no se comprueban ni se guardan.</p>
      </form>
    </div>
  )
}
