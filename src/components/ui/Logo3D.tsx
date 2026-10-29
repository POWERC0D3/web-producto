import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { useReducedMotion } from 'motion/react'
import logoUrl from '../../assets/logo-ies.jpg'

/* El logo del IES Monte Naranco como un objeto 3D hecho de puntos, al estilo
   del cubo de referencia. Es un pequeño motor 3D "a mano":

   1. MODELO: se leen los píxeles del logo. Cada píxel con color es un punto de
      la cara frontal; los del borde de la silueta se repiten hacia atrás
      (extrusión) y forman los laterales, con su normal hacia fuera.
   2. PROYECCIÓN: cada fotograma se giran los puntos (rotación en Y y en X), se
      proyectan en perspectiva y un z-buffer se queda con el más cercano de
      cada celda de la pantalla.
   3. TRAMADO: la luz de cada cara (producto escalar normal·luz, iluminación de
      Lambert) decide la densidad; la matriz de Bayer decide qué celdas llevan
      punto. Cara iluminada → muchos puntos; cara en sombra → pocos.

   Encima siguen la estela del ratón (los puntos se vuelven caracteres
   . : - = + * # % @), la onda al pulsar y las partículas que suben.        */

const W = 420
const H = 300
const S = 3.4 // tamaño de celda de pantalla (unidades lógicas)
const ANCHO_MODELO = 330
const PROF = 40 // grosor de la extrusión
const GIRO_Y = 0.3 // ángulo de reposo: se ve el lateral izquierdo…
const GIRO_X = -0.22 // …y el canto superior
const F = 700 // distancia de la cámara (perspectiva)
const RECORTE = { x: 21, y: 25, w: 158, h: 103 } // zona del dibujo en la imagen 200×200
const RAMPA = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@']
const FRIO = 0.05
const RADIO = 34
const ESTELA_S = 1.2
const ANILLO_S = 2
const MONO = `"JetBrains Mono Variable", ui-monospace, monospace`

const PALETA = [
  { muestra: [0x21, 0x68, 0x4e], pinta: '#2f8c68' }, // verde (algo más claro para leerse sobre negro)
  { muestra: [0xf5, 0xb4, 0x74], pinta: '#f5b474' }, // arena
  { muestra: [0xf3, 0x71, 0x5a], pinta: '#f3715a' }, // coral
]
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

// Luz desde arriba a la izquierda y algo de frente (x → derecha, y → abajo, z → hacia ti)
const LUZ = (() => {
  const v = [-0.45, -0.65, 0.62]
  const m = Math.hypot(...v)
  return v.map((c) => c / m)
})()

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

function hash(k: number, n: number) {
  let h = (k * 374761393 + n * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function clasificar(r: number, g: number, b: number): number {
  let mejor = -1
  let min = (255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2 // distancia al blanco
  PALETA.forEach((p, i) => {
    const d = (r - p.muestra[0]) ** 2 + (g - p.muestra[1]) ** 2 + (b - p.muestra[2]) ** 2
    if (d < min) {
      min = d
      mejor = i
    }
  })
  return mejor
}

// Cada punto ocupa 8 números seguidos en un Float32Array (más rápido que un array de objetos):
// x, y, z, nx, ny, nz, color, multiplicador de luz (las juntas van más oscuras)
const ST = 8

/** Construye la nube de puntos 3D a partir de los píxeles del logo. */
function construirModelo(img: HTMLImageElement): Float32Array {
  const lienzo = document.createElement('canvas')
  lienzo.width = img.naturalWidth
  lienzo.height = img.naturalHeight
  const lg = lienzo.getContext('2d', { willReadFrequently: true })
  if (!lg) return new Float32Array(0)
  lg.drawImage(img, 0, 0)
  const px = lg.getImageData(0, 0, lienzo.width, lienzo.height).data

  const k = ANCHO_MODELO / RECORTE.w // unidades por píxel de imagen
  const paso = (S * 0.7) / k // muestreo en píxeles: algo más fino que la celda, para no dejar huecos
  const nu = Math.ceil(RECORTE.w / paso)
  const nv = Math.ceil(RECORTE.h / paso)
  const rejilla = new Int8Array(nu * nv).fill(-1)
  for (let v = 0; v < nv; v++) {
    for (let u = 0; u < nu; u++) {
      const ix = Math.floor(RECORTE.x + (u + 0.5) * paso)
      const iy = Math.floor(RECORTE.y + (v + 0.5) * paso)
      const p = (iy * lienzo.width + ix) * 4
      rejilla[v * nu + u] = clasificar(px[p], px[p + 1], px[p + 2])
    }
  }
  const en = (u: number, v: number) => (u < 0 || v < 0 || u >= nu || v >= nv ? -1 : rejilla[v * nu + u])

  const puntos: number[] = []
  const altoModelo = RECORTE.h * k
  const capa = S * 0.75
  for (let v = 0; v < nv; v++) {
    for (let u = 0; u < nu; u++) {
      const c = en(u, v)
      if (c < 0) continue
      const x = (u + 0.5) * paso * k - ANCHO_MODELO / 2
      const y = (v + 0.5) * paso * k - altoModelo / 2
      const vecinos = [en(u - 1, v), en(u + 1, v), en(u, v - 1), en(u, v + 1)]
      // Junta: donde cambia el color del logo, como las líneas entre las piezas del cubo
      const junta = vecinos.some((o) => o >= 0 && o !== c)
      puntos.push(x, y, PROF / 2, 0, 0, 1, c, junta ? 0.35 : 1)

      // Borde de la silueta → lateral extruido, con la normal apuntando hacia el hueco
      let nx = 0
      let ny = 0
      if (vecinos[0] < 0) nx -= 1
      if (vecinos[1] < 0) nx += 1
      if (vecinos[2] < 0) ny -= 1
      if (vecinos[3] < 0) ny += 1
      if (nx || ny) {
        const m = Math.hypot(nx, ny)
        for (let z = PROF / 2 - capa; z >= -PROF / 2; z -= capa) puntos.push(x, y, z, nx / m, ny / m, 0, c, 1)
      }
    }
  }
  return new Float32Array(puntos)
}

/** Puntos sueltos flotando alrededor (como en la referencia), fijos en el espacio 3D. */
function crearPolvo(n: number): Float32Array {
  const r = new Float32Array(n * 3)
  let i = 0
  while (i < n) {
    const x = (Math.random() - 0.5) * W * 1.05
    const y = (Math.random() - 0.5) * H * 1.05
    if (Math.abs(x) < ANCHO_MODELO * 0.45 && Math.abs(y) < 105) continue // fuera del cuerpo del logo
    r.set([x, y, (Math.random() - 0.5) * 140], i * 3)
    i++
  }
  return r
}

type Particula = { x: number; y: number; vy: number; fase: number; vida: number; max: number; c: number }

type Estado = {
  modelo: Float32Array
  polvo: Float32Array
  cols: number
  filas: number
  escala: number
  zbuf: Float32Array
  luz: Float32Array
  color: Int8Array
  calor: Float32Array
  arriba: Int16Array // primera fila con logo en cada columna (de ahí salen las partículas)
  yaw: number
  pitch: number
  ux: number
  uy: number
  mx: number
  my: number
  dentro: boolean
  anillos: { x: number; y: number; t: number }[]
  particulas: Particula[]
  t: number
  reparto: number
  raf: number
  visible: boolean
}

function crearEstado(): Estado {
  const cols = Math.floor(W / S)
  const filas = Math.floor(H / S)
  const n = cols * filas
  return {
    modelo: new Float32Array(0),
    polvo: crearPolvo(130),
    cols,
    filas,
    escala: 1,
    zbuf: new Float32Array(n),
    luz: new Float32Array(n),
    color: new Int8Array(n),
    calor: new Float32Array(n),
    arriba: new Int16Array(cols),
    yaw: GIRO_Y,
    pitch: GIRO_X,
    ux: NaN,
    uy: NaN,
    mx: W / 2,
    my: H / 2,
    dentro: false,
    anillos: [],
    particulas: [],
    t: 0,
    reparto: 0,
    raf: 0,
    visible: true,
  }
}

/** Gira, proyecta y rellena el z-buffer: deja en `luz` y `color` lo que se ve en cada celda. */
function rasterizar(s: Estado) {
  const { modelo, cols, filas, zbuf, luz, color, arriba } = s
  zbuf.fill(-Infinity)
  color.fill(-1)
  arriba.fill(-1)
  const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw)
  const cx = Math.cos(s.pitch), sx = Math.sin(s.pitch)

  for (let p = 0; p < modelo.length; p += ST) {
    // Normal girada primero: si mira hacia atrás, el punto no se ve y nos ahorramos el resto
    const nx0 = modelo[p + 3], ny0 = modelo[p + 4], nz0 = modelo[p + 5]
    const nx1 = nx0 * cy + nz0 * sy
    const nz1 = -nx0 * sy + nz0 * cy
    const ny2 = ny0 * cx - nz1 * sx
    const nz2 = ny0 * sx + nz1 * cx
    if (nz2 < -0.05) continue

    const x0 = modelo[p], y0 = modelo[p + 1], z0 = modelo[p + 2]
    const x1 = x0 * cy + z0 * sy
    const z1 = -x0 * sy + z0 * cy
    const y2 = y0 * cx - z1 * sx
    const z2 = y0 * sx + z1 * cx

    const f = F / (F - z2) // perspectiva: lo cercano se ve más grande
    const i = Math.floor((W / 2 + x1 * f) / S)
    const j = Math.floor((H / 2 + y2 * f) / S)
    if (i < 0 || j < 0 || i >= cols || j >= filas) continue
    const k = j * cols + i
    if (z2 <= zbuf[k]) continue
    zbuf[k] = z2
    // Como en la referencia: la cara frontal es densa (se lee la forma) y los
    // laterales, tramados según la luz que reciben (se nota el volumen)
    const lambert = Math.max(0, nx1 * LUZ[0] + ny2 * LUZ[1] + nz2 * LUZ[2])
    const frente = nz0 > 0.5
    luz[k] = (frente ? 0.93 : 0.12 + 0.55 * lambert) * modelo[p + 7]
    color[k] = modelo[p + 6]
    if (arriba[i] < 0 || j < arriba[i]) arriba[i] = j
  }
}

function pintar(cv: HTMLCanvasElement, s: Estado) {
  const g = cv.getContext('2d')
  if (!g) return
  g.setTransform(s.escala, 0, 0, s.escala, 0, 0)
  g.clearRect(0, 0, W, H)

  const { cols, filas, luz, color, calor } = s
  const lado = S * 0.62
  const anillos = s.anillos.map((a) => {
    const p = a.t / ANILLO_S
    return { x: a.x, y: a.y, R: 6 + (1 - (1 - p) ** 3) * 280, amp: 0.6 * (1 - p) ** 2 * Math.min(1, p * 6) }
  })
  const calientes: number[] = []

  // 1) Puntos del logo: un path por color (rápido) y el tramado decide cuáles se encienden
  for (let c = 0; c < PALETA.length; c++) {
    g.fillStyle = PALETA[c].pinta
    g.beginPath()
    for (let j = 0; j < filas; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i
        if (color[k] !== c) continue
        let h = calor[k]
        const x = (i + 0.5) * S
        const y = (j + 0.5) * S
        if (s.dentro) {
          const q = ((x - s.mx) ** 2 + (y - s.my) ** 2) / (RADIO * RADIO)
          if (q < 1) h = Math.max(h, 0.9 * (1 - q) * (1 - q))
        }
        for (const a of anillos) {
          const d = (Math.hypot(x - a.x, y - a.y) - a.R) / 18
          if (d > -2.5 && d < 2.5) h += a.amp * Math.exp(-d * d)
        }
        if (h > FRIO) {
          calientes.push(k, h)
          continue
        }
        if (luz[k] > BAYER[(j & 3) * 4 + (i & 3)]) g.rect(i * S, j * S, lado, lado)
      }
    }
    g.fill()
  }

  // 2) Estela: caracteres más densos cuanto más calor, con un parpadeo tipo terminal
  g.font = `600 ${S * 1.9}px ${MONO}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const tope = RAMPA.length - 1
  for (let n = 0; n < calientes.length; n += 2) {
    const k = calientes[n]
    const h = Math.min(1, calientes[n + 1])
    const idx = clamp(Math.floor(h * tope + 0.5 + (hash(k, s.reparto) - 0.5) * 1.6), 1, tope)
    g.fillStyle = PALETA[color[k]].pinta
    g.fillText(RAMPA[idx], ((k % cols) + 0.5) * S, (Math.floor(k / cols) + 0.5) * S)
  }

  // 3) Polvo alrededor: gira con el objeto, así se nota la profundidad
  const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw)
  const cx = Math.cos(s.pitch), sx = Math.sin(s.pitch)
  g.fillStyle = '#a1a1a1'
  g.globalAlpha = 0.55
  g.beginPath()
  for (let p = 0; p < s.polvo.length; p += 3) {
    const x0 = s.polvo[p], y0 = s.polvo[p + 1], z0 = s.polvo[p + 2]
    const x1 = x0 * cy + z0 * sy
    const z1 = -x0 * sy + z0 * cy
    const y2 = y0 * cx - z1 * sx
    const z2 = y0 * sx + z1 * cx
    const f = F / (F - z2)
    const x = Math.floor((W / 2 + x1 * f) / S) * S
    const y = Math.floor((H / 2 + y2 * f) / S) * S
    g.rect(x, y, lado * 0.8, lado * 0.8)
  }
  g.fill()

  // 4) Partículas que suben desde lo alto del logo
  for (const p of s.particulas) {
    const v = p.vida / p.max
    g.globalAlpha = Math.min(1, v * 4) * (1 - v)
    g.fillStyle = PALETA[p.c].pinta
    g.fillRect(Math.floor((p.x + Math.sin(p.fase + p.vida * 1.6) * 3) / S) * S, Math.floor(p.y / S) * S, lado, lado)
  }
  g.globalAlpha = 1
}

function avanzar(s: Estado, dt: number) {
  s.t += dt
  // Giro: un vaivén lento + inclinación hacia el ratón (suavizada para que no dé tirones)
  const tx = s.dentro ? (s.mx / W - 0.5) * 2 : 0
  const ty = s.dentro ? (s.my / H - 0.5) * 2 : 0
  const yawObjetivo = GIRO_Y + 0.1 * Math.sin(s.t * 0.5) + tx * 0.3
  const pitchObjetivo = GIRO_X + 0.04 * Math.sin(s.t * 0.37) - ty * 0.18
  const suave = 1 - Math.pow(0.02, dt)
  s.yaw += (yawObjetivo - s.yaw) * suave
  s.pitch += (pitchObjetivo - s.pitch) * suave

  const conserva = Math.exp((-dt * 3) / ESTELA_S)
  for (let k = 0; k < s.calor.length; k++) {
    const h = s.calor[k] * conserva
    s.calor[k] = h < 0.003 ? 0 : h
  }
  s.anillos = s.anillos.filter((a) => (a.t += dt) < ANILLO_S)
  s.reparto = Math.floor(s.t / 0.07)

  // Unas 6 partículas por segundo desde el borde superior
  if (Math.random() < dt * 6) {
    const i = Math.floor(Math.random() * s.cols)
    const j = s.arriba[i]
    if (j >= 0) {
      s.particulas.push({
        x: (i + 0.5) * S,
        y: j * S,
        vy: -(10 + Math.random() * 20),
        fase: Math.random() * 6,
        vida: 0,
        max: 2.5 + Math.random() * 3,
        c: s.color[j * s.cols + i],
      })
    }
  }
  for (const p of s.particulas) {
    p.vida += dt
    p.y += p.vy * dt
  }
  s.particulas = s.particulas.filter((p) => p.vida < p.max && p.c >= 0)
}

function sellar(s: Estado, x: number, y: number) {
  const c0 = Math.max(0, Math.floor((x - RADIO) / S))
  const c1 = Math.min(s.cols - 1, Math.ceil((x + RADIO) / S))
  const f0 = Math.max(0, Math.floor((y - RADIO) / S))
  const f1 = Math.min(s.filas - 1, Math.ceil((y + RADIO) / S))
  for (let j = f0; j <= f1; j++) {
    for (let i = c0; i <= c1; i++) {
      const q = (((i + 0.5) * S - x) ** 2 + ((j + 0.5) * S - y) ** 2) / (RADIO * RADIO)
      if (q < 1) s.calor[j * s.cols + i] = Math.min(1, s.calor[j * s.cols + i] + 0.5 * (1 - q) * (1 - q))
    }
  }
}

type Props = {
  className?: string
  /** Al pulsar el logo; recibe el centro del logo en pantalla (para la transición) */
  onActivar?: (centro: { x: number; y: number }) => void
}

export function Logo3D({ className = '', onActivar }: Props) {
  const cv = useRef<HTMLCanvasElement>(null)
  const st = useRef<Estado>(crearEstado())
  const reducido = useReducedMotion()

  useEffect(() => {
    const c = cv.current
    if (!c) return
    const s = st.current
    const img = new Image()
    img.src = logoUrl
    let vivo = true
    let antes = performance.now()

    const dibujar = () => {
      rasterizar(s)
      pintar(c, s)
    }
    const bucle = (t: number) => {
      const dt = Math.min(0.05, (t - antes) / 1000)
      antes = t
      avanzar(s, dt)
      dibujar()
      s.raf = s.visible ? requestAnimationFrame(bucle) : 0
    }
    const arrancar = () => {
      if (s.raf || reducido || !s.modelo.length) return
      antes = performance.now()
      s.raf = requestAnimationFrame(bucle)
    }
    const medir = () => {
      s.escala = clamp((c.clientWidth / W) * (window.devicePixelRatio || 1), 1, 4)
      c.width = Math.round(W * s.escala)
      c.height = Math.round(H * s.escala)
      if (s.modelo.length) dibujar()
    }

    img.decode().then(() => {
      if (!vivo) return
      s.modelo = construirModelo(img)
      medir()
      if (!reducido) s.anillos.push({ x: W / 2, y: H / 2, t: 0 })
      arrancar()
    })

    const ro = new ResizeObserver(medir)
    ro.observe(c)
    // Solo se anima mientras se ve en pantalla
    const io = new IntersectionObserver(([e]) => {
      s.visible = e.isIntersecting
      if (s.visible) arrancar()
    })
    io.observe(c)

    return () => {
      vivo = false
      ro.disconnect()
      io.disconnect()
      cancelAnimationFrame(s.raf)
      s.raf = 0
    }
  }, [reducido])

  const donde = (e: PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    const k = r.width / W
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }
  }

  const mover = (e: PointerEvent) => {
    if (reducido) return
    const s = st.current
    const { x, y } = donde(e)
    if (Number.isNaN(s.ux)) {
      s.ux = x
      s.uy = y
    }
    // Sella a lo largo de todo el trazo para que un gesto rápido no deje huecos
    const n = Math.max(1, Math.ceil(Math.hypot(x - s.ux, y - s.uy) / (RADIO / 3)))
    for (let k = 1; k <= n; k++) sellar(s, s.ux + ((x - s.ux) * k) / n, s.uy + ((y - s.uy) * k) / n)
    s.ux = s.mx = x
    s.uy = s.my = y
    s.dentro = true
  }

  const activar = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    onActivar?.({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
  }

  return (
    <div
      className={`relative cursor-pointer touch-pan-y select-none ${className}`}
      style={{ aspectRatio: `${W} / ${H}` }}
      onPointerEnter={(e) => {
        st.current.ux = NaN
        mover(e)
      }}
      onPointerMove={mover}
      onPointerLeave={() => {
        st.current.dentro = false
        st.current.ux = NaN
      }}
      onPointerDown={(e) => {
        if (!reducido) st.current.anillos.push({ ...donde(e), t: 0 })
      }}
      onClick={(e) => activar(e.currentTarget)}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activar(e.currentTarget)
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Logo del IES Monte Naranco en 3D. Pulsa para abrir los ajustes"
    >
      <canvas ref={cv} className="size-full" aria-hidden="true" />
    </div>
  )
}
