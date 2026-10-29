import { useEffect, useRef } from 'react'
import { useInView, useReducedMotion } from 'motion/react'

const SIMBOLOS = 'A01I+◆●%#=:'

type Props = {
  texto: string
  /** ms que tarda en decodificarse el texto entero */
  duracion?: number
  /** Si se indica, vuelve a "romperse" cada `repetir` ms (el haz del faro) */
  repetir?: number
  /** Cambia este valor para forzar otra decodificación (p. ej. al pasar el ratón) */
  disparo?: number
  className?: string
}

/**
 * Texto que se "decodifica": empieza como símbolos aleatorios y cada letra
 * se fija de izquierda a derecha. Se dispara al entrar en pantalla y cada
 * vez que cambia `texto`.
 *
 * Escribe directamente en el DOM (ref.textContent) en vez de usar estado de
 * React: son ~40 cambios por segundo y no hace falta re-renderizar nada más.
 */
export function Scramble({ texto, duracion = 700, repetir, disparo = 0, className = '' }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const enVista = useInView(ref, { once: true, amount: 0.5 })
  const reducido = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || !enVista || reducido) return

    let raf = 0
    const animar = () => {
      cancelAnimationFrame(raf)
      const t0 = performance.now()
      const paso = (t: number) => {
        const p = Math.min(1, (t - t0) / duracion)
        const fijas = Math.floor(p * texto.length)
        let salida = texto.slice(0, fijas)
        for (let i = fijas; i < texto.length; i++) {
          salida += texto[i] === ' ' ? ' ' : SIMBOLOS[Math.floor(Math.random() * SIMBOLOS.length)]
        }
        el.textContent = salida
        if (p < 1) raf = requestAnimationFrame(paso)
      }
      raf = requestAnimationFrame(paso)
    }

    animar()
    const id = repetir ? window.setInterval(animar, repetir) : 0
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(id)
      el.textContent = texto
    }
  }, [texto, duracion, repetir, disparo, enVista, reducido])

  return (
    <span className={className}>
      <span className="sr-only">{texto}</span>
      <span ref={ref} aria-hidden="true">
        {texto}
      </span>
    </span>
  )
}
