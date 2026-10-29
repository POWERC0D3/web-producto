/** Versión mínima del logo (tejado, tres arcos y colina) en SVG, para la cabecera. */
export function LogoMarca({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 40" className={className} aria-hidden="true">
      <path d="M17 12 24 4l7 8z" className="fill-coral" />
      {[3, 18, 33].map((x) => (
        <g key={x}>
          <path
            d={`M${x} 25v-7a6 6 0 0 1 12 0v7h-3v-7a3 3 0 0 0-6 0v7z`}
            className="fill-verde"
          />
          <rect x={x} y="25" width="3" height="9" className="fill-arena" />
          <rect x={x + 9} y="25" width="3" height="9" className="fill-arena" />
        </g>
      ))}
      <path d="M0 40c8-8 40-8 48 0z" className="fill-verde" />
    </svg>
  )
}
