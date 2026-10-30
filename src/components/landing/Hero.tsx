import { useRef, type ComponentProps } from 'react'
import { gsap, useGSAP } from '../../lib/gsap'
import { sonar } from '../../lib/sonido'
import { TarjetaCuenta, type ModoCuenta } from './Acceso'

/* La landing entera es UNA escena fijada (pin) que se cuenta con el scroll:
   1. Fichas de plataformas distintas, desordenadas, encajan en UNA lista
      (y las palabras del titular, también torcidas, se ordenan a la vez).
   2. Pausa: la lista montada.
   3. La lista sube y se va, y la tarjeta de cuenta sube desde abajo y ocupa su sitio.

   Técnica (GSAP + ScrollTrigger):
   - `pin`: la sección no se mueve mientras dura la animación; lo que avanza es la animación.
   - `scrub`: el progreso va pegado a la barra de scroll (si subes, se deshace).
   - Fichas y palabras están en su sitio FINAL en el HTML; la animación es un `from`:
     empiezan desplazadas y giradas (el caos) y vuelven a su sitio. Sin animación
     (movimiento reducido), el HTML ya es el estado final: lista y formulario, uno debajo del otro. */

type Ficha = {
  plataforma: string
  texto: string
  color: string // variable CSS del color (de la paleta de la web, no de cada marca)
  x: number // desordenada: desplazamiento horizontal (fracción del ancho disponible)
  y: number // y vertical (fracción del alto)
  giro: number // grados
}

const FICHAS: Ficha[] = [
  { plataforma: 'Teams', texto: 'Entrega de la práctica 4', color: 'var(--color-asig-ip)', x: -0.95, y: -0.55, giro: -8 },
  { plataforma: 'Educastur', texto: 'Cuestionario del tema 3', color: 'var(--color-arena)', x: 0.9, y: -0.75, giro: 7 },
  { plataforma: 'Aula virtual', texto: 'Apuntes del tema 5 (PDF)', color: 'var(--color-asig-sasp)', x: 1.05, y: -0.05, giro: -5 },
  { plataforma: 'Excel del centro', texto: 'Examen de Bases de Datos', color: 'var(--color-asig-badat)', x: -1.1, y: 0.15, giro: 6 },
  { plataforma: 'Correo', texto: 'Cambio de aula mañana', color: 'var(--color-coral)', x: 0.85, y: 0.5, giro: -9 },
  { plataforma: 'Grupo de clase', texto: '¿Hay examen el jueves?', color: 'var(--color-tinta-suave)', x: -0.8, y: 0.6, giro: 4 },
]

// Las palabras de la primera línea, también "repartidas": se alinean a la vez que las fichas
const PALABRAS = [
  { t: 'Todas', x: -26, y: -14, giro: -7 },
  { t: 'tus', x: 10, y: 18, giro: 9 },
  { t: 'tareas.', x: 30, y: -10, giro: -4 },
]

type Props = { modo: ModoCuenta; onAcceder: ComponentProps<typeof TarjetaCuenta>['onAcceder'] }

export function Hero({ modo, onAcceder }: Props) {
  const raiz = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      // matchMedia de GSAP: la escena solo existe si NO se pide movimiento reducido
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const seccion = raiz.current!
        // En modo escena la tarjeta de cuenta se superpone a la lista (CSS: group-[.escena]/hero:…)
        seccion.classList.add('escena')
        const ancho = () => Math.min(innerWidth * 0.42, 520)
        const alto = () => innerHeight * 0.32
        // Si la tarjeta de cuenta no cabe en pantalla, todo el contenido sube lo que sobre.
        // offsetTop (y no getBoundingClientRect): da la posición de maquetación, sin las transformaciones de GSAP
        const sobra = () => {
          const escenario = seccion.querySelector<HTMLElement>('.escenario')!
          const cuenta = seccion.querySelector<HTMLElement>('.cuenta')!
          return Math.max(0, escenario.offsetTop + cuenta.offsetTop + cuenta.offsetHeight - innerHeight + 24)
        }

        const tl = gsap.timeline({
          scrollTrigger: {
            id: 'hero', // la barra de arriba usa su final para saltar directamente al formulario
            trigger: seccion,
            start: 'top top',
            end: '+=240%', // 2,4 pantallas de scroll para toda la historia
            pin: true,
            scrub: 0.7, // 0.7 s de "inercia" detrás de la rueda: más suave
            invalidateOnRefresh: true, // si cambia el tamaño de la ventana, se recalculan las posiciones
            onLeave: () => sonar('transition_up', { volumen: 0.4 }), // formulario en su sitio
            // Cuando ya casi están en su sitio, dejan de flotar (si no, la lista final quedaría torcida)
            onUpdate: () => seccion.classList.toggle('ordenadas', tl.time() > 0.95),
          },
        })
        // 1 · El caos se ordena
        tl.from('.ficha', {
          // Valores en función: se calculan con el tamaño actual de la ventana
          x: (i: number) => FICHAS[i].x * ancho(),
          y: (i: number) => FICHAS[i].y * alto(),
          rotation: (i: number) => FICHAS[i].giro,
          scale: 1.08,
          ease: 'power2.inOut',
          stagger: 0.05,
        })
          .from(
            '.palabra',
            { x: (i: number) => PALABRAS[i].x, y: (i: number) => PALABRAS[i].y, rotation: (i: number) => PALABRAS[i].giro, ease: 'power2.inOut' },
            0,
          )
          .from('.segunda', { opacity: 0.2 }, 0.6) // "Un mismo sitio." se enciende cuando la lista ya existe
          .from('.tarjeta-marco', { opacity: 0, scale: 0.94, ease: 'power2.out' }, 0.25)
          .from('.tarjeta-pie', { opacity: 0, y: 12 }, 0.75)
          .to('.desliza', { opacity: 0, duration: 0.3 }, 0)
          // 2 · Pausa con la lista montada (un hueco vacío en la línea de tiempo)
          .addLabel('cambio', '+=0.35')
          // 3 · La lista se va hacia arriba y la cuenta sube a ocupar su sitio
          // La tarjeta es opaca casi desde el principio y la lista se va antes: nunca se ven las dos a medias
          .to('.lista', { y: -70, opacity: 0, scale: 0.96, ease: 'power2.in', duration: 0.45 }, 'cambio')
          .to('.descripcion', { opacity: 0, duration: 0.4 }, 'cambio')
          .fromTo('.cuenta', { y: () => innerHeight * 0.6 }, { y: 0, ease: 'power3.out', duration: 0.8 }, 'cambio+=0.15')
          .fromTo('.cuenta', { opacity: 0 }, { opacity: 1, duration: 0.15 }, 'cambio+=0.15')
          .to('.contenido', { y: () => -sobra(), ease: 'power2.inOut', duration: 0.8 }, 'cambio+=0.15')
        return () => seccion.classList.remove('escena', 'ordenadas')
      })
    },
    { scope: raiz }, // los selectores ('.ficha'…) solo buscan dentro de esta sección
  )

  return (
    <section ref={raiz} className="group/hero relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 pt-20 pb-10">
      <div className="contenido flex w-full flex-col items-center">
        {/* Texto: por encima de las fichas (z-20) para que se lea aunque pasen por detrás */}
        <div className="relative z-20 mx-auto max-w-4xl text-center">
          <p className="font-mono text-xs tracking-widest text-arena uppercase">IES Monte Naranco · DAW · DAM</p>
          <h1 className="mt-4 font-titulo text-[clamp(2.4rem,min(7vw,9svh),5.5rem)] leading-[0.95] font-bold tracking-tight text-balance">
            {PALABRAS.map((p) => (
              // inline-block: si no, una palabra suelta no se puede mover ni girar con transform
              <span key={p.t} className="palabra mr-[0.25em] inline-block last:mr-0">
                {p.t}
              </span>
            ))}
            <br />
            <span className="segunda inline-block text-arena">Un mismo sitio.</span>
          </h1>
          <p className="descripcion mx-auto mt-5 max-w-xl text-[clamp(0.95rem,1.4vw,1.1rem)] leading-relaxed text-tinta-suave text-pretty">
            Teams, Educastur, el aula virtual, el Excel de exámenes… Reunimos tus tareas, apuntes y fechas para que no se te
            escape nada.
          </p>
        </div>

        {/* El escenario: la lista (donde encaja todo) y, en su mismo sitio, la tarjeta de cuenta */}
        <div className="escenario relative mt-[min(6svh,3.5rem)] w-full max-w-sm">
          <div className="lista">
            <div className="relative">
              <div className="tarjeta-marco absolute -inset-3 border border-arena/50 bg-fondo-alto/90 shadow-[0_0_60px_-15px_color-mix(in_oklab,var(--color-arena)_45%,transparent)]" />
              <div className="relative">
                <p className="tarjeta-marco mb-2 flex items-baseline justify-between px-1 text-xs">
                  <span className="font-titulo font-bold text-tinta">Hoy</span>
                  <span className="font-mono text-tinta-suave">6 pendientes</span>
                </p>
                <ol className="space-y-1.5">
                  {FICHAS.map((f) => (
                    <li key={f.texto} className="ficha relative z-10">
                      {/* El flotar va en un elemento interior: el exterior lo mueve GSAP */}
                      <div
                        className="flex items-center gap-3 border border-linea bg-fondo px-3 py-2 shadow-lg shadow-black/40 motion-safe:animate-flotar group-[.ordenadas]/hero:animate-none"
                        style={{ animationDelay: `${(f.x + f.y) * -2}s` }}
                      >
                        <span className="size-3.5 shrink-0 border border-tinta-suave/60" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-sm text-tinta">{f.texto}</span>
                        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[0.65rem] text-tinta-suave">
                          <span className="size-1.5" style={{ background: f.color }} aria-hidden="true" />
                          {f.plataforma}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <p className="tarjeta-pie relative mt-6 text-center font-mono text-xs text-tinta-suave">
              Seis sitios distintos → <span className="text-arena">una lista</span>
            </p>
          </div>

          {/* Sin escena (movimiento reducido): debajo de la lista. En escena: encima, en su mismo sitio */}
          <TarjetaCuenta
            modo={modo}
            onAcceder={onAcceder}
            className="cuenta relative z-30 mt-10 group-[.escena]/hero:absolute group-[.escena]/hero:inset-x-0 group-[.escena]/hero:top-0 group-[.escena]/hero:mt-0"
          />
        </div>
      </div>

      {/* Indicador de scroll. GSAP lo apaga en el envoltorio; el pulso (CSS, también sobre opacity) va dentro:
          una animación CSS gana a un estilo en línea, así que cada uno necesita su propio elemento */}
      <span className="desliza absolute bottom-4 left-1/2 -translate-x-1/2 motion-reduce:hidden">
        <span className="block font-mono text-[0.65rem] tracking-widest text-tinta-suave/60 uppercase motion-safe:animate-pulse">
          Desliza
        </span>
      </span>
    </section>
  )
}
