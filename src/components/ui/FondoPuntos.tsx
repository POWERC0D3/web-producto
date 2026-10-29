import { useEffect, useRef } from 'react'

/* Fondo de toda la página, al estilo de la referencia: puntos cuadrados blancos
   agrupados en manchas con degradado de puntos.

   ── TRAMADO ORDENADO (DITHERING) ──────────────────────────────
   Hay una rejilla fina y un campo de "densidad" (0..1) que varía despacio con
   el tiempo. Cada celda compara la densidad con un umbral de la matriz de Bayer
   4×4: si la supera, se pinta el punto. Con densidad baja solo se encienden
   unas pocas celdas repartidas con regularidad; con densidad alta, casi todas.
   Es la misma técnica que usaban las impresoras y pantallas de 1 bit.

   ── ESTELA ──────────────────────────────────────────────────
   El ratón suma "calor": rellena la trama y, donde quema más, los puntos se
   convierten en caracteres ( . : - = + * # % @ ) que luego se enfrían.       */

const PASO = 8 // px entre celdas
const LADO = 2 // px de cada punto cuadrado
const RAMPA = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@']
const RADIO = 80
const ESTELA_S = 1.4

// Matriz de Bayer 4×4 normalizada a 0..1: el orden en que se encienden las celdas
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Densidad de la trama en (x, y) en el instante t: manchas grandes que derivan despacio. */
function densidad(x: number, y: number, t: number) {
  const n =
    Math.sin(x * 0.0042 + t * 0.06) * Math.cos(y * 0.0055 - t * 0.045) +
    0.6 * Math.sin((x * 0.7 + y) * 0.0065 + t * 0.08) +
    0.3 * Math.cos((x - y * 0.8) * 0.011 - t * 0.05)
  return suave(0.35, 1.5, n) * 0.6
}

export function FondoPuntos() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    const g = cv?.getContext('2d')
    if (!cv || !g) return

    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tinta = getComputedStyle(document.documentElement).getPropertyValue('--color-tinta').trim() || '#ededed'

    let cols = 0, filas = 0, dpr = 1
    let calor = new Float32Array(0)
    const raton = { ux: NaN, uy: NaN }
    let raf = 0
    let tiempo = 0

    const medir = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(innerWidth * dpr)
      cv.height = Math.round(innerHeight * dpr)
      cols = Math.ceil(innerWidth / PASO) + 1
      filas = Math.ceil(innerHeight / PASO) + 1
      calor = new Float32Array(cols * filas)
    }

    const sellar = (x: number, y: number) => {
      const c0 = Math.max(0, Math.floor((x - RADIO) / PASO))
      const c1 = Math.min(cols - 1, Math.ceil((x + RADIO) / PASO))
      const f0 = Math.max(0, Math.floor((y - RADIO) / PASO))
      const f1 = Math.min(filas - 1, Math.ceil((y + RADIO) / PASO))
      for (let j = f0; j <= f1; j++) {
        for (let i = c0; i <= c1; i++) {
          const q = ((i * PASO - x) ** 2 + (j * PASO - y) ** 2) / (RADIO * RADIO)
          if (q < 1) calor[j * cols + i] = Math.min(1, calor[j * cols + i] + 0.3 * (1 - q) * (1 - q))
        }
      }
    }

    const pintar = () => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, innerWidth, innerHeight)
      g.fillStyle = tinta

      // 1) La trama: todos los cuadrados en un solo path
      g.globalAlpha = 0.32
      g.beginPath()
      const calientes: number[] = []
      for (let j = 0; j < filas; j++) {
        const y = j * PASO
        for (let i = 0; i < cols; i++) {
          const x = i * PASO
          const k = j * cols + i
          const h = calor[k]
          if (h > 0.3) {
            calientes.push(k, h)
            continue
          }
          if (densidad(x, y, tiempo) + h * 1.6 > BAYER[(j & 3) * 4 + (i & 3)]) g.rect(x, y, LADO, LADO)
        }
      }
      g.fill()

      // 2) Donde más quema la estela: caracteres
      g.font = `500 10px "JetBrains Mono Variable", monospace`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      for (let n = 0; n < calientes.length; n += 2) {
        const k = calientes[n]
        const h = calientes[n + 1]
        const idx = Math.max(1, Math.min(RAMPA.length - 1, Math.floor(h * (RAMPA.length - 1) + Math.random() * 1.2)))
        g.globalAlpha = 0.15 + h * 0.45
        g.fillText(RAMPA[idx], (k % cols) * PASO + 1, Math.floor(k / cols) * PASO + 1)
      }
      g.globalAlpha = 1
    }

    let antes = performance.now()
    const bucle = (t: number) => {
      const dt = Math.min(0.05, (t - antes) / 1000)
      antes = t
      tiempo += dt
      const conserva = Math.exp((-dt * 3) / ESTELA_S)
      for (let k = 0; k < calor.length; k++) {
        const h = calor[k] * conserva
        calor[k] = h < 0.003 ? 0 : h
      }
      pintar()
      raf = requestAnimationFrame(bucle)
    }

    const mover = (e: PointerEvent) => {
      if (Number.isNaN(raton.ux)) {
        raton.ux = e.clientX
        raton.uy = e.clientY
      }
      // Sella a lo largo del trazo para que un gesto rápido no deje huecos
      const n = Math.max(1, Math.ceil(Math.hypot(e.clientX - raton.ux, e.clientY - raton.uy) / (RADIO / 3)))
      for (let i = 1; i <= n; i++) {
        sellar(raton.ux + ((e.clientX - raton.ux) * i) / n, raton.uy + ((e.clientY - raton.uy) * i) / n)
      }
      raton.ux = e.clientX
      raton.uy = e.clientY
    }
    const salir = () => {
      raton.ux = NaN
    }
    const redimensionar = () => {
      medir()
      if (reducido) pintar()
    }

    medir()
    window.addEventListener('resize', redimensionar)
    if (reducido) {
      pintar() // con movimiento reducido: trama quieta, sin estela
    } else {
      window.addEventListener('pointermove', mover)
      document.addEventListener('pointerleave', salir)
      raf = requestAnimationFrame(bucle)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', redimensionar)
      window.removeEventListener('pointermove', mover)
      document.removeEventListener('pointerleave', salir)
    }
  }, [])

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 -z-10 size-full" aria-hidden="true" />
}
