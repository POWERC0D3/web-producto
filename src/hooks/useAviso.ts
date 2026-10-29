import { useEffect, useState } from 'react'

/** Un mensaje flotante que desaparece solo a los 2,5 s. */
export function useAviso() {
  const [aviso, setAviso] = useState<{ texto: string; id: number } | null>(null)

  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), 2500)
    return () => clearTimeout(t)
  }, [aviso])

  // El id cambia en cada llamada: repetir el mismo texto reinicia el temporizador
  const avisar = (texto: string) => setAviso({ texto, id: Date.now() })

  return { aviso, avisar }
}
