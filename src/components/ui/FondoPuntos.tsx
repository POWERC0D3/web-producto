import { useEffect, useRef } from 'react'

/* Fondo de toda la página, al estilo de la referencia: puntos cuadrados blancos
   agrupados en manchas con degradado de puntos.

   ── TRAMADO ORDENADO (DITHERING) ──────────────────────────────
   Hay una rejilla fina y un campo de "densidad" (0..1) que varía despacio con
   el tiempo. Cada celda compara la densidad con un umbral de la matriz de Bayer
   4×4: si la supera, se pinta el punto. Con densidad baja solo se encienden
   unas pocas celdas repartidas con regularidad; con densidad alta, casi todas.
   Es la misma técnica que usaban las impresoras y pantallas de 1 bit.        */

const PASO = 8 // px entre celdas
const LADO = 2 // px de cada punto cuadrado

// Matriz de Bayer 4×4 normalizada a 0..1: el orden en que se encienden las celdas
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/* Densidad de la trama en (x, y) en el instante t: manchas grandes que derivan despacio.
     n = sin(x·0.0042 + t·0.06) · cos(y·0.0055 − t·0.045)
       + 0.6 · sin((0.7x + y)·0.0065 + t·0.08)
       + 0.3 · cos((x − 0.8y)·0.011 − t·0.05)
   Calcularla celda a celda eran ~20.000 celdas × 5 senos/cosenos en CADA fotograma (lo más caro de
   toda la web: ~10 ms de cada 16). Pero cada onda se puede SEPARAR en una parte que solo depende de
   la columna y otra que solo depende de la fila:
     sin(A + B) = sinA·cosB + cosA·sinB      cos(A − B) = cosA·cosB + sinA·sinB
   Así los senos se calculan una vez por columna y una por fila (~300 en total) y el bucle de las
   celdas solo multiplica y suma. Mismo dibujo, unas 60 veces menos trigonometría. */
type Ondas = { a: Float32Array; b: Float32Array; c: Float32Array; d: Float32Array; e: Float32Array }

/** Las partes de las ondas que dependen solo de x (columnas) o solo de y (filas). */
function ondas(n: number, t: number, deX: boolean, o: Ondas) {
  for (let k = 0; k < n; k++) {
    const v = k * PASO
    if (deX) {
      o.a[k] = Math.sin(v * 0.0042 + t * 0.06) // onda 1: factor de x
      o.b[k] = Math.sin(v * 0.7 * 0.0065 + t * 0.08) // onda 2: sinA y cosA
      o.c[k] = Math.cos(v * 0.7 * 0.0065 + t * 0.08)
      o.d[k] = Math.cos(v * 0.011 - t * 0.05) // onda 3: cosA y sinA
      o.e[k] = Math.sin(v * 0.011 - t * 0.05)
    } else {
      o.a[k] = Math.cos(v * 0.0055 - t * 0.045) // onda 1: factor de y
      o.b[k] = Math.cos(v * 0.0065) // onda 2: cosB y sinB
      o.c[k] = Math.sin(v * 0.0065)
      o.d[k] = Math.cos(v * 0.8 * 0.011) // onda 3: cosB y sinB
      o.e[k] = Math.sin(v * 0.8 * 0.011)
    }
  }
}

const crearOndas = (n: number): Ondas => ({
  a: new Float32Array(n),
  b: new Float32Array(n),
  c: new Float32Array(n),
  d: new Float32Array(n),
  e: new Float32Array(n),
})

export function FondoPuntos() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    const g = cv?.getContext('2d')
    if (!cv || !g) return

    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tinta = getComputedStyle(document.documentElement).getPropertyValue('--color-tinta').trim() || '#ededed'

    let cols = 0, filas = 0, dpr = 1
    let raf = 0
    let tiempo = 0
    let enX = crearOndas(0)
    let enY = crearOndas(0)

    const medir = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(innerWidth * dpr)
      cv.height = Math.round(innerHeight * dpr)
      cols = Math.ceil(innerWidth / PASO) + 1
      filas = Math.ceil(innerHeight / PASO) + 1
      enX = crearOndas(cols)
      enY = crearOndas(filas)
    }

    const pintar = () => {
      ondas(cols, tiempo, true, enX)
      ondas(filas, tiempo, false, enY)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, innerWidth, innerHeight)
      g.fillStyle = tinta
      g.globalAlpha = 0.32
      // Todos los cuadrados en un solo path: una única llamada a fill() por fotograma
      g.beginPath()
      for (let j = 0; j < filas; j++) {
        for (let i = 0; i < cols; i++) {
          const n =
            enX.a[i] * enY.a[j] + // onda 1 (ya era un producto x · y)
            0.6 * (enX.b[i] * enY.b[j] + enX.c[i] * enY.c[j]) + // onda 2: sin(A + B)
            0.3 * (enX.d[i] * enY.d[j] + enX.e[i] * enY.e[j]) // onda 3: cos(A − B)
          if (suave(0.35, 1.5, n) * 0.6 > BAYER[(j & 3) * 4 + (i & 3)]) g.rect(i * PASO, j * PASO, LADO, LADO)
        }
      }
      g.fill()
      g.globalAlpha = 1
    }

    // A 30 fps: la deriva es tan lenta que pintar 60 veces por segundo no se nota, solo cuesta
    let antes = performance.now()
    let par = false
    const bucle = (t: number) => {
      tiempo += Math.min(0.05, (t - antes) / 1000)
      antes = t
      par = !par
      if (par) pintar()
      raf = requestAnimationFrame(bucle)
    }

    const redimensionar = () => {
      medir()
      if (reducido) pintar()
    }

    medir()
    window.addEventListener('resize', redimensionar)
    if (reducido) pintar() // con movimiento reducido: trama quieta
    else raf = requestAnimationFrame(bucle)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', redimensionar)
    }
  }, [])

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 -z-10 size-full" aria-hidden="true" />
}
