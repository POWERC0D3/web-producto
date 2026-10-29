import { useEffect, useState } from 'react'

// Para probar otros momentos sin esperar: http://localhost:5173/?ahora=2026-11-12T09:30
function leerAhoraSimulado(): Date | null {
  const param = new URLSearchParams(window.location.search).get('ahora')
  if (!param) return null
  const fecha = new Date(param) // sin "Z" al final se interpreta como hora local
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

const simulado = leerAhoraSimulado()

/** La hora actual, que se refresca sola cada `intervaloMs`. */
export function useAhora(intervaloMs = 30_000): Date {
  const [ahora, setAhora] = useState(() => simulado ?? new Date())

  useEffect(() => {
    if (simulado) return
    const id = setInterval(() => setAhora(new Date()), intervaloMs)
    return () => clearInterval(id) // limpieza al desmontar, como un close() en Java
  }, [intervaloMs])

  return ahora
}
