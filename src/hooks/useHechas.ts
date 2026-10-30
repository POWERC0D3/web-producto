import { useEffect, useState } from 'react'
import { diasEntre, parseFecha } from '../lib/fechas'

const PREFIJO = 'agenda:hechas:'
const CONSERVAR_DIAS = 14

function leer(dia: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PREFIJO + dia) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/**
 * Las tareas marcadas como hechas, guardadas POR DÍA ("agenda:hechas:2026-11-12"):
 * cada día tiene su hoja limpia. Las listas de hace más de dos semanas se borran.
 */
export function useHechas(dia: string) {
  const [hechas, setHechas] = useState<ReadonlySet<string>>(() => leer(dia))
  const [diaLeido, setDiaLeido] = useState(dia)

  // Ha cambiado el día (medianoche con la web abierta): se lee la lista del día nuevo.
  // Es "ajustar el estado durante el render", el patrón que recomienda React para esto.
  if (diaLeido !== dia) {
    setDiaLeido(dia)
    setHechas(leer(dia))
  }

  useEffect(() => {
    try {
      localStorage.setItem(PREFIJO + dia, JSON.stringify([...hechas]))
      // Se guardan los días cercanos (la lupa del horario deja ver otros días de la semana); los viejos, fuera
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const clave = localStorage.key(i)
        if (!clave?.startsWith(PREFIJO)) continue
        if (Math.abs(diasEntre(parseFecha(clave.slice(PREFIJO.length)), parseFecha(dia))) > CONSERVAR_DIAS)
          localStorage.removeItem(clave)
      }
    } catch {
      // sin almacenamiento: se recuerda solo mientras la página esté abierta
    }
  }, [dia, hechas])

  const alternar = (id: string) =>
    setHechas((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })

  return { hechas, alternar }
}
