import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { EASE_SALIDA } from '../../lib/movimiento'
import { canica } from '../../lib/sonido'

// Cuántos píxeles de arrastre equivalen a pasar UNA opción
const PASO = 34

type Props<T extends string> = {
  etiqueta: string
  opciones: readonly T[]
  valor: T
  onCambio: (v: T) => void
}

/**
 * Selector en carrusel: ‹ valor › con el valor deslizándose hacia el lado al que
 * avanzas. Se cambia con las flechas, la rueda del ratón, arrastrando la letra o con
 * ← → del teclado. Es circular: después del último vuelve al primero.
 * Genérico (<T>): el mismo componente sirve para 'DAW' | 'DAM', '1º' | '2º'…
 */
export function Carrusel<T extends string>({ etiqueta, opciones, valor, onCambio }: Props<T>) {
  const [dir, setDir] = useState(1) // hacia dónde se desliza el valor nuevo
  const ultimaRueda = useRef(0)
  const caja = useRef<HTMLDivElement>(null)
  const raiz = useRef<HTMLDivElement>(null)
  // Arrastre: un "motion value" mueve la letra sin pasar por el estado de React en cada píxel
  const arrastre = useMotionValue(0)
  const opacidad = useTransform(arrastre, [-PASO, 0, PASO], [0.45, 1, 0.45])
  const agarre = useRef<{ x: number; id: number } | null>(null)
  const i = opciones.indexOf(valor)

  const mover = (d: 1 | -1) => {
    const siguiente = (i + d + opciones.length) % opciones.length
    // Canica: más aguda cuanto más avanzada la opción, así "oyes" en qué posición estás
    const r = raiz.current?.getBoundingClientRect()
    canica({ altura: siguiente / Math.max(1, opciones.length - 1), x: r ? r.left + r.width / 2 : undefined })
    setDir(d)
    onCambio(opciones[siguiente])
  }

  // La rueda dispara muchos eventos seguidos: un paso cada 250 ms como mucho (throttle).
  // useEffectEvent: el listener se registra una vez pero siempre llama a la versión ACTUAL de `mover`
  const rueda = useEffectEvent((e: globalThis.WheelEvent) => {
    e.preventDefault() // la página no se desplaza mientras giras la rueda aquí encima
    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    const t = performance.now()
    if (t - ultimaRueda.current < 250 || Math.abs(delta) < 4) return
    ultimaRueda.current = t
    mover(delta > 0 ? 1 : -1)
  })
  useEffect(() => {
    const el = caja.current
    if (!el) return
    // React registra onWheel como "pasivo" (no deja usar preventDefault): por eso un listener propio
    const alGirar = (e: globalThis.WheelEvent) => rueda(e)
    el.addEventListener('wheel', alGirar, { passive: false })
    return () => el.removeEventListener('wheel', alGirar)
  }, [])

  const tecla = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') mover(1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') mover(-1)
    else return
    e.preventDefault()
  }

  // Arrastrar: la letra sigue al dedo; cada PASO píxeles se pasa una opción (a la izquierda = siguiente)
  const coger = (e: PointerEvent<HTMLDivElement>) => {
    agarre.current = { x: e.clientX, id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId) // los movimientos llegan aunque el puntero salga de la caja
  }
  const arrastrar = (e: PointerEvent) => {
    const a = agarre.current
    if (!a || a.id !== e.pointerId) return
    let dx = e.clientX - a.x
    if (Math.abs(dx) >= PASO) {
      const paso = dx < 0 ? 1 : -1
      mover(paso)
      a.x -= paso * PASO // el resto del arrastre cuenta para la siguiente
      dx += paso * PASO
    }
    arrastre.set(dx * 0.6) // la letra va algo por detrás del dedo: se nota "con peso"
  }
  const soltar = () => {
    agarre.current = null
    animate(arrastre, 0, { type: 'spring', stiffness: 500, damping: 30 }) // vuelve a su sitio con un muelle
  }

  const flecha = 'grid size-6 place-items-center text-tinta-suave transition-colors hover:text-arena sm:size-7'

  return (
    <div ref={raiz} role="group" aria-label={etiqueta} className="flex flex-col items-center gap-2">
      <span className="text-[0.65rem] tracking-widest text-tinta-suave uppercase">{etiqueta}</span>
      <div className="flex items-center sm:gap-1">
        <button type="button" className={flecha} onClick={() => mover(-1)} aria-label={`${etiqueta}: anterior`}>
          ‹
        </button>
        <div
          ref={caja}
          tabIndex={0}
          role="spinbutton"
          aria-valuetext={valor}
          aria-label={etiqueta}
          onKeyDown={tecla}
          onPointerDown={coger}
          onPointerMove={arrastrar}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          className="relative h-10 w-14 cursor-grab touch-pan-y overflow-hidden select-none active:cursor-grabbing sm:w-16"
        >
          <motion.div className="absolute inset-0" style={{ x: arrastre, opacity: opacidad }}>
            <AnimatePresence initial={false} custom={dir}>
              <motion.span
                key={valor}
                custom={dir}
                variants={{
                  entra: (d: number) => ({ x: `${d * 100}%`, opacity: 0 }),
                  quieto: { x: 0, opacity: 1 },
                  sale: (d: number) => ({ x: `${-d * 100}%`, opacity: 0 }),
                }}
                initial="entra"
                animate="quieto"
                exit="sale"
                transition={{ duration: 0.3, ease: EASE_SALIDA }}
                className="absolute inset-0 grid place-items-center font-titulo text-lg font-bold text-tinta sm:text-2xl"
              >
                {valor}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        </div>
        <button type="button" className={flecha} onClick={() => mover(1)} aria-label={`${etiqueta}: siguiente`}>
          ›
        </button>
      </div>
      {/* Puntos: en qué posición del carrusel estás */}
      <span className="flex gap-1" aria-hidden="true">
        {opciones.map((o) => (
          <span key={o} className={`size-1 transition-colors ${o === valor ? 'bg-arena' : 'bg-linea'}`} />
        ))}
      </span>
    </div>
  )
}
