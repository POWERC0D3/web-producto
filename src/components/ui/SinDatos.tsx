/** Estado vacío para los grupos de los que aún no hay datos. */
export function SinDatos({ que, grupo }: { que: string; grupo: string }) {
  return (
    <div className="grid h-full min-h-40 place-items-center border border-dashed border-linea p-6 text-center">
      <div>
        <p className="font-mono text-xs text-arena">{grupo}</p>
        <p className="mt-2 text-sm text-tinta">Aún no hay {que} de este grupo</p>
        <p className="mt-1 text-xs text-tinta-suave">Se cargará de la base de datos cuando esté disponible.</p>
      </div>
    </div>
  )
}
