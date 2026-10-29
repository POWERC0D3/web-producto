import { useEffect, useState } from 'react'

const CLAVE = 'daw1a:modulos-excluidos'

function leer(): Set<string> {
  try {
    const guardado = localStorage.getItem(CLAVE)
    return new Set(guardado ? (JSON.parse(guardado) as string[]) : [])
  } catch {
    return new Set() // modo privado o datos corruptos: empezamos con todos activos
  }
}

/**
 * Los módulos que NO cursas. Se guardan en localStorage (el almacenamiento del
 * navegador, parecido a un Map<String,String> persistente) para que se
 * mantengan al recargar la página.
 */
export function useModulos() {
  const [excluidos, setExcluidos] = useState<ReadonlySet<string>>(leer)

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify([...excluidos]))
    } catch {
      // sin almacenamiento disponible: funciona igual, solo que no se recuerda
    }
  }, [excluidos])

  // Un Set nuevo en cada cambio: React detecta cambios comparando referencias,
  // así que mutar el mismo Set no provocaría un re-render.
  const alternar = (id: string) =>
    setExcluidos((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })

  const restablecer = () => setExcluidos(new Set())

  return { excluidos, alternar, restablecer }
}
