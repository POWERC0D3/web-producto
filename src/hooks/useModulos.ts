import { useEffect, useMemo, useState } from 'react'

const CLAVE = 'daw1a:modulos-excluidos'

function leer(): Set<string> {
  try {
    const guardado = localStorage.getItem(CLAVE)
    return new Set(guardado ? (JSON.parse(guardado) as string[]) : [])
  } catch {
    return new Set() // modo privado o datos corruptos: empezamos con todos activos
  }
}

/** Devuelve un Set nuevo con `id` puesto o quitado (React detecta cambios por referencia). */
function conmutar(prev: ReadonlySet<string>, id: string): Set<string> {
  const nuevo = new Set(prev)
  if (nuevo.has(id)) nuevo.delete(id)
  else nuevo.add(id)
  return nuevo
}

/**
 * Los módulos que NO cursas, en dos listas:
 * - permanentes: se eligen en Ajustes y se guardan en localStorage (el
 *   almacenamiento del navegador, parecido a un Map<String,String> persistente).
 * - temporales: se apagan con un clic en el horario y solo viven en memoria
 *   (estado de React): al recargar la página vuelven a estar encendidos.
 * El resto de la app solo necesita `excluidos`, la unión de ambas.
 */
export function useModulos() {
  const [permanentes, setPermanentes] = useState<ReadonlySet<string>>(leer)
  const [temporales, setTemporales] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify([...permanentes]))
    } catch {
      // sin almacenamiento disponible: funciona igual, solo que no se recuerda
    }
  }, [permanentes])

  // useMemo: la unión solo se recalcula cuando cambia alguna de las dos listas
  const excluidos = useMemo<ReadonlySet<string>>(() => new Set([...permanentes, ...temporales]), [permanentes, temporales])

  const alternarTemporal = (id: string) => setTemporales((prev) => conmutar(prev, id))

  // Lo que decides en Ajustes manda: si tenía un apagado temporal, se olvida
  const alternarPermanente = (id: string) => {
    setPermanentes((prev) => conmutar(prev, id))
    setTemporales((prev) => {
      if (!prev.has(id)) return prev
      const nuevo = new Set(prev)
      nuevo.delete(id)
      return nuevo
    })
  }

  const restablecer = () => setPermanentes(new Set())

  return { excluidos, permanentes, alternarTemporal, alternarPermanente, restablecer }
}
