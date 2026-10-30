import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useReducedMotion } from 'motion/react'
import logoUrl from '../../assets/logo-ies.jpg'
import { canica, marimba, timbre } from '../../lib/sonido'

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
   . : - = + * # % @), la onda al pulsar y las partículas que suben.

   El lienzo siempre llena su caja y su tamaño lógico ES el de la caja en px:
   una celda mide lo mismo en cualquier tamaño (misma densidad de puntos) y el
   ratón interactúa en toda la caja.                                          */

const S = 3.4 // tamaño de celda de pantalla (unidades lógicas)
const GIRO_Y = 0 // de frente en reposo: el ratón lo gira hacia un lado u otro…
const GIRO_X = -0.3 // …y se ve bien el canto superior (profundidad)
const RECORTE = { x: 21, y: 25, w: 158, h: 103 } // zona del dibujo en la imagen 200×200
const ASPECTO = RECORTE.h / RECORTE.w
const RAMPA = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@']
const FRIO = 0.22 // calor mínimo para que un punto se vuelva carácter (alto: efecto sutil)
const CALOR_RATON = 0.26 // calor bajo el cursor: apenas pasa de FRIO, solo el centro se vuelve carácter
const CALOR_ESTELA = 0.04 // calor que deja el trazo: rastro muy corto
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

/** Medidas de la escena; salen del tamaño de la caja (ver `geometria`). */
type Geo = {
  W: number
  H: number
  ancho: number // ancho del logo
  alto: number
  prof: number // grosor de la extrusión
  F: number // distancia de la cámara (perspectiva)
  cy: number // altura del centro del logo dentro del lienzo
  radio: number // radio de la estela del ratón
  frente: number // densidad de la cara frontal (0..1)
  alfa: number // opacidad de los puntos
  inclina: number // cuánto se inclina hacia el ratón
  giroY: number // ángulos de reposo
  giroX: number
  vaiven: number // amplitud del balanceo lento
  polvo: number // puntos sueltos alrededor
}

// Medidas de referencia (un logo de 330 de ancho): las demás escalan a partir de estas
const BASE: Geo = {
  W: 420,
  H: 300,
  ancho: 330,
  alto: 330 * ASPECTO,
  prof: 72, // grosor: cuanto más, más se nota el volumen al girar
  F: 560, // cámara más cerca = perspectiva más marcada
  cy: 150,
  radio: 18, // estela pequeña
  frente: 0.93,
  alfa: 1,
  inclina: 1,
  giroY: GIRO_Y,
  giroX: GIRO_X,
  vaiven: 1,
  polvo: 130,
}

function geometria(W: number, H: number): Geo {
  const ancho = Math.min(W * 0.86, (H * 0.8) / ASPECTO)
  const k = ancho / BASE.ancho // todo crece en proporción a la referencia
  // Polvo con la misma densidad por px² que la referencia
  const polvo = Math.round((BASE.polvo * W * H) / (BASE.W * BASE.H))
  return {
    ...BASE,
    W,
    H,
    ancho,
    alto: ancho * ASPECTO,
    prof: BASE.prof * k,
    F: BASE.F * k,
    radio: BASE.radio * Math.sqrt(k),
    cy: H * 0.53, // centrado en la caja (algo por debajo de la mitad: el canto superior visible ocupa sitio arriba)
    polvo,
  }
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
function construirModelo(img: HTMLImageElement, geo: Geo): Float32Array {
  const lienzo = document.createElement('canvas')
  lienzo.width = img.naturalWidth
  lienzo.height = img.naturalHeight
  const lg = lienzo.getContext('2d', { willReadFrequently: true })
  if (!lg) return new Float32Array(0)
  lg.drawImage(img, 0, 0)
  const px = lg.getImageData(0, 0, lienzo.width, lienzo.height).data

  const k = geo.ancho / RECORTE.w // unidades por píxel de imagen
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
  const capa = S * 0.75
  for (let v = 0; v < nv; v++) {
    for (let u = 0; u < nu; u++) {
      const c = en(u, v)
      if (c < 0) continue
      const x = (u + 0.5) * paso * k - geo.ancho / 2
      const y = (v + 0.5) * paso * k - geo.alto / 2
      const vecinos = [en(u - 1, v), en(u + 1, v), en(u, v - 1), en(u, v + 1)]
      // Junta: donde cambia el color del logo, como las líneas entre las piezas del cubo
      const junta = vecinos.some((o) => o >= 0 && o !== c)
      puntos.push(x, y, geo.prof / 2, 0, 0, 1, c, junta ? 0.35 : 1)

      // Borde de la silueta → lateral extruido, con la normal apuntando hacia el hueco
      let nx = 0
      let ny = 0
      if (vecinos[0] < 0) nx -= 1
      if (vecinos[1] < 0) nx += 1
      if (vecinos[2] < 0) ny -= 1
      if (vecinos[3] < 0) ny += 1
      if (nx || ny) {
        const m = Math.hypot(nx, ny)
        for (let z = geo.prof / 2 - capa; z >= -geo.prof / 2; z -= capa) puntos.push(x, y, z, nx / m, ny / m, 0, c, 1)
      }
    }
  }
  return new Float32Array(puntos)
}

/** Puntos sueltos flotando alrededor (como en la referencia), fijos en el espacio 3D. */
function crearPolvo(geo: Geo): Float32Array {
  const r = new Float32Array(geo.polvo * 3)
  let i = 0
  while (i < geo.polvo) {
    const x = (Math.random() - 0.5) * geo.W * 1.05
    const y = (Math.random() * 1.05 - 0.025) * geo.H - geo.cy
    if (Math.abs(x) < geo.ancho * 0.45 && Math.abs(y) < geo.alto * 0.49) continue // fuera del cuerpo del logo
    r.set([x, y, (Math.random() - 0.5) * geo.prof * 3.5], i * 3)
    i++
  }
  return r
}

type Particula = { x: number; y: number; vy: number; fase: number; vida: number; max: number; c: number }

/** Parte del logo que se puede pulsar. El polígono va en píxeles de la imagen original (200×200). */
export type ZonaLogo = { id: string; etiqueta: string; poligono: [number, number][] }

/** ¿Está (x, y) dentro del polígono [x0, y0, x1, y1…]? Algoritmo de "lanzar un rayo": cuenta los bordes que cruza. */
function dentroPoligono(x: number, y: number, p: number[]): boolean {
  let dentro = false
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i],
      yi = p[i + 1],
      xj = p[j],
      yj = p[j + 1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}

/** Caja que envuelve un polígono: [minX, minY, maxX, maxY]. */
function caja(p: number[]): [number, number, number, number] {
  const xs = p.filter((_, i) => i % 2 === 0)
  const ys = p.filter((_, i) => i % 2 === 1)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

type Estado = {
  geo: Geo
  modelo: Float32Array
  polvo: Float32Array
  cols: number
  filas: number
  escala: number
  zbuf: Float32Array
  luz: Float32Array
  color: Int8Array
  calor: Float32Array
  caliente: boolean // ¿queda alguna celda con calor? (si no, no se enfría nada)
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
  zonasPx: number[][] // polígono de cada zona ya girado y proyectado, en px de la caja
  activa: number // zona bajo el ratón o con el foco (-1: ninguna)
}

/** Prepara los búferes (uno por celda de pantalla) para unas medidas dadas. */
function ajustar(s: Estado, geo: Geo) {
  s.geo = geo
  s.cols = Math.ceil(geo.W / S)
  s.filas = Math.ceil(geo.H / S)
  const n = s.cols * s.filas
  s.zbuf = new Float32Array(n)
  s.luz = new Float32Array(n)
  s.color = new Int8Array(n)
  s.calor = new Float32Array(n)
  s.arriba = new Int16Array(s.cols)
  s.polvo = crearPolvo(geo)
  s.yaw = geo.giroY
  s.pitch = geo.giroX
  s.mx = geo.W / 2
  s.my = geo.cy
  s.particulas = []
}

function crearEstado(geo: Geo): Estado {
  const s: Estado = {
    geo,
    modelo: new Float32Array(0),
    polvo: new Float32Array(0),
    cols: 0,
    filas: 0,
    escala: 1,
    zbuf: new Float32Array(0),
    luz: new Float32Array(0),
    color: new Int8Array(0),
    calor: new Float32Array(0),
    caliente: false,
    arriba: new Int16Array(0),
    yaw: geo.giroY,
    pitch: geo.giroX,
    ux: NaN,
    uy: NaN,
    mx: 0,
    my: 0,
    dentro: false,
    anillos: [],
    particulas: [],
    t: 0,
    reparto: 0,
    raf: 0,
    visible: true,
    zonasPx: [],
    activa: -1,
  }
  ajustar(s, geo)
  return s
}

/** Gira y proyecta las esquinas de cada zona igual que los puntos de la cara frontal: la zona "sigue" al logo. */
function proyectarZonas(s: Estado, zonas: ZonaLogo[]) {
  const { geo } = s
  const k = geo.ancho / RECORTE.w
  const cy = Math.cos(s.yaw),
    sy = Math.sin(s.yaw)
  const cx = Math.cos(s.pitch),
    sx = Math.sin(s.pitch)
  s.zonasPx = zonas.map((z) =>
    z.poligono.flatMap(([ix, iy]) => {
      const x0 = (ix - RECORTE.x) * k - geo.ancho / 2
      const y0 = (iy - RECORTE.y) * k - geo.alto / 2
      const z0 = geo.prof / 2
      const x1 = x0 * cy + z0 * sy
      const z1 = -x0 * sy + z0 * cy
      const y2 = y0 * cx - z1 * sx
      const z2 = y0 * sx + z1 * cx
      const f = geo.F / (geo.F - z2)
      return [geo.W / 2 + x1 * f, geo.cy + y2 * f]
    }),
  )
}

/** Gira, proyecta y rellena el z-buffer: deja en `luz` y `color` lo que se ve en cada celda. */
function rasterizar(s: Estado) {
  const { modelo, cols, filas, zbuf, luz, color, arriba, geo } = s
  zbuf.fill(-Infinity)
  color.fill(-1)
  arriba.fill(-1)
  const cy = Math.cos(s.yaw),
    sy = Math.sin(s.yaw)
  const cx = Math.cos(s.pitch),
    sx = Math.sin(s.pitch)
  // Lo que se lee para cada punto, sacado del bucle (se recorre ~100 000 veces por fotograma)
  const { F, cy: centroY, prof, frente: densidadFrente } = geo
  const centroX = geo.W / 2
  // La cara frontal (normal 0,0,1) gira igual en todos sus puntos: se calcula una vez por fotograma
  const frenteVisible = 0 * sx + cy * cx >= -0.05

  for (let p = 0; p < modelo.length; p += ST) {
    const nz0 = modelo[p + 5]
    const frente = nz0 > 0.5
    let lambert = 0
    if (frente) {
      if (!frenteVisible) continue
    } else {
      // Normal girada primero: si mira hacia atrás, el punto no se ve y nos ahorramos el resto
      const nx0 = modelo[p + 3],
        ny0 = modelo[p + 4]
      const nx1 = nx0 * cy + nz0 * sy
      const nz1 = -nx0 * sy + nz0 * cy
      const ny2 = ny0 * cx - nz1 * sx
      const nz2 = ny0 * sx + nz1 * cx
      if (nz2 < -0.05) continue
      lambert = Math.max(0, nx1 * LUZ[0] + ny2 * LUZ[1] + nz2 * LUZ[2])
    }

    const x0 = modelo[p],
      y0 = modelo[p + 1],
      z0 = modelo[p + 2]
    const x1 = x0 * cy + z0 * sy
    const z1 = -x0 * sy + z0 * cy
    const y2 = y0 * cx - z1 * sx
    const z2 = y0 * sx + z1 * cx

    const f = F / (F - z2) // perspectiva: lo cercano se ve más grande
    const i = Math.floor((centroX + x1 * f) / S)
    const j = Math.floor((centroY + y2 * f) / S)
    if (i < 0 || j < 0 || i >= cols || j >= filas) continue
    const k = j * cols + i
    if (z2 <= zbuf[k]) continue
    zbuf[k] = z2
    // Como en la referencia: la cara frontal es densa (se lee la forma) y los
    // laterales, tramados según la luz que reciben (se nota el volumen).
    // Laterales: luz de Lambert con más contraste y más oscuros cuanto más al fondo (sensación de profundidad)
    luz[k] = (frente ? densidadFrente : (0.06 + 0.7 * lambert) * (0.55 + 0.45 * ((z0 + prof / 2) / prof))) * modelo[p + 7]
    color[k] = modelo[p + 6]
    if (arriba[i] < 0 || j < arriba[i]) arriba[i] = j
  }
}

function pintar(cv: HTMLCanvasElement, s: Estado) {
  const g = cv.getContext('2d')
  if (!g) return
  const { cols, filas, luz, color, calor, geo } = s
  g.setTransform(s.escala, 0, 0, s.escala, 0, 0)
  g.clearRect(0, 0, geo.W, geo.H)

  const lado = S * 0.62
  const crece = geo.ancho / BASE.ancho
  const anillos = s.anillos.map((a) => {
    const p = a.t / ANILLO_S
    return { x: a.x, y: a.y, R: 6 + (1 - (1 - p) ** 3) * 280 * crece, amp: 0.6 * (1 - p) ** 2 * Math.min(1, p * 6) }
  })
  const calientes: number[] = []

  // 0) Zona activa: qué celdas caen dentro de su polígono
  const zona = s.activa >= 0 ? s.zonasPx[s.activa] : undefined
  const enZona = zona ? new Uint8Array(cols * filas) : null
  if (zona && enZona) {
    const [x0, y0, x1, y1] = caja(zona)
    for (let j = Math.max(0, Math.floor(y0 / S)); j <= Math.min(filas - 1, Math.ceil(y1 / S)); j++) {
      for (let i = Math.max(0, Math.floor(x0 / S)); i <= Math.min(cols - 1, Math.ceil(x1 / S)); i++) {
        if (dentroPoligono((i + 0.5) * S, (j + 0.5) * S, zona)) enZona[j * cols + i] = 1
      }
    }
  }
  // Efecto "foco": con una zona activa, el resto del logo se atenúa y ella conserva su color
  const atenua = enZona ? 0.28 : 1

  // 1) Puntos del logo: dos paths por color (fuera / dentro de la zona) y el tramado decide cuáles se encienden.
  // Una sola pasada por las celdas que reparte cada punto en el path de su color (antes: una pasada por color)
  const fueras = PALETA.map(() => new Path2D())
  const dentros = PALETA.map(() => new Path2D())
  const calientesPorColor: number[][] = PALETA.map(() => [])
  const radio2 = geo.radio * geo.radio
  for (let j = 0; j < filas; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i
      const c = color[k]
      if (c < 0) continue
      let h = calor[k]
      const x = (i + 0.5) * S
      const y = (j + 0.5) * S
      if (s.dentro) {
        const q = ((x - s.mx) ** 2 + (y - s.my) ** 2) / radio2
        if (q < 1) h = Math.max(h, CALOR_RATON * (1 - q) * (1 - q))
      }
      for (const a of anillos) {
        const d = (Math.hypot(x - a.x, y - a.y) - a.R) / 18
        if (d > -2.5 && d < 2.5) h += a.amp * Math.exp(-d * d)
      }
      if (h > FRIO) {
        calientesPorColor[c].push(k, h)
        continue
      }
      if (luz[k] > BAYER[(j & 3) * 4 + (i & 3)]) (enZona?.[k] ? dentros[c] : fueras[c]).rect(i * S, j * S, lado, lado)
    }
  }
  // Se rellena color a color, en el mismo orden de siempre (el último pintado queda encima)
  for (let c = 0; c < PALETA.length; c++) {
    g.fillStyle = PALETA[c].pinta
    g.globalAlpha = geo.alfa * atenua
    g.fill(fueras[c])
    g.globalAlpha = geo.alfa
    g.fill(dentros[c])
    for (const v of calientesPorColor[c]) calientes.push(v) // sin "...": con la onda pueden ser miles
  }

  // 1b) Zona activa: trama muy suave en los huecos (el vano de la puerta) y contorno de puntos
  if (zona && enZona) {
    g.fillStyle = PALETA[1].pinta
    g.globalAlpha = 0.35
    g.beginPath()
    for (let k = 0; k < enZona.length; k++) {
      if (!enZona[k] || color[k] >= 0) continue
      const i = k % cols
      const j = (k - i) / cols
      if (0.2 > BAYER[(j & 3) * 4 + (i & 3)]) g.rect(i * S, j * S, lado, lado)
    }
    g.fill()
    // Contorno punteado: un punto cada ~2 celdas a lo largo de cada lado del polígono
    g.globalAlpha = 0.9
    g.beginPath()
    for (let n = 0; n < zona.length; n += 2) {
      const ax = zona[n],
        ay = zona[n + 1]
      const bx = zona[(n + 2) % zona.length],
        by = zona[(n + 3) % zona.length]
      const pasos = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / (S * 2)))
      for (let t = 0; t < pasos; t++) {
        const x = ax + ((bx - ax) * t) / pasos
        const y = ay + ((by - ay) * t) / pasos
        g.rect(Math.floor(x / S) * S, Math.floor(y / S) * S, lado, lado)
      }
    }
    g.fill()
  }

  // 2) Estela: caracteres más densos cuanto más calor, con un parpadeo tipo terminal
  g.font = `600 ${S * 1.4}px ${MONO}` // caracteres casi del tamaño del punto: no tapan el logo
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const tope = RAMPA.length - 1
  for (let n = 0; n < calientes.length; n += 2) {
    const k = calientes[n]
    const h = Math.min(1, calientes[n + 1])
    const idx = clamp(Math.floor(h * tope + 0.5 + (hash(k, s.reparto) - 0.5) * 1.6), 1, tope)
    g.globalAlpha = 0.35 * (enZona && !enZona[k] ? atenua : 1) // muy transparentes: un rastro, no un foco
    g.fillStyle = PALETA[color[k]].pinta
    g.fillText(RAMPA[idx], ((k % cols) + 0.5) * S, (Math.floor(k / cols) + 0.5) * S)
  }

  // 3) Polvo alrededor: gira con el objeto, así se nota la profundidad
  const cy = Math.cos(s.yaw),
    sy = Math.sin(s.yaw)
  const cx = Math.cos(s.pitch),
    sx = Math.sin(s.pitch)
  g.fillStyle = '#a1a1a1'
  g.globalAlpha = 0.55
  g.beginPath()
  for (let p = 0; p < s.polvo.length; p += 3) {
    const x0 = s.polvo[p],
      y0 = s.polvo[p + 1],
      z0 = s.polvo[p + 2]
    const x1 = x0 * cy + z0 * sy
    const z1 = -x0 * sy + z0 * cy
    const y2 = y0 * cx - z1 * sx
    const z2 = y0 * sx + z1 * cx
    const f = geo.F / (geo.F - z2)
    const x = Math.floor((geo.W / 2 + x1 * f) / S) * S
    const y = Math.floor((geo.cy + y2 * f) / S) * S
    g.rect(x, y, lado * 0.8, lado * 0.8)
  }
  g.fill()

  // 4) Partículas que suben desde lo alto del logo
  for (const p of s.particulas) {
    const v = p.vida / p.max
    g.globalAlpha = Math.min(1, v * 4) * (1 - v) * geo.alfa
    g.fillStyle = PALETA[p.c].pinta
    g.fillRect(Math.floor((p.x + Math.sin(p.fase + p.vida * 1.6) * 3) / S) * S, Math.floor(p.y / S) * S, lado, lado)
  }
  g.globalAlpha = 1
}

function avanzar(s: Estado, dt: number) {
  const { geo } = s
  s.t += dt
  // Giro: un vaivén lento + inclinación hacia el ratón (suavizada para que no dé tirones)
  const tx = s.dentro ? (s.mx / geo.W - 0.5) * 2 * geo.inclina : 0
  const ty = s.dentro ? (s.my / geo.H - 0.5) * 2 * geo.inclina : 0
  const yawObjetivo = geo.giroY + 0.16 * geo.vaiven * Math.sin(s.t * 0.5) + tx * 0.5
  const pitchObjetivo = geo.giroX + 0.05 * geo.vaiven * Math.sin(s.t * 0.37) - ty * 0.25
  const suave = 1 - Math.pow(0.02, dt)
  s.yaw += (yawObjetivo - s.yaw) * suave
  s.pitch += (pitchObjetivo - s.pitch) * suave

  // La estela se enfría. Si ya está todo a 0 (lo normal sin ratón) no hace falta recorrer las celdas
  if (s.caliente) {
    const conserva = Math.exp((-dt * 3) / ESTELA_S)
    let queda = false
    for (let k = 0; k < s.calor.length; k++) {
      const h = s.calor[k] * conserva
      s.calor[k] = h < 0.003 ? 0 : h
      if (h >= 0.003) queda = true
    }
    s.caliente = queda
  }
  s.anillos = s.anillos.filter((a) => (a.t += dt) < ANILLO_S)
  s.reparto = Math.floor(s.t / 0.07)

  // Unas 6 partículas por segundo desde el borde superior (más si el logo es más grande)
  const crece = geo.ancho / BASE.ancho
  if (Math.random() < dt * 6 * Math.min(3, crece)) {
    const i = Math.floor(Math.random() * s.cols)
    const j = s.arriba[i]
    if (j >= 0) {
      s.particulas.push({
        x: (i + 0.5) * S,
        y: j * S,
        vy: -(10 + Math.random() * 20) * Math.sqrt(crece),
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
  const R = s.geo.radio
  const c0 = Math.max(0, Math.floor((x - R) / S))
  const c1 = Math.min(s.cols - 1, Math.ceil((x + R) / S))
  const f0 = Math.max(0, Math.floor((y - R) / S))
  const f1 = Math.min(s.filas - 1, Math.ceil((y + R) / S))
  for (let j = f0; j <= f1; j++) {
    for (let i = c0; i <= c1; i++) {
      const q = (((i + 0.5) * S - x) ** 2 + ((j + 0.5) * S - y) ** 2) / (R * R)
      if (q < 1) {
        s.calor[j * s.cols + i] = Math.min(1, s.calor[j * s.cols + i] + CALOR_ESTELA * (1 - q) * (1 - q))
        s.caliente = true
      }
    }
  }
}

// Relación de frecuencias de cada zona: do, re, mi, sol (pentatónica)
const NOTAS_ZONA = [1, 1.122, 1.26, 1.498]

type Props = {
  /** Debe darle tamaño a la caja (el lienzo la llena) */
  className?: string
  /** Partes pulsables del logo (deben ser una constante: si cambian, se reinicia el efecto) */
  zonas?: ZonaLogo[]
  /** Al pulsar una zona; recibe su id y su centro en pantalla (para la transición) */
  onZona?: (id: string, centro: { x: number; y: number }) => void
}

export function Logo3D({ className = '', zonas, onZona }: Props) {
  const cv = useRef<HTMLCanvasElement>(null)
  const st = useRef<Estado>(crearEstado(BASE))
  const botones = useRef<(HTMLButtonElement | null)[]>([])
  const etiqueta = useRef<HTMLSpanElement>(null)
  const redibujar = useRef(() => {})
  const [activa, setActiva] = useState(-1)
  const reducido = useReducedMotion()

  useEffect(() => {
    const c = cv.current
    if (!c) return
    const s = st.current
    const img = new Image()
    img.src = logoUrl
    let vivo = true
    let listo = false
    let espera = 0
    let antes = performance.now()
    // En pantallas táctiles la zona pulsable es la caja entera de cada parte, con margen: más fácil de acertar
    const tactil = window.matchMedia('(pointer: coarse)').matches

    /** Coloca los botones (recortados con clip-path) y la etiqueta sobre las zonas proyectadas. */
    const colocarZonas = () => {
      if (!zonas) return
      proyectarZonas(s, zonas)
      s.zonasPx.forEach((p, i) => {
        const b = botones.current[i]
        if (!b) return
        const [x0, y0, x1, y1] = caja(p)
        const m = 8
        const poli = tactil ? [x0 - m, y0 - m, x1 + m, y0 - m, x1 + m, y1 + m, x0 - m, y1 + m] : p
        const pares: string[] = []
        for (let n = 0; n < poli.length; n += 2) pares.push(`${poli[n]}px ${poli[n + 1]}px`)
        b.style.clipPath = `polygon(${pares.join(', ')})` // p. ej. polygon(120px 40px, 160px 90px, 80px 90px)
      })
      const e = etiqueta.current
      if (e && s.activa >= 0) {
        const [x0, y0, x1] = caja(s.zonasPx[s.activa])
        e.style.transform = `translate(${(x0 + x1) / 2}px, ${y0 - 2}px) translate(-50%, -100%)`
      }
    }

    const dibujar = () => {
      rasterizar(s)
      colocarZonas()
      pintar(c, s)
    }
    redibujar.current = () => {
      if (s.modelo.length) dibujar()
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
    // Las medidas lógicas salen de la caja: si cambia, cambia el número de celdas y el modelo
    const construir = () => {
      const geo = geometria(c.clientWidth, c.clientHeight)
      s.modelo = construirModelo(img, geo)
      ajustar(s, geo)
    }
    const medir = () => {
      s.escala = Math.min(2, window.devicePixelRatio || 1)
      c.width = Math.round(s.geo.W * s.escala)
      c.height = Math.round(s.geo.H * s.escala)
      if (s.modelo.length) dibujar()
    }
    const alRedimensionar = () => {
      if (!listo) return
      // Se reconstruye cuando se deja de redimensionar (debounce), no en cada píxel
      clearTimeout(espera)
      espera = window.setTimeout(() => {
        if (Math.abs(c.clientWidth - s.geo.W) >= 1 || Math.abs(c.clientHeight - s.geo.H) >= 1) construir()
        medir()
      }, 150)
    }

    img.decode().then(() => {
      if (!vivo) return
      construir()
      medir()
      listo = true
      if (!reducido) s.anillos.push({ x: s.geo.W / 2, y: s.geo.cy, t: 0 })
      arrancar()
    })

    const ro = new ResizeObserver(alRedimensionar)
    ro.observe(c)
    // Solo se anima mientras se ve en pantalla
    const io = new IntersectionObserver(([e]) => {
      s.visible = e.isIntersecting
      if (s.visible) arrancar()
    })
    io.observe(c)

    return () => {
      vivo = false
      clearTimeout(espera)
      ro.disconnect()
      io.disconnect()
      cancelAnimationFrame(s.raf)
      s.raf = 0
    }
  }, [reducido, zonas])

  const donde = (e: PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    const k = r.width / st.current.geo.W
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
    const n = Math.max(1, Math.ceil(Math.hypot(x - s.ux, y - s.uy) / (s.geo.radio / 3)))
    for (let k = 1; k <= n; k++) sellar(s, s.ux + ((x - s.ux) * k) / n, s.uy + ((y - s.uy) * k) / n)
    s.ux = s.mx = x
    s.uy = s.my = y
    s.dentro = true
  }

  /** Zona con el ratón encima o con el foco: el canvas la resalta y aparece su nombre. */
  const marcar = (i: number) => {
    // Cada zona tiene su nota de marimba (escala pentatónica: siempre suenan bien juntas)
    if (i >= 0 && i !== st.current.activa) marimba({ nota: NOTAS_ZONA[i % NOTAS_ZONA.length], volumen: 0.18 })
    st.current.activa = i
    setActiva(i)
    if (reducido) redibujar.current() // sin animación no hay bucle que repinte solo
  }

  const pulsar = (i: number, el: HTMLElement) => {
    if (!zonas) return
    const r = el.getBoundingClientRect()
    const [x0, y0, x1, y1] = caja(st.current.zonasPx[i])
    const centro = { x: r.left + (x0 + x1) / 2, y: r.top + (y0 + y1) / 2 }
    timbre({ x: centro.x }) // "ding-dong": llamas a la puerta
    onZona?.(zonas[i].id, centro)
  }

  return (
    <div
      className={`relative touch-pan-y select-none ${className}`}
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
        // Fuera de las zonas, la onda suena a canica que cae sobre el logo
        if ((e.target as HTMLElement).tagName === 'CANVAS') canica({ altura: 0.25, x: e.clientX })
      }}
    >
      {/* Absoluto: el lienzo mide justo lo que su caja, y no al revés */}
      <canvas ref={cv} className="absolute inset-0 size-full" aria-hidden="true" />

      {/* Un botón real por zona: ocupa toda la caja pero clip-path lo recorta a la forma de la zona
          (y el recorte también limita dónde se puede pulsar). Así hay teclado, foco y aria-label gratis */}
      {zonas?.map((z, i) => (
        <button
          key={z.id}
          ref={(el) => {
            botones.current[i] = el
          }}
          type="button"
          aria-label={z.etiqueta}
          style={{ clipPath: 'polygon(0 0, 0 0, 0 0)' }}
          onMouseEnter={() => marcar(i)}
          onMouseLeave={() => marcar(-1)}
          onFocus={() => marcar(i)}
          onBlur={() => marcar(-1)}
          onClick={(e) => pulsar(i, e.currentTarget)}
          className="absolute inset-0 cursor-pointer outline-none"
        />
      ))}
      {zonas && (
        // Etiqueta discreta: texto mono y una línea fina que baja hasta la zona
        <span
          ref={etiqueta}
          aria-hidden="true"
          className={`pointer-events-none absolute top-0 left-0 flex flex-col items-center transition-opacity duration-200 ${
            activa >= 0 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="bg-fondo/80 px-1.5 py-0.5 font-mono text-[0.7rem] whitespace-nowrap text-arena">
            → {activa >= 0 ? zonas[activa].etiqueta : ''}
          </span>
          <span className="h-3 w-px bg-arena/70" />
        </span>
      )}
    </div>
  )
}
