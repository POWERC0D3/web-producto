import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'

type Props = {
  texto: string
  /** ms antes de empezar (para escribir varias líneas una detrás de otra) */
  retraso?: number
  /** ms por letra: la velocidad de la "pluma" */
  ritmo?: number
  className?: string
}

/**
 * Texto que se escribe letra a letra, como a mano.
 *
 * El texto ENTERO está siempre en el DOM, partido en dos: lo ya escrito y lo que falta (transparente).
 * En cada frame solo se mueve el corte entre los dos trozos. Como el texto completo siempre ocupa lo
 * mismo, el navegador no tiene que recolocar nada (sin layout): solo repinta unas letras.
 * Se escribe directamente en el DOM (textContent), sin estado de React: son ~60 cambios por segundo.
 *
 * Es el mismo mecanismo que el antiguo efecto Scramble (el más barato de todos los que se probaron):
 * un <span> por letra, una máscara animada o palabras con opacidad costaban bastante más al cambiar de día.
 */
export function Escritura({ texto, retraso = 0, ritmo = 18, className = '' }: Props) {
  const escrito = useRef<HTMLSpanElement>(null)
  const falta = useRef<HTMLSpanElement>(null)
  const reducido = useReducedMotion()

  useEffect(() => {
    const a = escrito.current
    const b = falta.current
    if (!a || !b || reducido) return
    let raf = 0
    let corte = -1
    const t0 = performance.now() + retraso
    const paso = (t: number) => {
      const n = Math.max(0, Math.min(texto.length, Math.floor((t - t0) / ritmo)))
      if (n !== corte) {
        // Solo se toca el DOM cuando avanza una letra (no en cada frame)
        corte = n
        a.textContent = texto.slice(0, n)
        b.textContent = texto.slice(n)
      }
      if (n < texto.length) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => {
      cancelAnimationFrame(raf)
      a.textContent = texto
      b.textContent = ''
    }
  }, [texto, retraso, ritmo, reducido])

  return (
    <span className={className}>
      <span className="sr-only">{texto}</span>
      <span aria-hidden="true">
        {/* Antes de empezar, todo está en "falta" (invisible pero ocupando su sitio) */}
        <span ref={escrito}>{reducido ? texto : ''}</span>
        <span ref={falta} className="text-transparent">
          {reducido ? '' : texto}
        </span>
      </span>
    </span>
  )
}
