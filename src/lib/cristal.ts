/* ── La lupa de cristal del horario (WebGL) ──────────────────────────────
   Basada en el shader "Liquid glass": cada píxel pregunta a una función de
   distancia con signo (SDF) a qué distancia está del borde de la lupa, y con
   eso decide TODO a la vez: cuánto aumentar, cuánto doblar la imagen en el canto,
   cuánto separar los colores (aberración cromática), dónde poner la luz y la sombra.

   El problema: un shader solo sabe leer TEXTURAS (imágenes en la GPU), y el
   horario es HTML. Así que primero se "fotografía" la rejilla: se recorre el DOM
   y se dibuja cada caja, borde y palabra en un canvas 2D, en su posición real.
   Esa imagen es la textura que el cristal dobla. Se vuelve a pintar solo cuando
   algo cambia (MutationObserver), no en cada frame.

   El lienzo WebGL va ENCIMA de la rejilla sin capturar el ratón: fuera de la lupa
   es transparente (se ve y se pulsa el HTML de verdad) y dentro enseña la imagen
   doblada. Los clics la atraviesan y llegan a las clases de debajo.          */

export const MARGEN = 44 // px alrededor de la rejilla: sitio para el canto, el estiramiento y la sombra
const ESQUINA = 12
const CURVA = 0.55 // cuánto dobla el canto (0..1)
const IRIS = 0.3 // cuánto se separan los colores en el borde (0..0.4)

const VERT = `
attribute vec2 pos;
varying vec2 vUv;
void main() {
  vUv = vec2(pos.x * 0.5 + 0.5, 0.5 - pos.y * 0.5);
  gl_Position = vec4(pos, 0.0, 1.0);
}`

const FRAG = `
precision highp float;
uniform sampler2D tex;
uniform vec2 res;   // tamaño del lienzo en píxeles reales
uniform vec2 c;     // centro de la lupa
uniform vec2 b;     // media anchura y media altura
uniform float r;    // radio de las esquinas
uniform float k;    // píxeles reales por píxel CSS (devicePixelRatio)
uniform float curva;
uniform float iris;
varying vec2 vUv;

// Distancia con signo a un rectángulo redondeado: < 0 dentro, 0 en el borde, > 0 fuera
float sdf(vec2 p) {
  vec2 q = abs(p - c) - b + vec2(r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec4 leer(vec2 p) {
  return texture2D(tex, clamp(p / res, 0.0, 1.0));
}

void main() {
  vec2 p = vUv * res;
  float d = sdf(p);

  // Fuera: transparente (se ve el HTML real) salvo la sombra, suave y un poco por debajo
  float ds = sdf(p - vec2(0.0, 10.0 * k));
  float sombra = (1.0 - smoothstep(-8.0 * k, 30.0 * k, ds)) * 0.5;
  vec4 col = vec4(0.0, 0.0, 0.0, sombra);

  if (d < k) {
    // Normal del borde: hacia dónde "mira" el cristal en este punto (gradiente de la SDF)
    float e = 1.5;
    vec2 n = normalize(vec2(
      sdf(p + vec2(e, 0.0)) - sdf(p - vec2(e, 0.0)),
      sdf(p + vec2(0.0, e)) - sdf(p - vec2(0.0, e))
    ) + 1e-5);
    // Banda del canto: 0 en el borde, 1 ya dentro. Ahí la imagen se dobla hacia fuera
    float bisel = clamp(min(b.x, b.y) * 0.2, 8.0 * k, 18.0 * k);
    float t = clamp(-d / bisel, 0.0, 1.0);
    float canto = pow(1.0 - t, 2.4);

    // Centro: aumento (más a lo ancho que a lo alto, para no perder la cabecera ni la última clase)
    vec2 aum = c + (p - c) / vec2(1.07, 1.02);
    vec2 desv = n * canto * bisel * 1.1 * curva;
    vec2 q = aum + desv;
    vec4 mitad = leer(q);
    // Aberración: el rojo y el azul se leen un pelo desplazados en sentidos opuestos
    vec4 g = vec4(leer(q + desv * iris).r, mitad.g, leer(q - desv * iris).b, mitad.a);

    // Luz: una línea fina dentro del borde, fuerte arriba a la izquierda y un reflejo débil al otro lado
    vec2 L = normalize(vec2(-0.55, -0.85));
    float aro = smoothstep(0.0, 1.6 * k, -d) * (1.0 - smoothstep(1.6 * k, 4.5 * k, -d));
    float luz = aro * (0.18 + 0.75 * max(dot(n, L), 0.0)) + aro * max(dot(n, -L), 0.0) * 0.22 + canto * 0.08;
    g.rgb *= 1.1; // lo que miras, un punto más luminoso
    g += vec4(vec3(luz), luz);
    g = clamp(g, 0.0, 1.0);

    float a = 1.0 - smoothstep(-0.6 * k, 0.6 * k, d); // borde suavizado (antialias)
    col = mix(col, g, a);
  }
  gl_FragColor = col;
}`

// ── Fotografiar el DOM en un canvas 2D ─────────────────────────────────────

const vacio = (color: string) => color === 'transparent' || /(,\s*0|\/\s*0)\)$/.test(color)

function pintarTexto(ctx: CanvasRenderingContext2D, t: Text, cs: CSSStyleDeclaration, ox: number, oy: number) {
  if (!t.data.trim()) return
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  ctx.fillStyle = cs.color
  ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing
  ctx.textBaseline = 'alphabetic'
  const ascenso = ctx.measureText('Hg').fontBoundingBoxAscent
  const tachado = cs.textDecorationLine.includes('line-through')
  const mayus = cs.textTransform === 'uppercase'
  // Palabra a palabra: el navegador ya decidió dónde corta cada línea; se copia su posición exacta
  const rango = document.createRange()
  for (const m of t.data.matchAll(/\S+/g)) {
    rango.setStart(t, m.index)
    rango.setEnd(t, m.index + m[0].length)
    const r = rango.getClientRects()[0]
    if (!r) continue
    ctx.fillText(mayus ? m[0].toUpperCase() : m[0], r.left - ox, r.top - oy + ascenso)
    if (tachado) ctx.fillRect(r.left - ox, r.top - oy + r.height * 0.55, r.width, 1)
  }
}

function pintarBordes(ctx: CanvasRenderingContext2D, cs: CSSStyleDeclaration, x: number, y: number, w: number, h: number) {
  const lados = [
    ['Top', x, y, w, 0],
    ['Right', x + w, y, 0, h],
    ['Bottom', x, y + h, w, 0],
    ['Left', x, y, 0, h],
  ] as const
  for (const [lado, lx, ly, lw, lh] of lados) {
    const grosor = parseFloat(cs.getPropertyValue(`border-${lado.toLowerCase()}-width`))
    const color = cs.getPropertyValue(`border-${lado.toLowerCase()}-color`)
    if (!grosor || vacio(color)) continue
    ctx.strokeStyle = color
    ctx.lineWidth = grosor
    ctx.setLineDash(cs.getPropertyValue(`border-${lado.toLowerCase()}-style`) === 'dashed' ? [4, 3] : [])
    // El trazo va centrado en la línea: se mete medio grosor hacia dentro de la caja
    const dx = lado === 'Left' ? grosor / 2 : lado === 'Right' ? -grosor / 2 : 0
    const dy = lado === 'Top' ? grosor / 2 : lado === 'Bottom' ? -grosor / 2 : 0
    ctx.beginPath()
    ctx.moveTo(lx + dx, ly + dy)
    ctx.lineTo(lx + lw + dx, ly + lh + dy)
    ctx.stroke()
  }
  ctx.setLineDash([])
}

/**
 * El rayado de los módulos convalidados. En CSS es un repeating-linear-gradient (135°, 1 px de raya al 9 %
 * cada 7 px), que el canvas no sabe leer: se dibujan las mismas rayas a mano ("/", separadas 7 px en
 * perpendicular, o sea 7·√2 en horizontal).
 */
function rayar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.strokeStyle = 'rgb(255 255 255 / 0.09)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let k = -h; k < w + h; k += 7 * Math.SQRT2) {
    ctx.moveTo(x + k, y + h)
    ctx.lineTo(x + k + h, y)
  }
  ctx.stroke()
  ctx.restore()
}

/**
 * SVG (iconos y trazos de las asignaturas bloqueadas): cada forma se convierte en un Path2D
 * y se dibuja con su matriz de pantalla (getScreenCTM), que ya incluye viewBox, transformaciones y
 * las animaciones en curso. Así no hay que recalcular posiciones a mano.
 */
function pintarSvg(ctx: CanvasRenderingContext2D, el: Element, alfa: number, ox: number, oy: number) {
  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden') return
  const a = alfa * parseFloat(cs.opacity)
  if (a < 0.01) return
  if (el instanceof SVGSVGElement || el instanceof SVGGElement) {
    for (const hijo of el.children) pintarSvg(ctx, hijo, a, ox, oy)
    return
  }
  const camino = new Path2D()
  if (el instanceof SVGLineElement) {
    camino.moveTo(el.x1.baseVal.value, el.y1.baseVal.value)
    camino.lineTo(el.x2.baseVal.value, el.y2.baseVal.value)
  } else if (el instanceof SVGRectElement) {
    camino.roundRect(el.x.baseVal.value, el.y.baseVal.value, el.width.baseVal.value, el.height.baseVal.value, el.rx.baseVal.value)
  } else if (el instanceof SVGCircleElement) {
    camino.arc(el.cx.baseVal.value, el.cy.baseVal.value, el.r.baseVal.value, 0, Math.PI * 2)
  } else if (el instanceof SVGPathElement) {
    camino.addPath(new Path2D(el.getAttribute('d') ?? ''))
  } else return
  const m = (el as SVGGraphicsElement).getScreenCTM()
  if (!m) return
  ctx.save()
  ctx.globalAlpha = a
  ctx.transform(m.a, m.b, m.c, m.d, m.e - ox, m.f - oy)
  if (cs.fill !== 'none' && !vacio(cs.fill)) {
    ctx.fillStyle = cs.fill
    ctx.fill(camino)
  }
  if (cs.stroke !== 'none' && !vacio(cs.stroke)) {
    ctx.strokeStyle = cs.stroke
    ctx.lineWidth = parseFloat(cs.strokeWidth)
    ctx.lineCap = cs.strokeLinecap as CanvasLineCap
    ctx.setLineDash(cs.strokeDasharray === 'none' ? [] : cs.strokeDasharray.split(/[\s,]+/).map(parseFloat))
    ctx.lineDashOffset = parseFloat(cs.strokeDashoffset) || 0
    ctx.stroke(camino)
  }
  ctx.restore()
}

/** Dibuja `el` y sus hijos (fondos, bordes, texto, SVG) con la opacidad acumulada. Es un mini navegador. */
function pintarNodo(ctx: CanvasRenderingContext2D, el: Element, alfa: number, ox: number, oy: number) {
  if (el instanceof SVGSVGElement) return pintarSvg(ctx, el, alfa, ox, oy)
  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden') return
  const a = alfa * parseFloat(cs.opacity)
  if (a < 0.01) return
  const r = el.getBoundingClientRect()
  const x = r.left - ox
  const y = r.top - oy
  ctx.save()
  ctx.globalAlpha = a
  if (!vacio(cs.backgroundColor)) {
    ctx.fillStyle = cs.backgroundColor
    ctx.fillRect(x, y, r.width, r.height)
  }
  if (cs.getPropertyValue('--rayado').trim() === '1') rayar(ctx, x, y, r.width, r.height)
  pintarBordes(ctx, cs, x, y, r.width, r.height)
  // Lo que se sale de una caja con overflow oculto (líneas recortadas por line-clamp) no se pinta
  if (cs.overflow !== 'visible') {
    ctx.beginPath()
    ctx.rect(x, y, r.width, r.height)
    ctx.clip()
  }
  for (const hijo of el.childNodes) {
    if (hijo.nodeType === Node.TEXT_NODE) pintarTexto(ctx, hijo as Text, cs, ox, oy)
    else if (hijo.nodeType === Node.ELEMENT_NODE) pintarNodo(ctx, hijo as Element, a, ox, oy)
  }
  ctx.restore()
}

// ── WebGL ──────────────────────────────────────────────────────────────────

function compilar(gl: WebGLRenderingContext) {
  const shader = (tipo: number, codigo: string) => {
    const s = gl.createShader(tipo)!
    gl.shaderSource(s, codigo)
    gl.compileShader(s)
    return s
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null
}

export type Cristal = {
  /** Lleva la lupa a la columna del día (1..5; null = sin lupa). `salto`: ±1 si se cambió de semana. */
  irA: (dia: number | null, salto: number) => void
  destruir: () => void
}

/**
 * Monta el cristal sobre `rejilla`. Devuelve null si el navegador no tiene WebGL
 * (entonces se queda la lupa CSS de siempre). `fondo` es el color del panel que hay detrás.
 */
export function crearCristal(lienzo: HTMLCanvasElement, rejilla: HTMLElement, fondo: string, quieto: boolean): Cristal | null {
  const gl = lienzo.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true })
  if (!gl) return null
  const prog = compilar(gl)
  if (!prog) return null
  gl.useProgram(prog)
  // Un rectángulo que cubre todo el lienzo: el shader trabaja píxel a píxel dentro de él
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const pos = gl.getAttribLocation(prog, 'pos')
  gl.enableVertexAttribArray(pos)
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  for (const [p, v] of [
    [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
    [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
    [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
  ])
    gl.texParameteri(gl.TEXTURE_2D, p, v)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  const u = (n: string) => gl.getUniformLocation(prog, n)

  const foto = document.createElement('canvas')
  let dpr = 1
  let ancho = 0 // tamaño del lienzo en px CSS
  let alto = 0
  // Estado de la lupa en px CSS del lienzo: centro, media anchura/altura y velocidad horizontal
  const s = { x: 0, y: 0, bx: 0, by: 0, vx: 0, tx: 0, visible: false }
  let dia: number | null = null
  let raf = 0

  /** Dónde debería estar la lupa: la columna del día, de arriba abajo de la rejilla, algo más ancha. */
  const objetivo = () => {
    const boton = dia === null ? null : rejilla.querySelector(`[data-dia="${dia}"]`)
    if (!boton) return null
    const rr = rejilla.getBoundingClientRect()
    const rb = boton.getBoundingClientRect()
    return {
      // 3 px a la izquierda: la ampliación empuja el texto hacia ese lado, y a la derecha está el día siguiente
      x: rb.left + rb.width / 2 - rr.left + MARGEN - 3,
      y: rr.height / 2 + MARGEN,
      // Algo más grande que la columna: así el texto queda fuera de la banda del canto, que dobla la imagen
      bx: rb.width / 2 + 5, // poco margen en horizontal: más y el canto se come la primera letra del día siguiente
      by: rr.height / 2 + 14,
    }
  }

  const dibujar = () => {
    gl.viewport(0, 0, lienzo.width, lienzo.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (!s.visible) return
    // Estirarse al moverse rápido: más ancha en la dirección del movimiento (el mismo volumen, en marcha)
    const estira = quieto ? 0 : Math.min(0.12, Math.abs(s.vx) * 0.01)
    gl.uniform2f(u('res'), lienzo.width, lienzo.height)
    gl.uniform2f(u('c'), s.x * dpr, s.y * dpr)
    gl.uniform2f(u('b'), s.bx * (1 + estira) * dpr, s.by * (1 - estira * 0.12) * dpr)
    gl.uniform1f(u('r'), ESQUINA * dpr)
    gl.uniform1f(u('k'), dpr)
    gl.uniform1f(u('curva'), CURVA)
    gl.uniform1f(u('iris'), IRIS)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  /** "Fotografía" la rejilla y la sube como textura. */
  const fotografiar = () => {
    foto.width = lienzo.width
    foto.height = lienzo.height
    const ctx = foto.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#0a0a0a' // el fondo de la página y, encima, el del panel
    ctx.fillRect(0, 0, ancho, alto)
    ctx.fillStyle = fondo
    ctx.fillRect(0, 0, ancho, alto)
    const rr = rejilla.getBoundingClientRect()
    for (const hijo of rejilla.children) pintarNodo(ctx, hijo, 1, rr.left - MARGEN, rr.top - MARGEN)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, foto)
    dibujar()
  }

  // El muelle (del código de referencia): se acumula velocidad hacia el objetivo y se amortigua.
  // Por frames, no por milisegundos: el amortiguamiento se ELEVA a dt, así un frame perdido
  // pierde la misma energía que los dos que sustituye. Se para solo al asentarse.
  const correr = () => {
    if (raf) return
    let previo = 0
    const tick = (t: number) => {
      const dt = previo ? Math.min(2.5, Math.max(0, (t - previo) / 16.67)) : 1
      previo = t
      s.vx = (s.vx + (s.tx - s.x) * 0.2 * dt) * Math.pow(0.68, dt)
      s.x += s.vx * dt
      dibujar()
      raf = Math.abs(s.tx - s.x) > 0.05 || Math.abs(s.vx) > 0.05 ? requestAnimationFrame(tick) : 0
    }
    raf = requestAnimationFrame(tick)
  }

  const colocar = (salto: number) => {
    const t = objetivo()
    if (!t) {
      s.visible = false
      dibujar()
      return
    }
    Object.assign(s, { y: t.y, bx: t.bx, by: t.by, tx: t.x })
    if (!s.visible || quieto) {
      // Primera vez (o movimiento reducido): aparece directamente en su sitio
      Object.assign(s, { x: t.x, vx: 0, visible: true })
      dibujar()
      return
    }
    // Cambio de semana: la lupa sale por un lado y entra por el otro, como pasando de página
    if (salto) Object.assign(s, { x: salto > 0 ? -t.bx : ancho + t.bx, vx: 0 })
    correr()
  }

  const medir = () => {
    const rr = rejilla.getBoundingClientRect()
    dpr = Math.min(2, window.devicePixelRatio || 1)
    ancho = rr.width + MARGEN * 2
    alto = rr.height + MARGEN * 2
    lienzo.style.width = `${ancho}px`
    lienzo.style.height = `${alto}px`
    lienzo.width = Math.round(ancho * dpr)
    lienzo.height = Math.round(alto * dpr)
    fotografiar()
    const t = objetivo()
    if (t && s.visible) Object.assign(s, { x: t.x, tx: t.x, y: t.y, bx: t.bx, by: t.by, vx: 0 })
    dibujar()
  }

  // Volver a fotografiar cuando cambie algo de la rejilla. Las clases tienen transiciones CSS (200 ms):
  // durante ese rato se fotografía EN CADA FRAME, así dentro de la lupa el cambio se ve a la vez y con la
  // misma suavidad que fuera. (Una sola foto al final llegaba ~¼ de segundo tarde: se notaba el retraso.)
  // Cada mutación nueva alarga el plazo; al acabar, el bucle se para solo.
  let pendiente = 0
  let hasta = 0
  const refrescar = () => {
    hasta = performance.now() + 260
    if (pendiente) return
    const bucle = () => {
      fotografiar()
      pendiente = performance.now() < hasta ? requestAnimationFrame(bucle) : 0
    }
    pendiente = requestAnimationFrame(bucle)
  }
  const mo = new MutationObserver(refrescar)
  mo.observe(rejilla, { subtree: true, attributes: true, childList: true, characterData: true })
  const ro = new ResizeObserver(medir)
  ro.observe(rejilla)
  document.fonts.ready.then(refrescar)
  medir()

  return {
    irA(d, salto) {
      dia = d
      colocar(salto)
    },
    destruir() {
      mo.disconnect()
      ro.disconnect()
      cancelAnimationFrame(raf)
      cancelAnimationFrame(pendiente)
      // Sin loseContext(): en StrictMode el efecto se monta dos veces sobre el MISMO canvas y un
      // contexto perdido volvería perdido. El navegador lo libera con el elemento.
    },
  }
}
