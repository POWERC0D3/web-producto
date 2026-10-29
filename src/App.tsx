import { useMemo, useState } from 'react'
import { MotionConfig, motion, useReducedMotion } from 'motion/react'
import { useAhora } from './hooks/useAhora'
import { useAviso } from './hooks/useAviso'
import { useModulos } from './hooks/useModulos'
import { irA, useRuta, type Ruta } from './hooks/useRuta'
import { eventosConDias } from './lib/eventos'
import { cascada } from './lib/movimiento'
import { Aviso } from './components/ui/Aviso'
import { CortinaPixel, type FaseCortina } from './components/ui/CortinaPixel'
import { FondoPuntos } from './components/ui/FondoPuntos'
import { Cabecera } from './components/sections/Cabecera'
import { HorarioSemanal } from './components/sections/HorarioSemanal'
import { Ahora } from './components/sections/Ahora'
import { Calendario } from './components/sections/Calendario'
import { Agenda } from './components/sections/Agenda'
import { Ajustes } from './components/sections/Ajustes'

type Origen = { x: number; y: number }

function App() {
  const ahora = useAhora()
  const ruta = useRuta()
  const { excluidos, alternar, restablecer } = useModulos()
  const { aviso, avisar } = useAviso()
  const reducido = useReducedMotion()
  const [cortina, setCortina] = useState<(FaseCortina & { destino: Ruta }) | null>(null)

  // Un único sitio donde se aplican los módulos apagados: lo que no cursas no llega a ningún panel
  const lista = useMemo(
    () => eventosConDias(ahora).filter((e) => !e.asignatura || !excluidos.has(e.asignatura)),
    [ahora, excluidos],
  )

  // Cambio de página con la cortina de píxeles (sin animación si se pide movimiento reducido)
  const navegar = (destino: Ruta, origen: Origen) => {
    if (reducido) irA(destino)
    else setCortina({ fase: 'cubrir', ...origen, destino })
  }
  const alCubrir = () => {
    if (!cortina) return
    irA(cortina.destino)
    setCortina({ fase: 'descubrir', x: innerWidth / 2, y: innerHeight / 2, destino: cortina.destino })
  }

  return (
    // reducedMotion="user": Motion respeta prefers-reduced-motion en todas las animaciones
    <MotionConfig reducedMotion="user">
      <FondoPuntos />

      {ruta === 'ajustes' ? (
        <Ajustes
          excluidas={excluidos}
          onAlternar={alternar}
          onRestablecer={restablecer}
          onVolver={(o) => navegar('panel', o)}
          avisar={avisar}
        />
      ) : (
        // En escritorio (lg) el panel ocupa exactamente la pantalla; en móvil las celdas se apilan
        <div className="flex min-h-svh flex-col lg:h-svh lg:overflow-hidden">
          <Cabecera
            ahora={ahora}
            lista={lista}
            onCuenta={(a) => avisar(a === 'crear' ? 'La creación de cuentas llegará pronto' : 'El inicio de sesión llegará pronto')}
          />
          <motion.main
            variants={cascada}
            initial="oculto"
            animate="visible"
            className="grid flex-1 grid-cols-1 gap-px p-px md:grid-cols-2 lg:min-h-0 lg:grid-cols-12 lg:grid-rows-[minmax(0,1.1fr)_minmax(0,1fr)]"
          >
            <Ahora
              ahora={ahora}
              excluidas={excluidos}
              onAbrirAjustes={(o) => navegar('ajustes', o)}
              className="order-first md:col-span-2 lg:order-none lg:col-span-4 lg:col-start-9 lg:row-start-1"
            />
            <HorarioSemanal
              ahora={ahora}
              excluidas={excluidos}
              onAlternar={alternar}
              onRestablecer={restablecer}
              className="md:col-span-2 lg:col-span-8 lg:col-start-1 lg:row-start-1"
            />
            <Calendario ahora={ahora} lista={lista} className="md:col-span-2 lg:col-span-8" />
            <Agenda ahora={ahora} lista={lista} excluidas={excluidos} className="md:col-span-2 lg:col-span-4" />
          </motion.main>
        </div>
      )}

      <CortinaPixel estado={cortina} onCubierta={alCubrir} onFin={() => setCortina(null)} />
      <Aviso aviso={aviso} />
    </MotionConfig>
  )
}

export default App
