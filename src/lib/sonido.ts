/* ── Motor de sonido ──────────────────────────────────────────────
   Sonidos de interfaz con la Web Audio API (sin librerías).

   · MUESTRAS: dos "kits" de SND (snd.dev, Dentsu Lab Tokyo), cada uno en un
     solo archivo de audio (un "audio sprite": muchos sonidos seguidos) y un
     mapa nombre → [inicio, fin] en segundos. Kit 01 "Sine" = la base suave;
     kit 03 "Industrial" = toques metálicos.
   · SÍNTESIS: el viento de la cortina y la canica de los carruseles se
     generan aquí (ruido filtrado y ondas senoidales) porque cambian según el
     contexto (dirección, posición).

   Detalles que hacen que suene "pro" y no repetitivo:
   - variación aleatoria de tono (±3 %) en cada reproducción,
   - panorama estéreo: suena del lado de la pantalla donde está lo que tocas,
   - límite de frecuencia por sonido (pasar el ratón rápido no "ametralla").

   Los navegadores no dejan sonar nada hasta el primer gesto del usuario
   (política de autoplay): el AudioContext se crea en ese primer clic/tecla. */

type Kit = '01' | '03'
type Mapa = Record<string, [number, number]>

export type OpcionesSonido = {
  kit?: Kit
  volumen?: number // 0..1, relativo al volumen general
  tono?: number // multiplicador de velocidad: 1.12 ≈ un tono más agudo
  x?: number // posición horizontal en pantalla (clientX) para el panorama
  cada?: number // ms mínimos entre dos reproducciones de este sonido
}

// ── Preferencias (se guardan en el navegador) ─────────────────────────
const CLAVE = 'agenda:sonido'
type Config = { activo: boolean; volumen: number }

function leerConfig(): Config {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Partial<Config> | null
    return { activo: c?.activo ?? true, volumen: typeof c?.volumen === 'number' ? c.volumen : 0.4 }
  } catch {
    return { activo: true, volumen: 0.4 }
  }
}

let config = leerConfig()
const oyentes = new Set<() => void>()

/** Para useSyncExternalStore: React se entera cuando cambian las preferencias. */
export const suscribirConfig = (f: () => void) => {
  oyentes.add(f)
  return () => oyentes.delete(f)
}
export const leerConfigSonido = () => config

function guardarConfig(nueva: Config) {
  config = nueva
  try {
    localStorage.setItem(CLAVE, JSON.stringify(config))
  } catch {
    // sin almacenamiento: vale igual para esta visita
  }
  if (maestro && ctx) maestro.gain.setTargetAtTime(config.activo ? config.volumen : 0, ctx.currentTime, 0.02)
  oyentes.forEach((f) => f())
}

export const activarSonido = (activo: boolean) => guardarConfig({ ...config, activo })
export const cambiarVolumen = (volumen: number) => guardarConfig({ ...config, volumen })

// ── Motor ─────────────────────────────────────────────────────────────
let ctx: AudioContext | null = null
let maestro: GainNode | null = null
let ruido: AudioBuffer | null = null
const kits = new Map<Kit, { buffer: AudioBuffer; mapa: Mapa }>()
const ultimos = new Map<string, number>()

async function cargarKit(kit: Kit) {
  if (!ctx) return
  // Ogg Vorbis donde se pueda (más ligero); si no (Safari), AAC en .m4a
  const ext = new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'm4a'
  const base = `${import.meta.env.BASE_URL}sonidos/snd${kit}`
  const [mapa, datos] = await Promise.all([
    fetch(`${base}/mapa.json`).then((r) => r.json() as Promise<Mapa>),
    fetch(`${base}/audioSprite.${ext}`).then((r) => r.arrayBuffer()),
  ])
  kits.set(kit, { buffer: await ctx.decodeAudioData(datos), mapa })
}

/** Crea el AudioContext (solo se puede tras un gesto del usuario) y carga los kits. */
function iniciar() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  ctx = new AudioContext()
  maestro = ctx.createGain()
  maestro.gain.value = config.activo ? config.volumen : 0
  // Compresor suave al final: iguala volúmenes y evita picos cuando suenan varios a la vez
  const compresor = ctx.createDynamicsCompressor()
  compresor.threshold.value = -18
  compresor.ratio.value = 3
  maestro.connect(compresor).connect(ctx.destination)

  // 2 s de ruido blanco reutilizable para el viento
  ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = ruido.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1

  void Promise.all([cargarKit('01'), cargarKit('03')]).catch(() => {
    // sin red o formato no soportado: la web sigue funcionando en silencio
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', iniciar, { capture: true })
  window.addEventListener('keydown', iniciar, { capture: true })
}

/** ¿Se puede sonar ya? (contexto creado, sonido activado y sin pasarse del límite de frecuencia) */
function puedeSonar(clave: string, cada: number) {
  if (!ctx || !maestro || !config.activo || ctx.state !== 'running') return false
  const t = performance.now()
  if (t - (ultimos.get(clave) ?? 0) < cada) return false
  ultimos.set(clave, t)
  return true
}

/** Nodo de panorama estéreo según la posición en pantalla (centro = 0). */
function panorama(x: number | undefined) {
  const p = ctx!.createStereoPanner()
  p.pan.value = x === undefined ? 0 : Math.max(-1, Math.min(1, (x / innerWidth) * 2 - 1)) * 0.6
  return p
}

/**
 * Reproduce un sonido del kit. `nombre` puede ser exacto ("tap_03") o una familia
 * ("tap"): entonces se elige una variante al azar, así no suena siempre igual.
 */
export function sonar(nombre: string, o: OpcionesSonido = {}) {
  const kit = kits.get(o.kit ?? '01')
  if (!kit || !puedeSonar(`${o.kit ?? '01'}:${nombre}`, o.cada ?? 35)) return
  let tramo = kit.mapa[nombre]
  if (!tramo) {
    const variantes = Object.keys(kit.mapa).filter((n) => n.startsWith(`${nombre}_`))
    if (!variantes.length) return
    tramo = kit.mapa[variantes[Math.floor(Math.random() * variantes.length)]]
  }
  const c = ctx!
  const fuente = c.createBufferSource()
  fuente.buffer = kit.buffer
  fuente.playbackRate.value = (o.tono ?? 1) * (0.97 + Math.random() * 0.06)
  const g = c.createGain()
  g.gain.value = o.volumen ?? 1
  fuente.connect(g).connect(panorama(o.x)).connect(maestro!)
  fuente.start(0, tramo[0], tramo[1] - tramo[0])
}

/** Ráfaga de viento: ruido filtrado cuya frecuencia sube (o baja), como un "whoosh" limpio. */
export function viento({ sube = true, duracion = 0.7, x }: { sube?: boolean; duracion?: number; x?: number } = {}) {
  if (!ruido || !puedeSonar('viento', 200)) return
  const c = ctx!
  const t = c.currentTime
  const fuente = c.createBufferSource()
  fuente.buffer = ruido
  const filtro = c.createBiquadFilter()
  filtro.type = 'bandpass'
  filtro.Q.value = 0.8
  filtro.frequency.setValueAtTime(sube ? 260 : 2600, t)
  filtro.frequency.exponentialRampToValueAtTime(sube ? 2600 : 260, t + duracion)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.35, t + duracion * 0.45)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duracion)
  const pan = panorama(x)
  pan.pan.linearRampToValueAtTime(0, t + duracion) // viaja desde donde pulsaste hacia el centro
  fuente.connect(filtro).connect(g).connect(pan).connect(maestro!)
  fuente.start(t, Math.random(), duracion + 0.05)
}

/**
 * Canica de cristal: un "clic" agudo con dos armónicos que se apagan rápido y un
 * pequeño rebote. `altura` (0..1) sube el tono: sirve para indicar posición.
 */
export function canica({ altura = 0.5, x }: { altura?: number; x?: number } = {}) {
  if (!puedeSonar('canica', 45)) return
  const c = ctx!
  const t = c.currentTime
  const salida = panorama(x)
  salida.connect(maestro!)
  const golpe = (inicio: number, fuerza: number) => {
    const f = 1300 + altura * 700 // registro medio-agudo: brillante pero sin chillar
    for (const [mult, vol] of [
      [1, 0.22],
      [2.76, 0.08], // armónico inarmónico: le da el timbre "de cristal"
    ]) {
      const osc = c.createOscillator()
      osc.frequency.value = f * mult
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, inicio)
      g.gain.exponentialRampToValueAtTime(vol * fuerza, inicio + 0.002)
      g.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.09)
      osc.connect(g).connect(salida)
      osc.start(inicio)
      osc.stop(inicio + 0.1)
    }
  }
  golpe(t, 1)
  golpe(t + 0.055, 0.35) // rebote
}

/**
 * Una nota de marimba: madera, ataque blando, sin brillo agresivo.
 * Sintetizada con la fundamental + el 4.º armónico (el que da el timbre de marimba),
 * un "golpe" de mazo muy corto y un filtro paso bajo que redondea el sonido.
 */
function notaMarimba(c: AudioContext, destino: AudioNode, inicio: number, frecuencia: number, volumen: number, duracion = 0.6) {
  const filtro = c.createBiquadFilter()
  filtro.type = 'lowpass'
  filtro.frequency.value = 2200
  filtro.connect(destino)
  for (const [mult, vol, dur] of [
    [1, 1, duracion],
    [4, 0.22, duracion * 0.2], // el armónico agudo se apaga mucho antes: "toc" de madera
  ]) {
    const osc = c.createOscillator()
    osc.frequency.value = frecuencia * mult
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, inicio)
    g.gain.exponentialRampToValueAtTime(volumen * vol, inicio + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur)
    osc.connect(g).connect(filtro)
    osc.start(inicio)
    osc.stop(inicio + dur + 0.02)
  }
}

/** Nota de marimba suave; `nota` multiplica la frecuencia base (do5 = 523 Hz). */
export function marimba({ nota = 1, volumen = 0.2, x }: { nota?: number; volumen?: number; x?: number } = {}) {
  if (!puedeSonar('marimba', 60)) return
  const salida = panorama(x)
  salida.connect(maestro!)
  notaMarimba(ctx!, salida, ctx!.currentTime, 523.25 * nota, volumen)
}

/** "Ding-dong" de timbre de puerta, con marimba: mi5 y luego do5, suave. */
export function timbre({ x }: { x?: number } = {}) {
  if (!puedeSonar('timbre', 300)) return
  const c = ctx!
  const salida = panorama(x)
  salida.connect(maestro!)
  const t = c.currentTime
  notaMarimba(c, salida, t, 659.25, 0.22, 0.9)
  notaMarimba(c, salida, t + 0.22, 523.25, 0.22, 1.2)
}
