import { useEffect, useRef } from 'react'

/* Transición de página "pixel art": una mancha de cuadrados crece desde un
   punto (el logo) hasta tragarse la pantalla; cuando está cubierta se cambia
   de página y la mancha se retira desde el centro, revelando la nueva.

   El borde no es una línea: usa el mismo tramado de Bayer que el fondo, así que
   avanza como una onda de píxeles. En el frente, algunos píxeles se pintan en
   arena (el color del logo) para que se note "quién" se come la pantalla.     */

const CELDA = 14
const BORDE = 220 // px de franja tramada entre lo cubierto y lo libre
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

export type FaseCortina = { fase: 'cubrir' | 'descubrir'; x: number; y: number }

type Props = {
  estado: FaseCortina | null
  /** La pantalla está totalmente cubierta: momento de cambiar de página */
  onCubierta: () => void
  /** La nueva página ya está a la vista */
  onFin: () => void
}

export function CortinaPixel({ estado, onCubierta, onFin }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  // Las funciones de aviso pueden cambiar en cada render; el efecto lee siempre la última
  const avisos = useRef({ onCubierta, onFin })
  useEffect(() => {
    avisos.current = { onCubierta, onFin }
  })

  useEffect(() => {
    const cv = ref.current
    const g = cv?.getContext('2d')
    if (!cv || !g || !estado) return

    const estilos = getComputedStyle(document.documentElement)
    const fondo = estilos.getPropertyValue('--color-fondo').trim()
    const arena = estilos.getPropertyValue('--color-arena').trim()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = innerWidth * dpr
    cv.height = innerHeight * dpr
    g.setTransform(dpr, 0, 0, dpr, 0, 0)

    const cols = Math.ceil(innerWidth / CELDA)
    const filas = Math.ceil(innerHeight / CELDA)
    // Distancia hasta la esquina más lejana: con ese radio la pantalla queda cubierta
    const lejos = Math.max(
      Math.hypot(estado.x, estado.y),
      Math.hypot(innerWidth - estado.x, estado.y),
      Math.hypot(estado.x, innerHeight - estado.y),
      Math.hypot(innerWidth - estado.x, innerHeight - estado.y),
    )
    const duracion = estado.fase === 'cubrir' ? 650 : 600
    const t0 = performance.now()
    let raf = 0

    const pintar = (p: number) => {
      g.clearRect(0, 0, innerWidth, innerHeight)
      // cubrir: el radio crece (aceleración); descubrir: el hueco crece desde el centro (deceleración)
      const e = estado.fase === 'cubrir' ? p * p * p : 1 - (1 - p) ** 3
      const r = e * (lejos + BORDE)
      for (let j = 0; j < filas; j++) {
        for (let i = 0; i < cols; i++) {
          const d = Math.hypot((i + 0.5) * CELDA - estado.x, (j + 0.5) * CELDA - estado.y)
          // v: 1 = cubierto del todo, 0 = libre; en medio, la franja tramada
          const v = estado.fase === 'cubrir' ? (r - d) / BORDE : (d - r + BORDE) / BORDE
          const umbral = BAYER[(j & 3) * 4 + (i & 3)]
          if (v <= umbral) continue
          // El frente de la onda (justo por encima del umbral) va en arena
          g.fillStyle = v < umbral + 0.18 ? arena : fondo
          g.fillRect(i * CELDA, j * CELDA, CELDA, CELDA)
        }
      }
    }

    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / duracion)
      pintar(p)
      if (p < 1) {
        raf = requestAnimationFrame(paso)
      } else if (estado.fase === 'cubrir') {
        avisos.current.onCubierta()
      } else {
        g.clearRect(0, 0, innerWidth, innerHeight)
        avisos.current.onFin()
      }
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [estado])

  return (
    <canvas
      ref={ref}
      className={`fixed inset-0 z-[60] size-full ${estado ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden="true"
    />
  )
}
