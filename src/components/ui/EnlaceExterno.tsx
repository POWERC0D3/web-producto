import { sonar } from '../../lib/sonido'

type Props = {
  href: string
  etiqueta: string
  /** Solo visible al pasar por su fila (`group/fila`) o con el teclado. En pantallas táctiles, siempre */
  alPasar?: boolean
}

/**
 * "↗" que abre una web en otra pestaña. `rel="noopener noreferrer"`: la página
 * abierta no puede controlar esta pestaña (window.opener) ni sabe de dónde vienes.
 */
export function EnlaceExterno({ href, etiqueta, alPasar = false }: Props) {
  // (hover:hover) = hay ratón. Sin él (móvil) no existe "pasar por encima": si se ocultara, no se podría pulsar
  const oculto = alPasar
    ? '[@media(hover:hover)]:opacity-0 group-hover/fila:opacity-100 focus-visible:opacity-100'
    : ''
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${etiqueta} (se abre en una pestaña nueva)`}
      title={etiqueta}
      onClick={(e) => sonar('button', { x: e.clientX })}
      className={`grid size-7 shrink-0 place-items-center text-tinta-suave transition-[color,background-color,opacity] hover:bg-fondo-alto hover:text-arena ${oculto}`}
    >
      ↗
    </a>
  )
}
