# Arquitectura

Cómo está organizado el código de Monte Naranco Agenda Digital y cómo funciona cada pieza. Para la historia del proyecto y los retos, ver [PROCESO.md](PROCESO.md).

---

## Índice

1. [Visión general](#1-visión-general)
2. [Capas del código](#2-capas-del-código)
3. [Flujo de datos](#3-flujo-de-datos)
4. [Rutas](#4-rutas)
5. [Datos y persistencia](#5-datos-y-persistencia)
6. [Lógica de dominio (`lib/`)](#6-lógica-de-dominio-lib)
7. [Hooks](#7-hooks)
8. [Componentes](#8-componentes)
9. [Gráficos: Canvas 2D y WebGL](#9-gráficos-canvas-2d-y-webgl)
10. [Animación](#10-animación)
11. [Sonido](#11-sonido)
12. [Estilos y tokens de diseño](#12-estilos-y-tokens-de-diseño)
13. [Rendimiento](#13-rendimiento)
14. [Accesibilidad](#14-accesibilidad)
15. [Convenciones](#15-convenciones)

---

## 1. Visión general

Es una **SPA (Single Page Application)** solo de frontend: Vite sirve un `index.html` con un `<div id="root">`, y React pinta dentro todo lo demás. No hay backend:

- los **datos** (horario, exámenes, calendario escolar) son archivos JSON importados en el build;
- las **preferencias** (grupo, módulos apagados, tareas hechas, sonido) se guardan en `localStorage`;
- la **navegación** usa el `#` de la URL (`#/ajustes`, `#/entrar`…), sin librería de rutas.

```
            ┌──────────────── App.tsx ────────────────┐
JSON  ───►  │ estado global: ahora, ruta, grupo,       │  ───►  Panel  (Cabecera, Horario, Calendario, Logo, Agenda)
            │ módulos apagados, fecha elegida (lupa)   │  ───►  Ajustes   (carga diferida)
localStorage│                                          │  ───►  Landing   (carga diferida, GSAP)
            └──────────────────────────────────────────┘
                          ▲                 │
                     lib/ (lógica pura)   hooks/ (estado reutilizable)
```

---

## 2. Capas del código

| Capa | Carpeta | Regla | Equivalente en Java |
|---|---|---|---|
| **Tipos** | `src/types/` | Solo describen la forma de los datos | DTO / `record` |
| **Datos** | `src/data/` | JSON estático | Ficheros de recursos |
| **Dominio** | `src/lib/` | Funciones puras sin React: reciben datos y devuelven datos | Servicios / utilidades `static` |
| **Estado** | `src/hooks/` | Hooks de React que guardan y sincronizan estado | Beans con estado |
| **Interfaz** | `src/components/` | Componentes que pintan y reciben eventos | Vistas / controladores |

La separación importa: **toda la lógica de fechas, horario, eventos y tareas se puede probar sin navegador**, porque no depende de React.

---

## 3. Flujo de datos

`App.tsx` es el único sitio con estado compartido. Los datos bajan por *props* y los cambios suben por *callbacks*: el **flujo unidireccional** de React.

### El estado de `App`

| Estado | De dónde sale | Quién lo usa |
|---|---|---|
| `ahora` | `useAhora()`: la hora actual (o la simulada con `?ahora=`), cada 30 s | Horario, Calendario, Agenda |
| `ruta` | `useRuta()`: el hash de la URL | Decide qué página se ve |
| `grupo` | `useGrupo()`: el grupo elegido, en `localStorage` | Datos que se cargan |
| `excluidos` / `permanentes` | `useModulos()`: módulos apagados (temporales + permanentes) | Todo: lo que no cursas no llega a ningún panel |
| `elegida` | Estado local: la fecha bajo la lupa (texto ISO) o `null` = hoy | Horario (lupa) y Agenda (día que enseña) |

### Valores derivados (se calculan en cada render, no se guardan)

```ts
const datos = useMemo(() => datosDelGrupo(grupo), [grupo])        // horario + eventos del grupo
const lista = useMemo(() => eventosVisibles(datos.eventos, ahora, excluidos), …)
const lupa  = elegida ? parseFecha(elegida) : esLaborable(ahora) ? hoy : null
const lunes = lunesDe(lupa ?? lunesDeLaSemanaQueViene)                 // semana que enseña el horario
```

Guardar solo lo mínimo y **derivar el resto** evita que dos estados se contradigan. No puede pasar que la lupa esté en un día y la Agenda enseñe otro, porque los dos salen de `elegida`.

### Ejemplo: mover la lupa con la rueda

1. `HorarioSemanal` recibe el evento `wheel` (con un *throttle* de 250 ms) y calcula el siguiente día lectivo.
2. Llama a `onElegir(fecha)`, que en `App` es `elegirFecha`: suena un roce y se guarda la nueva fecha en `elegida`.
3. `App` se vuelve a pintar: el Horario recibe la nueva `lupa` y el lienzo WebGL anima el muelle hacia la columna. La Agenda recibe la nueva `fecha`, entra en estado de "pensando" y, si el usuario se queda 1,2 s, escribe el plan del día.

---

## 4. Rutas

`useRuta` es un "router" mínimo con el hash de la URL:

| Hash | Página |
|---|---|
| `#/` (o cualquier otro) | Panel |
| `#/ajustes` | Ajustes |
| `#/entrar` | Landing con la pestaña "Iniciar sesión" |
| `#/crear` | Landing con la pestaña "Crear cuenta" |

- Usa **`useSyncExternalStore`**, la forma oficial de leer en React un dato que vive fuera de React (la URL) y volver a pintar cuando cambia (`hashchange`).
- El botón Atrás del navegador y los enlaces directos funcionan sin instalar React Router.
- **Transición:** `navegar(destino, origen)` lanza la `CortinaPixel` desde el punto pulsado. Cuando la pantalla está cubierta (`onCubierta`) se cambia el hash y la cortina se retira desde el centro. Con movimiento reducido se cambia directamente.
- **Carga diferida:** `Ajustes` y `Landing` se importan con `React.lazy` + `Suspense`, y se precargan con `requestIdleCallback` en cuanto el navegador está libre.

---

## 5. Datos y persistencia

### Archivos JSON

```
src/data/
├── asignaturas.json            # [{ id: "LMSGI", nombre: "Lenguajes de Marcas", completo?: "…" }]
├── calendario-escolar.json     # curso, inicioClases, finClases, dias[], vacaciones[]
└── grupos/
    └── daw1a/
        ├── horario.json        # { recreo: {inicio, fin}, clases: [{ dia: 1..5, asignatura, inicio, fin }] }
        └── examenes.json       # [{ fecha: "YYYY-MM-DD", asignatura, tipo: examen|entrega|evaluacion, detalle? }]
```

`lib/grupos.ts` → `datosDelGrupo(grupo)` es **el único punto de acceso** a los datos de un grupo (patrón *repositorio*). Devuelve `null` si no hay datos y la interfaz muestra un estado vacío (`SinDatos`).

### `localStorage`

| Clave | Contenido | Hook |
|---|---|---|
| `agenda:grupo` | Ciclo, curso y letra elegidos | `useGrupo` |
| `daw1a:modulos-excluidos` | Ids de los módulos apagados en Ajustes | `useModulos` |
| `agenda:hechas:YYYY-MM-DD` | Ids de las tareas marcadas como hechas **ese día** (se borran las de hace más de 14 días) | `useHechas` |
| `agenda:sonido` | Sonido activado y volumen | `lib/sonido.ts` |

Todas las lecturas y escrituras van en `try/catch`: en una ventana privada o con el almacenamiento bloqueado, la web funciona igual, solo que no recuerda nada.

---

## 6. Lógica de dominio (`lib/`)

| Módulo | Responsabilidad | Funciones principales |
|---|---|---|
| `fechas.ts` | Fechas en **hora local** (nunca UTC) y formatos en español | `parseFecha`, `isoLocal`, `lunesDe`, `sumarDias`, `diasEntre`, `mismoDia`, `horaAMinutos`, `textoCuentaAtras` |
| `datos.ts` | Catálogo de asignaturas y calendario escolar | `nombreAsignatura`, `nombreCompleto`, `colorAsignatura` |
| `horario.ts` | El horario semanal | `clasesDelDia`, `franjas`, `modulosDe` |
| `escolar.ts` | El calendario escolar como índice por día | `infoDia`, `esLectivo`, `clasesDeLaFecha`, `proximaClase`, `entradasEscolares`, `INICIO`, `FIN` |
| `eventos.ts` | Exámenes y entregas respecto a hoy | `eventosConDias`, `eventosVisibles`, `agruparPorSemana`, `proximoEvento`, `urlDe` |
| `tareas.ts` | Genera las tareas de la Agenda | `tareasDelDia` |
| `grupos.ts` | Grupos y acceso a sus datos | `datosDelGrupo`, `nombreGrupo`, `GRUPO_INICIAL` |
| `sonido.ts` | Motor de audio (ver [§11](#11-sonido)) | `sonar`, `viento`, `canica`, `marimba`, `timbre` |
| `cristal.ts` | La lupa WebGL (ver [§9.4](#94-lupa-de-cristal-cristalts--lupacristaltsx)) | `crearCristal` |
| `movimiento.ts` | Curvas y variantes de Motion compartidas | `EASE_SALIDA`, `cascada`, `aparecer` |
| `gsap.ts` | Registra los plugins de GSAP una sola vez | `gsap`, `ScrollTrigger`, `useGSAP` |
| `config.ts` | Constantes de configuración (≈ `application.properties`) | `URL_CENTRO` |

### Cómo se generan las tareas (`tareasDelDia`)

Son reglas sencillas (un `if` cada una), ordenadas por prioridad y urgencia:

| Situación | Tarea | Prioridad |
|---|---|---|
| Entrega en ≤ 2 días | "Termina X" | Prioritaria |
| Entrega en ≤ 7 días | "Avanza X" | Importante |
| Entrega más lejana | "Planifica X" | Opcional |
| Examen hoy / mañana | "Repaso rápido de X" / "Repasa X" | Prioritaria |
| Examen en ≤ 4 días | "Estudia X" | Importante |
| Examen en ≤ 7 días / más lejos | "Esquema de X" / "Empieza X" | Opcional |
| Dos o más pruebas el mismo día | "Reparte el repaso" | Importante |
| Hoy hay clase de una asignatura con examen en ≤ 14 días | "Dudas de X" (con la hora de la clase) | Opcional |
| Hueco libre en la hoja | Hábitos diarios de las clases de hoy | Relleno |

Cada tarea tiene un **id estable** (`entrega-<id>`, `dudas-PROG`…). Por eso se puede recordar si la marcaste como hecha aunque recargues la página.

---

## 7. Hooks

| Hook | Qué hace | Detalle técnico |
|---|---|---|
| `useAhora(ms)` | La hora actual, refrescada cada `ms` | Con `?ahora=` aplica un desfase fijo: el reloj simulado avanza normalmente |
| `useRuta()` | La página actual según el hash | `useSyncExternalStore` |
| `useModulos()` | Módulos apagados: `permanentes` (Ajustes, `localStorage`), temporales (clic en el horario, solo memoria) y `excluidos` = la unión | Devuelve `Set` nuevos para que React detecte el cambio por referencia |
| `useGrupo()` | Grupo elegido, recordado entre visitas | |
| `useHechas(dia)` | Tareas hechas de un día concreto | Si cambia el día con la web abierta, lee la nueva lista ("ajustar el estado durante el render") |
| `useAviso()` | Mensajes temporales tipo *toast* | |
| `useSonido()` | La configuración de sonido, reactiva | Se suscribe a los cambios de `lib/sonido.ts` |

---

## 8. Componentes

### `components/sections/`: las celdas y páginas

| Componente | Qué es |
|---|---|
| `Cabecera` | Barra superior en rejilla `1fr auto 1fr`, para que el título quede centrado de verdad. Tiene su propio reloj de 1 s: solo ella se re-renderiza cada segundo. Las cifras usan `Odometro`. |
| `HorarioSemanal` | Rejilla de la semana: días en columnas, franjas en filas, recreo. Cada bloque (`BloqueClase`) tiene estados: normal, ahora, pasada, convalidada (hueco rayado), temporalmente apagada (borde discontinuo), atenuada (fuera de la lupa). Gestiona la rueda (con *throttle*), las flechas y el hover de asignatura. Monta `LupaCristal`. En móvil tiene una vista de lista. |
| `Calendario` | Modos *Exámenes* y *Escolar* con `AnimatePresence`. Mes navegable (limitado a meses con información ±1), lista agrupada por semanas y filtros con subrayado animado (`layoutId`). |
| `Agenda` | El plan del día: cabecera ("Jueves 12 · Hoy · 0/7"), estado de "pensando", tareas con `Escritura` y casillas. En escritorio, el "taco" isométrico. |
| `PanelLogo` | El `Logo3D` con sus zonas (tejado, puertas). |
| `Ajustes` | Página de ajustes: grupo, módulos, sonido, sincronización. |
| `ElegirGrupo` | Los tres `Carrusel` (ciclo, curso, grupo). |

### `components/landing/`

| Componente | Qué es |
|---|---|
| `Landing` | Barra fija + `Hero`. El botón "Entrar" salta al final del ScrollTrigger. |
| `Hero` | La escena fijada con GSAP (ver [§10](#10-animación)). |
| `Acceso` | `TarjetaCuenta`: pestañas de crear cuenta / iniciar sesión y el formulario de muestra. |

### `components/ui/`: piezas reutilizables

| Componente | Qué es |
|---|---|
| `Panel` | Envoltorio de cada celda: título, tooltip de ayuda (aparece tras 0,5 s de hover o al instante con teclado), extra a la derecha, capa de fondo opcional y animación de entrada. El borde es una **sombra de 1 px**, así dos celdas vecinas comparten línea. |
| `Logo3D` | Motor 3D de puntos (ver [§9.1](#91-logo3d-un-motor-3d-en-canvas-2d)). |
| `LupaCristal` | Monta el lienzo WebGL de `cristal.ts` sobre la rejilla del horario. |
| `FondoPuntos` | Fondo animado con tramado (ver [§9.2](#92-fondopuntos-dithering-ordenado)). |
| `CortinaPixel` | Transición entre páginas (ver [§9.3](#93-cortinapixel)). |
| `Escritura` | Texto que se escribe letra a letra sin coste de *layout*. |
| `Odometro` | Números que ruedan como un cuentakilómetros (cada cifra en su "ventanita"). |
| `Carrusel<T>` | Selector circular genérico: flechas, rueda, arrastre y teclado. |
| `EnlaceExterno` | Enlace con ↗ que solo se ve al pasar el ratón (en dispositivos con hover). |
| `CuentaAtras`, `Aviso`, `LogoMarca`, `SinDatos` | Etiqueta de días restantes, toast, logo SVG pequeño y estado vacío. |

---

## 9. Gráficos: Canvas 2D y WebGL

Todos los efectos visuales grandes se hacen **sin librerías**, con la API del navegador.

### 9.1 `Logo3D`: un motor 3D en Canvas 2D

```
logo-ies.jpg ──► construirModelo() ──► nube de puntos (Float32Array, 8 números por punto)
                                       x, y, z, nx, ny, nz, color, luz
cada fotograma:
  avanzar()     → giro (vaivén + inclinación hacia el ratón, suavizado), enfriar la estela, partículas
  rasterizar()  → girar + proyectar en perspectiva + z-buffer → luz y color por celda de pantalla
  pintar()      → tramado de Bayer → un Path2D por color; estela en caracteres; polvo; partículas
```

- **Datos compactos:** un solo `Float32Array` en lugar de un array de objetos. Es mucho más rápido de recorrer (memoria contigua, sin objetos para el recolector de basura).
- **Culling de caras traseras:** se gira primero la normal; si mira hacia atrás, el punto se descarta sin proyectarlo.
- **Iluminación de Lambert:** `luz = max(0, normal · dirección_luz)`. La cara frontal va casi llena para que se lea la forma; los laterales se oscurecen además con la profundidad.
- **Tramado:** una celda lleva punto si `luz > BAYER[(fila % 4) * 4 + (columna % 4)]`.
- **Estela del ratón:** un búfer de "calor" por celda. Por encima del umbral `FRIO`, el punto se pinta como carácter de la rampa ` . : - = + * # % @`.
- **Zonas pulsables:** los polígonos (en px de la imagen) se proyectan con la misma rotación y se aplican como `clip-path: polygon(…)` a `<button>` reales.
- **Pausa:** un `IntersectionObserver` detiene el bucle cuando el logo no se ve. Con movimiento reducido se pinta un único fotograma.
- **Tamaño:** el tamaño lógico del lienzo es el de su caja en px, así la densidad de puntos es la misma en cualquier pantalla.

### 9.2 `FondoPuntos`: dithering ordenado

- Una rejilla de celdas de 8 px con un campo de **densidad** (0..1) que varía despacio: manchas que derivan.
- Cada celda compara su densidad con el umbral de Bayer: es la técnica de las impresoras y pantallas de 1 bit.
- **Optimización:** las ondas de densidad son productos de senos. Con las **identidades trigonométricas** se separan en términos que dependen solo de `x` y solo de `y`; se precalculan por columna y por fila (`Float32Array`), y en cada celda solo se multiplica y se suma.
- Se pinta **un fotograma de cada dos** (30 fps): es un fondo lento y no se nota.

### 9.3 `CortinaPixel`

Una mancha de cuadrados de 14 px crece desde el punto pulsado hasta cubrir la pantalla y, tras cambiar de página, se retira desde el centro. El borde no es una línea, sino una **franja tramada de 220 px** con la misma matriz de Bayer, así que avanza como una onda de píxeles. Algunos píxeles del frente se pintan en arena.

### 9.4 Lupa de cristal (`cristal.ts` + `LupaCristal.tsx`)

**Problema:** un shader solo lee texturas, y el horario es HTML.

**1. Rasterizar el DOM a un canvas 2D** (la "foto" del horario):

| Elemento | Cómo se dibuja |
|---|---|
| Fondos y bordes | `getComputedStyle` de cada elemento + `fillRect` / `strokeRect` |
| Texto | `Range.getClientRects()` por palabra, con su fuente, color y opacidad |
| Iconos SVG | `getScreenCTM()` + `Path2D` con el `d` de cada `<path>` |
| Rayado de convalidados | El elemento lleva `--rayado: 1`; el rasterizador lo dibuja a mano (135°, 1 px cada 7 px) |

**2. Subir la foto como textura** y dibujar un rectángulo que ocupa todo el lienzo con el **fragment shader**:
- **SDF** de un rectángulo redondeado: distancia de cada píxel al borde de la lupa.
- **Aumento** dentro (`vec2(1.07, 1.02)`).
- **Refracción en el bisel:** cerca del borde la imagen se dobla hacia fuera.
- **Aberración cromática (`IRIS`):** los canales R, G y B se muestrean con desplazamientos distintos en el canto.
- **Luz de borde y sombra** exterior.
- **Alfa premultiplicado:** fuera de la lupa el lienzo es transparente.

**3. Mantener la foto al día:**
- un `MutationObserver` sobre la rejilla (clases, estilos, texto) repinta la textura **en cada fotograma durante 260 ms** tras cada cambio, lo que dura una transición CSS;
- un `ResizeObserver` vuelve a medir al cambiar de tamaño.

**4. Movimiento:** la lupa sigue su objetivo (la columna del día, algo más alta que la rejilla) con un **muelle amortiguado** por fotograma (`Math.pow(0.68, dt)`). Al cambiar de semana entra por el lado contrario.

**5. Interacción:** el lienzo tiene `pointer-events: none`, así que el ratón llega al HTML de debajo. Si no hay WebGL, se usa una lupa CSS (borde, degradado y sombras).

---

## 10. Animación

Tres herramientas, cada una para lo suyo:

| Herramienta | Para qué | Ejemplos |
|---|---|---|
| **Motion** | Animaciones de interfaz ligadas al estado de React | Entrada en cascada de las celdas, `AnimatePresence` al cambiar de modo o de día, `layoutId` de los subrayados, arrastre del carrusel con *motion values* |
| **GSAP + ScrollTrigger** | Animaciones ligadas al scroll | La escena de la landing |
| **`requestAnimationFrame`** | Todo lo que se dibuja en lienzos | Logo, fondo, cortina, lupa, pluma de escritura |

### La escena de la landing (`Hero.tsx`)

```
ScrollTrigger({ id: 'hero', pin: true, scrub: true, end: '+=240%' })
timeline:
  1. fichas y palabras del titular: from(desordenadas, giradas) → a su sitio
  2. 'cambio' (pausa: la lista montada respira)
  3. la lista sube y se va  ·  la tarjeta de cuenta sube desde abajo
```

- `gsap.matchMedia()` solo crea la escena si **no** hay movimiento reducido, y añade o quita la clase `escena` del contenedor. Sin escena, el HTML ya es el estado final.
- Los valores que dependen del tamaño (cuánto subir la tarjeta) son **funciones** y se recalculan al redimensionar.

### Movimiento reducido
- `<MotionConfig reducedMotion="user">` desactiva las animaciones de Motion en toda la app.
- GSAP, los lienzos y `Escritura` consultan `useReducedMotion()` / `matchMedia` y muestran el estado final.

---

## 11. Sonido

`lib/sonido.ts` es un motor propio sobre la **Web Audio API**:

```
AudioContext ──► maestro (GainNode, volumen general) ──► compresor ──► altavoces
                  ▲
   muestra (AudioBufferSourceNode con playbackRate y StereoPanner)  ← audio sprites SND
   síntesis (osciladores + ruido filtrado)                          ← viento, canica, marimba, timbre
```

- **Arranque perezoso:** el `AudioContext` se crea en el primer `pointerdown` o `keydown` (en fase de captura), por la política de autoplay de los navegadores.
- **Audio sprites:** `public/sonidos/snd01/` y `snd03/` tienen `audioSprite.ogg`, `audioSprite.m4a` y `mapa.json` (`{"button": [0, 0.1002], …}`). Se descarga un archivo por kit y se reproduce un trozo.
- **`sonar(nombre, { kit, volumen, tono, x, cada })`:**
  - `tono` es un multiplicador de velocidad, con ±3 % aleatorio;
  - `x` es la posición en pantalla, que se convierte en panorama estéreo;
  - `cada` son los ms mínimos entre repeticiones (límite de frecuencia).
- **Síntesis:**
  - `viento()`: 2 s de ruido blanco reutilizable con un filtro paso banda que barre;
  - `canica(i, n)`: senoidal con el tono según la posición;
  - `marimba` y `timbre`: notas de "madera" para el logo, en escala pentatónica (do, re, mi, sol), una por zona.
- **Configuración** (activado y volumen) en `localStorage`, con suscripción para que Ajustes y el motor estén sincronizados.

---

## 12. Estilos y tokens de diseño

Tailwind v4 se configura **en CSS** (`src/index.css`), no en un archivo JS:

```css
@theme {
  --color-fondo: #0a0a0a;   --color-tinta: #ededed;   --color-linea: #262626;
  --color-verde: #21684e;   --color-arena: #f5b474;   --color-coral: #f3715a;
  --font-titulo: "Montserrat Variable";  --font-sans: "Inter Variable";  --font-mono: "JetBrains Mono Variable";
  --ease-salida: cubic-bezier(0.22, 1, 0.36, 1);
}
```

Cada variable de `@theme` se convierte en clases (`bg-arena`, `text-tinta`, `font-mono`, `ease-salida`…).

- **`@theme static`** para los colores de asignatura (`--color-asig-prog`…). Se usan desde JS (`var(--color-asig-…)`) y Tailwind solo generaría los que ve en clases; `static` los fuerza siempre.
- **Utilidades propias con `@utility`:**
  - `tinte-verde`: degradado radial del verde del logo desde la izquierda, al 16 %. Solo define `background-image`, así que se suma al color de fondo del panel.
  - `cristal`: el efecto de vidrio de la cabecera (`backdrop-filter: blur(16px) saturate(1.6)`, reflejo diagonal, filo de luz y sombra).
- **Grano:** un `body::after` fijo con ruido SVG (`feTurbulence`) al 3,5 %.
- **Fuentes** auto-alojadas con Fontsource (variables); el navegador solo descarga los alfabetos que usa gracias a `unicode-range`.

---

## 13. Rendimiento

| Técnica | Dónde |
|---|---|
| *Code splitting* con `React.lazy` + precarga en `requestIdleCallback` | `App.tsx` (Ajustes y Landing, con GSAP) |
| Ondas separables precalculadas por fila y columna + 30 fps | `FondoPuntos` |
| `Float32Array` y bucles sin asignaciones en el bucle caliente | `Logo3D`, `FondoPuntos` |
| Una sola pasada por celda con un `Path2D` por color | `Logo3D.pintar` |
| Saltarse el enfriamiento de la estela si no queda calor | `Logo3D.avanzar` |
| Pausa fuera de pantalla (`IntersectionObserver`) | `Logo3D` |
| Texto escrito con `textContent` (sin nodos por letra ni layout) | `Escritura` |
| *Debounce* de 1,2 s antes de montar el plan del día | `Agenda` |
| *Throttle* de la rueda (250 ms) | `HorarioSemanal`, `Carrusel` |
| Repintar la textura de la lupa solo tras cambios (MutationObserver) | `cristal.ts` |
| Reloj de 1 s aislado en la cabecera | `Cabecera` |
| Valores derivados con `useMemo` | `App.tsx` |

**Medidas (build de producción, 1440×900):**
- JS inicial: **440 kB (≈144 kB comprimido)**; Ajustes 28 kB y Landing 123 kB aparte.
- El panel en reposo gasta ~30 % de un núcleo, sobre todo en el logo 3D, que se anima en cada fotograma.

---

## 14. Accesibilidad

- **Semántica:** `<header>`, `<main>`, `<section aria-labelledby>`, `<dl>` en la cabecera, botones reales para las zonas del logo y los días del horario.
- **Teclado:** flechas en el horario y los carruseles, tooltips que aparecen con el foco y foco visible en arena.
- **Lectores de pantalla:** textos animados con su versión en `sr-only`, lienzos decorativos con `aria-hidden` y la cuenta atrás sin `aria-live`, para que no se anuncie cada segundo.
- **Movimiento reducido** en todas las animaciones (ver [§10](#10-animación)).
- **Contraste:** el gris secundario (`#a1a1a1`) cumple AA sobre el fondo.
- **Táctil:** en pantallas táctiles las zonas del logo se amplían a su caja entera con margen.

---

## 15. Convenciones

- **Idioma:** código, nombres y comentarios en español (`ahora`, `lunesDe`, `tareasDelDia`), igual que el dominio.
- **Estilo:** sin punto y coma, comillas simples y líneas de hasta ~130 caracteres.
- **Comentarios:** explican el **porqué** y la técnica, no lo obvio. Muchos incluyen la equivalencia en Java.
- **Componentes** con *named exports* y props tipadas con `type Props`.
- **Comprobación:** `npm run build` (incluye `tsc -b`) y `npm run lint` deben pasar sin errores ni avisos.
