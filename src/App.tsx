import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { MotionConfig, motion, useReducedMotion } from 'motion/react'
import { useAhora } from './hooks/useAhora'
import { useAviso } from './hooks/useAviso'
import { useGrupo } from './hooks/useGrupo'
import { useModulos } from './hooks/useModulos'
import { irA, useRuta, type Ruta } from './hooks/useRuta'
import { nombreAsignatura } from './lib/datos'
import { eventosVisibles } from './lib/eventos'
import { diaSemana, fechaDeLaSemana, inicioDelDia, isoLocal, lunesDe, mismoDia, parseFecha } from './lib/fechas'
import { datosDelGrupo, nombreGrupo } from './lib/grupos'
import { modulosDe } from './lib/horario'
import { cascada } from './lib/movimiento'
import { sonar, viento } from './lib/sonido'
import { Aviso } from './components/ui/Aviso'
import { CortinaPixel, type FaseCortina } from './components/ui/CortinaPixel'
import { FondoPuntos } from './components/ui/FondoPuntos'
import { Cabecera } from './components/sections/Cabecera'
import { HorarioSemanal } from './components/sections/HorarioSemanal'
import { PanelLogo } from './components/sections/PanelLogo'
import { Calendario } from './components/sections/Calendario'
import { Agenda } from './components/sections/Agenda'

// Ajustes y la landing se descargan aparte (code splitting): el panel no espera por ellas, y GSAP,
// que solo usa la landing, sale del archivo principal. Como cargar una clase en Java solo al usarla
const cargarAjustes = () => import('./components/sections/Ajustes')
const cargarLanding = () => import('./components/landing/Landing')
const Ajustes = lazy(() => cargarAjustes().then((m) => ({ default: m.Ajustes })))
const Landing = lazy(() => cargarLanding().then((m) => ({ default: m.Landing })))

type Origen = { x: number; y: number }

function App() {
  const ahora = useAhora()
  const ruta = useRuta()
  const { excluidos, permanentes, alternarTemporal, alternarPermanente, restablecer } = useModulos()
  const { aviso, avisar } = useAviso()
  const { grupo, setGrupo } = useGrupo()

  // Horario y exámenes del grupo elegido (null si aún no hay datos de ese grupo)
  const datos = useMemo(() => datosDelGrupo(grupo), [grupo])
  const horario = datos?.horario ?? null
  const nombre = nombreGrupo(grupo)

  // Clic en el horario: apagado temporal. Lo apagado en Ajustes no se toca desde aquí, solo se avisa
  const alternarDesdeHorario = (id: string) => {
    if (permanentes.has(id)) {
      sonar('disabled')
      avisar(`${nombreAsignatura(id)} está apagado en Ajustes: se vuelve a encender desde allí`)
    } else alternarTemporal(id)
  }
  const reducido = useReducedMotion()

  // En cuanto el navegador está libre se descargan las otras páginas: al navegar ya están listas
  // y la cortina no destapa una pantalla vacía. import() guarda el módulo, así que no se baja dos veces
  useEffect(() => {
    const precargar = () => void Promise.all([cargarAjustes(), cargarLanding()])
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(precargar, { timeout: 4000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(precargar, 2000)
    return () => clearTimeout(id)
  }, [])

  // Cada página empieza arriba del todo (p. ej. al enviar el formulario, que está al final de la landing).
  // #/entrar y #/crear son la MISMA página (solo cambia la pestaña): cambiar de pestaña no debe subir el scroll
  const pagina = ruta === 'crear' ? 'entrar' : ruta
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pagina])

  const [cortina, setCortina] = useState<(FaseCortina & { destino: Ruta; mensaje?: string }) | null>(null)

  // Un único sitio donde se aplican los módulos apagados: lo que no cursas no llega a ningún panel
  const lista = useMemo(() => (datos ? eventosVisibles(datos.eventos, ahora, excluidos) : []), [datos, ahora, excluidos])

  // La fecha bajo la lupa del horario, que es también el día que enseña la Agenda. Se guarda como
  // texto ISO ("2026-11-13"). null = "hoy" (en fin de semana, sin lupa hasta que se elija un día)
  const [elegida, setElegida] = useState<string | null>(null)
  const lupa = elegida ? parseFecha(elegida) : diaSemana(ahora) <= 5 ? inicioDelDia(ahora) : null
  const enHoy = !lupa || mismoDia(lupa, ahora)
  // La semana que enseña el horario: la de la lupa; sin lupa (fin de semana), la que viene
  const lunes = lunesDe(lupa ?? fechaDeLaSemana(ahora, 1))
  // Hoy: la hora real (la agenda sabe qué clases ya pasaron). Otro día: ese día a las 00:00
  const fechaAgenda = enHoy || !lupa ? ahora : lupa
  const listaAgenda = enHoy || !datos ? lista : eventosVisibles(datos.eventos, fechaAgenda, excluidos)
  const elegirFecha = (f: Date | null) => {
    const destino = isoLocal(f ?? ahora)
    const actual = isoLocal(lupa ?? ahora)
    if (destino === actual) return
    // Roce: más agudo al avanzar, más grave al volver atrás (las fechas ISO se comparan como texto)
    sonar('swipe', { volumen: 0.3, tono: destino > actual ? 1.05 : 0.9 })
    setElegida(f ? destino : null)
  }

  // Cambio de página con la cortina de píxeles (sin animación si se pide movimiento reducido)
  // `mensaje` (opcional) se muestra al LLEGAR a la página nueva, no al salir: si no, la cortina lo taparía
  const navegar = (destino: Ruta, origen: Origen, mensaje?: string) => {
    if (reducido) {
      sonar('transition_up')
      irA(destino)
      if (mensaje) avisar(mensaje)
    } else {
      viento({ sube: true, x: origen.x }) // ráfaga mientras los píxeles "se tragan" la pantalla
      setCortina({ fase: 'cubrir', ...origen, destino, mensaje })
    }
  }
  const alCubrir = () => {
    if (!cortina) return
    irA(cortina.destino)
    sonar('transition_down', { volumen: 0.7 }) // la página nueva "aterriza"
    if (cortina.mensaje) avisar(cortina.mensaje)
    setCortina({ fase: 'descubrir', x: innerWidth / 2, y: innerHeight / 2, destino: cortina.destino })
  }

  return (
    // reducedMotion="user": Motion respeta prefers-reduced-motion en todas las animaciones
    <MotionConfig reducedMotion="user">
      <FondoPuntos />

      {/* Mientras llega una página diferida (solo al entrar directamente en ella) se ve el fondo de puntos */}
      <Suspense fallback={null}>
        {ruta === 'ajustes' ? (
          <Ajustes
            modulos={horario ? modulosDe(horario) : []}
            grupo={grupo}
            onGrupo={setGrupo}
            excluidas={permanentes}
            onAlternar={alternarPermanente}
            onRestablecer={restablecer}
            onVolver={(o) => navegar('panel', o)}
            avisar={avisar}
          />
        ) : ruta === 'entrar' || ruta === 'crear' ? (
          <Landing modo={ruta} onNavegar={navegar} />
        ) : (
          // En escritorio (lg) el panel ocupa exactamente la pantalla; en móvil las celdas se apilan
          <div className="flex min-h-svh flex-col lg:h-svh lg:overflow-hidden">
            <Cabecera horario={horario} lista={lista} excluidas={excluidos} grupo={grupo} />
            <motion.main
              variants={cascada}
              initial="oculto"
              animate="visible"
              className="grid flex-1 grid-cols-1 gap-px p-px md:grid-cols-2 lg:min-h-0 lg:grid-cols-12 lg:grid-rows-[minmax(0,1.1fr)_minmax(0,1fr)]"
            >
              {/* Columna derecha con filas propias: Agenda más alta que Ajustes, sin depender de la izquierda.
                  En móvil `contents` hace que el envoltorio "desaparezca" y sus hijos se apilen como los demás */}
              <div className="contents lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1 lg:grid lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-px">
                <PanelLogo onNavegar={navegar} className="order-first md:col-span-2 lg:order-none" />
                {/* key: al cambiar de grupo la agenda se monta de nuevo y vuelve a "cargar" */}
                <Agenda
                  key={nombre}
                  ahora={ahora}
                  fecha={fechaAgenda}
                  horario={horario}
                  grupo={nombre}
                  lista={listaAgenda}
                  excluidas={excluidos}
                  onHoy={() => elegirFecha(null)}
                  className="md:col-span-2"
                />
              </div>
              <HorarioSemanal
                ahora={ahora}
                horario={horario}
                grupo={nombre}
                excluidas={excluidos}
                permanentes={permanentes}
                onAlternar={alternarDesdeHorario}
                lunes={lunes}
                lupa={lupa}
                onElegir={elegirFecha}
                className="md:col-span-2 lg:col-span-8 lg:col-start-1 lg:row-start-1"
              />
              <Calendario
                ahora={ahora}
                lista={lista}
                sinDatos={datos ? undefined : nombre}
                className="md:col-span-2 lg:col-span-8 lg:col-start-1 lg:row-start-2"
              />
            </motion.main>
          </div>
        )}
      </Suspense>

      <CortinaPixel estado={cortina} onCubierta={alCubrir} onFin={() => setCortina(null)} />
      <Aviso aviso={aviso} />
    </MotionConfig>
  )
}

export default App
