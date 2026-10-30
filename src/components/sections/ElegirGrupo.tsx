import { CICLOS, CURSOS, datosDelGrupo, LETRAS, type Grupo } from '../../lib/grupos'
import { Carrusel } from '../ui/Carrusel'

type Props = { grupo: Grupo; onCambio: (g: Grupo) => void }

/** Los tres carruseles para elegir tu grupo (en Ajustes) y si ya hay datos de él. */
export function ElegirGrupo({ grupo, onCambio }: Props) {
  const hayDatos = datosDelGrupo(grupo) !== null
  return (
    <div>
      <div className="flex justify-center gap-2 border border-linea bg-fondo-alto/60 px-4 py-5 sm:gap-10">
        <Carrusel etiqueta="Ciclo" opciones={CICLOS} valor={grupo.ciclo} onCambio={(ciclo) => onCambio({ ...grupo, ciclo })} />
        <Carrusel etiqueta="Curso" opciones={CURSOS} valor={grupo.curso} onCambio={(curso) => onCambio({ ...grupo, curso })} />
        <Carrusel etiqueta="Grupo" opciones={LETRAS} valor={grupo.letra} onCambio={(letra) => onCambio({ ...grupo, letra })} />
      </div>
      <p className={`mt-3 flex items-center gap-2 text-xs ${hayDatos ? 'text-tinta' : 'text-tinta-suave'}`}>
        <span className={`size-1.5 ${hayDatos ? 'bg-verde' : 'bg-linea'}`} aria-hidden="true" />
        {hayDatos ? 'Horario y exámenes cargados' : 'Aún sin datos: llegarán desde la base de datos'}
      </p>
    </div>
  )
}
