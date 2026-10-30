import { useEffect, useEffectEvent, useRef } from 'react'
import { crearCristal, MARGEN, type Cristal } from '../../lib/cristal'

type Props = {
  rejilla: HTMLElement | null // la rejilla del horario que el cristal "fotografía" y dobla
  dia: number | null // columna bajo la lupa (1..5)
  semana: string // ISO del lunes: si cambia, la lupa entra por el lado contrario
  onActiva: (activa: boolean) => void // false si no hay WebGL: el horario usa la lupa CSS
}

/** Puente entre React y el cristal WebGL (que vive fuera de React, en lib/cristal.ts). */
export function LupaCristal({ rejilla, dia, semana, onActiva }: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const cristal = useRef<Cristal | null>(null)
  const anterior = useRef({ dia, semana })

  // useEffectEvent: lee el día y la semana ACTUALES al montar sin que el efecto dependa de ellos
  const montado = useEffectEvent((c: Cristal | null) => {
    onActiva(c !== null)
    anterior.current = { dia, semana }
    c?.irA(dia, 0)
  })
  useEffect(() => {
    if (!rejilla || !lienzo.current) return
    const fondo = getComputedStyle(rejilla.closest('section') ?? rejilla).backgroundColor
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const c = crearCristal(lienzo.current, rejilla, fondo, quieto)
    cristal.current = c
    montado(c)
    return () => {
      c?.destruir()
      cristal.current = null
    }
  }, [rejilla])

  useEffect(() => {
    const prev = anterior.current
    // Las fechas ISO se comparan como texto: semana posterior → la lupa entra por la izquierda
    const salto = prev.semana === semana ? 0 : semana > prev.semana ? 1 : -1
    anterior.current = { dia, semana }
    cristal.current?.irA(dia, salto)
  }, [dia, semana])

  return (
    <canvas
      ref={lienzo}
      aria-hidden="true"
      className="pointer-events-none absolute z-10"
      style={{ left: -MARGEN, top: -MARGEN }}
    />
  )
}
