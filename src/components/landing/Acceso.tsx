import type { FormEvent } from 'react'
import { motion } from 'motion/react'
import { irA } from '../../hooks/useRuta'
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
      <input
        type={tipo}
        autoComplete={autocompletar}
        onFocus={() => sonar('tap', { volumen: 0.4 })}
        className="w-full border border-linea bg-fondo px-3 py-2.5 text-sm transition-colors outline-none focus:border-arena"
      />
    </label>
  )
}

type Props = { modo: ModoCuenta; avisar: (texto: string) => void; className?: string }

/** La tarjeta de cuenta (de muestra: al enviarla, solo avisa). En la landing sube y sustituye a la lista. */
export function TarjetaCuenta({ modo, avisar, className = '' }: Props) {
  const crear = modo === 'crear'

  const enviar = (e: FormEvent) => {
    e.preventDefault() // sin esto, el navegador recargaría la página al enviar el formulario
    sonar('button')
    avisar(crear ? 'La creación de cuentas llegará pronto' : 'El inicio de sesión llegará pronto')
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

      <form onSubmit={enviar} className="mt-5 space-y-3">
        {crear && <Campo etiqueta="Nombre" tipo="text" autocompletar="name" />}
        <Campo etiqueta="Correo del centro" tipo="email" autocompletar="email" />
        <Campo etiqueta="Contraseña" tipo="password" autocompletar={crear ? 'new-password' : 'current-password'} />
        <button
          type="submit"
          className="mt-2 w-full bg-arena py-3 text-sm font-semibold text-oscuro-fijo transition-colors hover:bg-tinta"
        >
          {crear ? 'Crear cuenta' : 'Entrar'}
        </button>
        <p className="text-center text-xs text-tinta-suave">Las cuentas llegarán en la versión 2.</p>
      </form>
    </div>
  )
}
