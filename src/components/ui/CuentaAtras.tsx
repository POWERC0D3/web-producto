import { textoCuentaAtras } from '../../lib/fechas'

/** "en 7 días". Solo lo inminente (hoy/mañana) lleva color: coral. */
export function CuentaAtras({ dias }: { dias: number }) {
  let estilo = 'text-tinta-suave'
  if (dias < 0) estilo = 'text-tinta-suave line-through'
  else if (dias <= 1) estilo = 'bg-coral px-2 py-0.5 font-semibold text-oscuro-fijo'
  else if (dias <= 3) estilo = 'text-coral'

  return <span className={`inline-flex shrink-0 font-mono text-xs whitespace-nowrap ${estilo}`}>{textoCuentaAtras(dias)}</span>
}
