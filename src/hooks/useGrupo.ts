import { useEffect, useState } from 'react'
import { CICLOS, CURSOS, GRUPO_INICIAL, LETRAS, type Grupo } from '../lib/grupos'

const CLAVE = 'agenda:grupo'

/** Lee el grupo guardado y comprueba que sus valores siguen existiendo (datos viejos o manipulados → el inicial). */
function leer(): Grupo {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Partial<Grupo> | null
    const valido =
      g && CICLOS.some((c) => c === g.ciclo) && CURSOS.some((c) => c === g.curso) && LETRAS.some((l) => l === g.letra)
    return valido ? (g as Grupo) : GRUPO_INICIAL
  } catch {
    return GRUPO_INICIAL
  }
}

/** El grupo elegido en la cabecera, recordado entre visitas (localStorage). */
export function useGrupo() {
  const [grupo, setGrupo] = useState<Grupo>(leer)

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(grupo))
    } catch {
      // sin almacenamiento: funciona igual, solo que no se recuerda
    }
  }, [grupo])

  return { grupo, setGrupo }
}
