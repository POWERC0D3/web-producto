# El proceso: de una idea a un panel de control

Este documento cuenta **cómo se hizo** Monte Naranco Agenda Digital: las fases por las que pasó, las decisiones de diseño (incluidas las que se descartaron), los mayores retos técnicos y lo aprendido por el camino.

El proyecto se desarrolló entre el **28 y el 30 de octubre de 2026** como proyecto de aprendizaje de frontend. El autor venía de Java (backend) y era su primer proyecto con React, TypeScript, Tailwind y librerías de animación. Se programó con ayuda de IA (Claude Code), con una regla clara: **entender cada paso, no solo terminar la web**.

> Para la parte técnica (cómo está organizado el código y cómo funciona cada pieza) ver [ARQUITECTURA.md](ARQUITECTURA.md).

---

## Índice

1. [Cómo se trabajó](#1-cómo-se-trabajó)
2. [Cronología](#2-cronología)
3. [Los mayores retos técnicos](#3-los-mayores-retos-técnicos)
4. [Decisiones de diseño](#4-decisiones-de-diseño)
5. [Ideas que se probaron y se descartaron](#5-ideas-que-se-probaron-y-se-descartaron)
6. [Cómo se comprobaba cada cambio](#6-cómo-se-comprobaba-cada-cambio)
7. [Lo aprendido](#7-lo-aprendido)
8. [Resultado final](#8-resultado-final)

---

## 1. Cómo se trabajó

El repositorio tiene un `CLAUDE.md` con las reglas de trabajo con la IA:

- **Explicar el plan antes de escribir código** en los cambios grandes y esperar confirmación.
- **Cambios pequeños, de uno en uno.**
- **Explicar el qué y el porqué**, nombrando cada técnica ("stagger", "estado de React", "z-buffer"…) y con equivalencias de Java cuando ayudan (`package.json` ≈ `pom.xml`, `localStorage` ≈ un `Map<String,String>` persistente, `useEffect` con limpieza ≈ `close()`).
- **Tres modos:** *profesor* (no escribe el código, da pistas), *compañero* (el alumno lo intenta y la IA revisa) y *delegar* (la IA lo hace y luego resume los conceptos). Casi todo el proyecto se hizo en modo **delegar**, con resúmenes al final de cada bloque.
- **Ante un error, primero decir dónde mirar y por qué**, antes de dar la solución.
- **Calidad:** móvil primero, respetar `prefers-reduced-motion` y mantener los tokens de diseño.

La dinámica real fue un bucle corto: **petición del alumno → plan → cambio → comprobación en el navegador → resumen con conceptos → siguiente petición**. Muchas peticiones llegaban dictadas por voz, con varias ideas a la vez, y se iban desgranando en pasos.

---

## 2. Cronología

### Día 1 (28 de octubre): del prototipo al panel

**Arranque.** Proyecto creado con Vite + React + TypeScript. Primera decisión de método: generar **un prototipo completo de principio a fin** para ver hacia dónde iba la web, y después ir rehaciéndolo y entendiéndolo poco a poco.

**Prototipo 1: una web con scroll.** Hero con el logo en puntos, horario semanal, calendario con una línea de tiempo animada con GSAP y una sección de recomendaciones. Funcionaba, pero no se parecía a lo que el autor tenía en la cabeza.

**Rediseño con referencias.** El autor aportó una carpeta de inspiración (16 capturas y un `INSPIRACION.md`). De ahí salieron:
- **Los colores, medidos sobre los píxeles del logo del IES:** verde `#21684e`, arena `#f5b474` y coral `#f3715a`. Siguen siendo la base de toda la web.
- **La estética:** puntos cuadrados, tramados, tipografía monoespaciada para datos y un aire de terminal.
- **Algunos experimentos que luego cayeron:** el haz de un "faro" que barría la próxima prueba, textos que se "rompían" al pasar el ratón y barras de progreso hechas con `█░`.

**Hacia el minimalismo.** Las siguientes peticiones fueron casi siempre para **quitar**:
- fuera las secciones de introducción;
- orden logo → horario → calendario, con un análisis de prioridades al lado;
- menos colores de asignatura;
- fuera la animación del fondo al hacer clic;
- una cabecera que marcara la sección.

**El gran giro: un panel de control sin scroll.** Al final del día el autor pidió que toda la web funcionara como **una única tabla**, "como una página en la que administras todo". Es la forma que el proyecto mantiene hasta hoy: una rejilla CSS de 12 columnas que en escritorio ocupa exactamente la pantalla.

### Día 2 (29 de octubre): interacción, datos, sonido y landing

**Un "error" que no era del proyecto.** "No me deja iniciar Vite" resultó ser `npm vite` en lugar de `npm run dev`. `npm` solo entiende sus propios comandos; los scripts del proyecto (`"dev": "vite"`) se lanzan con `npm run`. En Maven sería como escribir `mvn compilador` en vez de `mvn compile`.

**Horario reactivo:**
- Al pasar el ratón por una asignatura se iluminan **todas sus horas a la vez** con su color, en un tono suave.
- Un clic **apaga** la asignatura (no cursas ese módulo) y desaparece de toda la web: horario, calendario y cuentas atrás.

**El logo 3D.** A partir de una imagen de referencia (un cubo hecho de puntos), el logo del IES se convirtió en **un objeto 3D de puntos**: extruido, con laterales sombreados por tramado, girando suavemente y reaccionando al ratón. Más tarde sus partes se volvieron **botones**:

| Parte del logo | Lleva a |
|---|---|
| Tejado | Registro |
| Puerta central | Iniciar sesión |
| Puerta derecha | Ajustes |
| Puerta izquierda | Web del instituto |

**Datos reales:**
- **Calendario escolar:** el autor añadió el calendario escolar del curso 2026-2027 en PDF. Se pasó a JSON contrastándolo con la resolución oficial publicada en el BOPA, con festivos, días no lectivos y vacaciones.
- **Enlaces:** los días festivos con una explicación real llevan enlace; los demás llevan un `motivo` en texto (por ejemplo, "Puente de Todos los Santos").
- **Tipografía:** se adoptó **Montserrat**, la que usa la web del instituto, para los títulos.

**Módulos: temporales y permanentes.** El "apagado por clic" se separó en dos:
- **Temporal:** clic en el horario. Vive en el estado de React y se pierde al recargar.
- **Permanente:** desde Ajustes. Se guarda en `localStorage`.

Un botón de "restablecer todo" se quitó porque daba problemas y confundía.

**Selector de grupo.** Carruseles para elegir ciclo (DAW/DAM), curso (1º/2º) y grupo (A/B). Solo hay datos de DAW 1º A; para los demás se diseñó un estado vacío. Toda la lectura de datos pasó por **una sola función** (`datosDelGrupo`), como un repositorio en Java: el día que haya backend, solo cambia esa función.

**Sonido.** La petición fue ambiciosa: sonidos "limpios", de esos que hacen que un vídeo parezca bien editado, que ayuden a entender dónde estás sin saturar. Se resolvió así:
- **Biblioteca:** se investigaron bibliotecas de sonidos de interfaz con licencia de uso y se eligió **SND** (Dentsu Lab Tokyo), con dos kits: "Sine" para la base suave e "Industrial" para los toques metálicos.
- **Sonidos sintetizados:** el **viento** de la transición, la **canica** de los carruseles (más aguda cuanto más avanzada la opción) y la **marimba** y el **timbre** del logo se generan en código.
- **Una corrección por oído:** el sonido de las "puertas" del logo sonaba "como una hostia de volumen" frente al resto, que era lo-fi. Se rehízo con más personalidad pero más suave.

**Cabecera.** Pasó a enseñar solo dos cuentas atrás:
- **Izquierda:** próxima prueba.
- **Derecha:** próxima clase.

En las dos, el nombre de la asignatura va en su color. Como los exámenes solo tienen fecha, la cuenta atrás usa **la hora de la primera clase de esa asignatura ese día**.

**Landing de marketing.** La página de iniciar sesión se rehízo como una landing que explica el concepto. El problema es tener las tareas repartidas en Teams, Educastur, el aula virtual, Excel o el correo; la solución, un solo sitio. Se construyó con **GSAP + ScrollTrigger**.

### Días 2 y 3 (29 por la noche y 30 de octubre): la lupa, la agenda y el pulido

**La agenda de papel y la lupa.** La idea era que la Agenda pareciera un bloc de post-its de papel negro, y que el día elegido en el horario se marcara con una **lupa vertical** que se moviera con la rueda.

**La lupa de cristal (WebGL).** El autor aportó un shader de efecto *liquid glass* como referencia visual. Adaptarlo al horario fue el reto técnico más grande del proyecto (ver [3.2](#32-una-lupa-de-cristal-webgl-sobre-html)). Además:
- con la rueda se pasa de semana al llegar al viernes o al lunes;
- la navegación se limita al curso (más una semana a cada lado);
- el calendario solo deja ir a meses con información (más uno a cada lado).

**De post-it literal a profundidad.** La primera agenda de post-its no convenció: hojas que se pasaban, solapes translúcidos. Se cambió por **toda la celda como un bloque** con profundidad y, después, por un **"taco" isométrico**: líneas finas color arena dibujadas en perspectiva de dibujo técnico, como un paquete de post-its visto desde fuera. Al final se alineó con la rejilla, de forma que el canto trasero del taco coincide con la línea del panel del logo.

**Convalidado frente a no seleccionado.** ¿Cómo distinguir "este módulo está convalidado" de "este módulo no lo tienes seleccionado"?
1. **Candados con cadenas** desde las esquinas: descartados porque "sobrecargaba demasiado".
2. **Rayado frente a vacío:** aún costaba distinguirlos.
3. **Hueco frente a oculto:** el convalidado deja su hueco rayado sin texto; el no seleccionado desaparece. Es la solución final.

**Legibilidad.** Una ronda solo para que se leyera mejor:
- **Nombres cortos:** como mucho unas 3 palabras ("Lenguajes de Marcas"); el nombre oficial completo queda para los tooltips.
- **Una paleta nueva para las asignaturas:** 5 familias (azul, cian, violeta, rosa y pizarra) con 2 tonos pastel cada una. **No usa** naranja, rojo ni verde, porque esos colores ya significan algo en la web.
- **Lo que sobraba:** los segundos de la cabecera, las siglas del calendario, los minutos estimados de la Agenda y las etiquetas "Importante" o "Si te da tiempo". El icono ↗ de los enlaces pasó a verse solo al pasar el ratón.
- **El día de hoy:** solo la etiqueta "Hoy" y su subrayado. Se probaron y se quitaron las marcas de "ayer" y "mañana" y un fondo anaranjado.

**El bug del viernes.** Al probar con un viernes no lectivo, todo el día se veía apagado. La causa eran **opacidades que se multiplican**: un 35 % del día no lectivo por un 45 % de las clases atenuadas daba casi invisible. Se corrigió con una opacidad propia para el día bajo la lupa.

**Escritura en vez de "hacker".** El texto de la Agenda aparecía con un efecto *scramble*: letras aleatorias que se iban fijando. Se pidió algo que pareciera **escritura**. El primer intento trajo tirones al cambiar de día, y eso abrió el segundo gran reto (ver [3.3](#33-los-tirones-al-cambiar-de-día)).

**"La IA está pensando".** La solución final a los tirones fue también una idea de diseño. Al cambiar de día, la Agenda muestra un estado de "pensando" (una línea que barre la hoja) y **no escribe nada hasta que el usuario se queda ~1,2 s en ese día**. Si pasas días rápido con la rueda, no se monta ni se anima nada.

**Últimos retoques:**
- La lupa algo más estrecha y desplazada 3 px, para no comerse la primera letra del día siguiente.
- Un **tinte verde** casi imperceptible en Horario y Calendario, el mismo recurso que el brillo arena de la Agenda.
- Una cabecera con **efecto cristal** al estilo de Apple (`backdrop-filter: blur() saturate()`).
- La estela del ratón sobre el logo, mucho más pequeña y débil.
- Fuera el pie de página de la landing.

**Cierre: revisión y optimización:**
- Barrido de errores en 32 combinaciones de pantalla, movimiento y ruta: sin errores.
- *Code splitting* de Ajustes y la landing: **−28 % de JavaScript inicial**.
- Una optimización del logo **comprobada píxel a píxel**.
- Limpieza de código muerto.

---

## 3. Los mayores retos técnicos

### 3.1 Un motor 3D "a mano" para el logo

**El problema:** convertir una imagen plana (el logo, un JPG de 200×200) en un objeto 3D de puntos que gire, tenga volumen y luz, y además sea pulsable por zonas.

**La solución:** un pequeño motor 3D en Canvas 2D, sin librerías.

1. **Modelo:** se leen los píxeles del logo y cada píxel de color es un punto de la cara frontal. Los del borde de la silueta se repiten hacia atrás (**extrusión**) para formar los laterales, cada uno con su **normal** apuntando hacia fuera.
2. **Proyección:** en cada fotograma se giran los puntos (rotación en Y y en X), se proyectan en **perspectiva** y un **z-buffer** se queda con el punto más cercano de cada celda de pantalla.
3. **Luz y tramado:** la luz de cada cara sale del producto escalar normal·luz (**iluminación de Lambert**). La **matriz de Bayer 4×4** decide qué celdas llevan punto: cara iluminada, muchos puntos; cara en sombra, pocos.
4. **Zonas pulsables:** los polígonos de las puertas y el tejado (en píxeles de la imagen original) se **giran y proyectan igual que el logo** y se aplican como `clip-path` a botones HTML reales. Así son accesibles con teclado y lector de pantalla y "siguen" al logo cuando gira.

**Lo difícil:** el equilibrio visual. Hubo muchas iteraciones sobre la profundidad (más grosor, cámara más cerca), el ángulo de reposo (al principio estaba girado hacia un lado) y sobre todo **la estela del ratón**. Pasó tres veces por "demasiado intensa" hasta quedarse en un rastro que apenas se ve. El truco final fue poner el calor del cursor (0,26) **justo por encima del umbral** que convierte un punto en carácter (0,22): así solo el centro de la mancha lo supera.

### 3.2 Una lupa de cristal WebGL sobre HTML

**El problema:** el efecto de referencia es un **shader** (un programa que corre en la GPU para cada píxel), y un shader solo sabe leer **texturas**, es decir, imágenes. El horario es HTML: texto, bordes, colores que cambian al pasar el ratón.

**La solución:**
1. **"Fotografiar" el horario.** Se recorre el DOM y se dibuja en un canvas 2D cada caja, cada borde y cada palabra en su posición real. Los colores se leen con `getComputedStyle`, la posición de cada palabra con `Range.getClientRects` y los iconos SVG con `getScreenCTM` + `Path2D`. El rayado de los convalidados, que es un degradado CSS que el rasterizador no sabe leer, se marca con una variable CSS (`--rayado`) para que el canvas lo dibuje a mano.
2. **Doblar la foto.** Esa imagen sube a la GPU como textura. El shader calcula, con una **función de distancia con signo (SDF)** de un rectángulo redondeado, cuánto aumentar, cuánto doblar la imagen en el canto, cuánto separar los colores (**aberración cromática**) y dónde poner brillo y sombra.
3. **Encima, pero transparente al ratón.** El lienzo WebGL va sobre la rejilla con `pointer-events: none`: los clics y el hover llegan al HTML de verdad.
4. **Movimiento con muelle.** La lupa persigue su objetivo con un **muelle amortiguado** calculado por fotograma. Al saltar de semana entra por el lado contrario.

**El bug del retraso.** Al pasar el ratón por una asignatura dentro de la lupa, se iluminaba con medio segundo de retraso; fuera, al instante. La causa: la "foto" solo se repetía al principio del cambio y a los 260 ms, mientras el HTML de debajo seguía su transición CSS. La solución fue un **`MutationObserver`** que, tras cualquier cambio, repinta la textura **en cada fotograma durante 260 ms**, lo que dura la transición.

**Otros detalles:**
- el texto de la cabecera se deformaba en el bisel, así que se redujo el bisel y se agrandó la lupa;
- la lupa se comía una letra del día siguiente, así que se estrechó y se desplazó 3 px;
- hay una **versión CSS de reserva** si el navegador no tiene WebGL.

### 3.3 Los tirones al cambiar de día

**El síntoma:** al mover la lupa con la rueda, la Agenda tardaba "como medio segundo" y daba tirones. Y lo más importante, como señaló el autor: **antes del cambio de efecto no pasaba**.

**La investigación** (midiendo, no suponiendo):
- Se grabó el rendimiento con el **perfilador de Chrome (CDP)** desde scripts de Puppeteer y se sumó el tiempo propio de cada función.
- **Primer culpable:** el **fondo de puntos**, que calculaba senos y cosenos para cada celda en cada fotograma. Se reescribió con **identidades trigonométricas separables**: las ondas se descomponen en partes que dependen solo de la fila y partes que dependen solo de la columna, se precalculan y luego solo se multiplican. Además se pinta a 30 fps.
- **Segundo culpable, el real:** el nuevo efecto de escritura usaba **un `<span>` por letra** con opacidad animada. Al cambiar de día se creaban cientos de nodos y el navegador hacía **~82 ms de *layout* forzado**. Una máscara animada también salió cara.
- **La comparación decisiva:** medir cada alternativa **contra una línea base sin efecto**. El mecanismo más barato era el del antiguo *scramble*: el texto entero siempre está en el DOM, partido en "ya escrito" y "lo que falta" (transparente), y solo se mueve el corte entre los dos con `textContent`. Como el texto ocupa siempre lo mismo, **no hay layout**.

**La solución en dos capas:**
1. El nuevo componente `Escritura` usa ese mecanismo de "pluma" barato.
2. El **debounce de "pensando"**: no se monta ninguna tarea hasta que el usuario se queda 1,2 s en un día. Pasando días rápido, el coste es prácticamente cero.

### 3.4 Una landing contada con el scroll

**El reto:** una sola escena que se "cuenta" con la rueda: las fichas desordenadas encajan en una lista, el titular se ordena, la lista sale y entra la tarjeta de acceso. Y que con movimiento reducido sea una página normal.

**Las técnicas:**
- **`pin` + `scrub`** de ScrollTrigger: la sección se queda fija mientras dura la animación y el progreso va pegado a la barra de scroll. Si subes, se deshace.
- **Animaciones `from`:** en el HTML, fichas y palabras están en su sitio **final**; la animación las hace **venir** desde el caos. Sin animación, el HTML ya es el estado final.
- **Una etiqueta de pausa** en la línea de tiempo para que la lista montada "respire" antes de irse.

**Los problemas que hubo:**
- **Dos animaciones peleándose por la misma propiedad:** el indicador "Desliza" tenía un pulso CSS y GSAP quería apagarlo, y los dos tocaban `opacity`. Se resolvió con un **elemento envoltorio** para cada uno.
- **`transform` frente a `translate`:** las fichas flotan con CSS y GSAP también las mueve. La animación de flotar usa la propiedad `translate` (no `transform`) para no pisar la de GSAP.
- **Solapes a mitad de transición** entre la lista y la tarjeta: se ajustaron los tiempos para que la lista salga antes y la tarjeta aparezca rápido.
- **Medidas falseadas:** `getBoundingClientRect` incluye los transforms en curso, así que en mitad de una animación da medidas falsas. Para calcular distancias se usó `offsetTop`.
- **El botón "Entrar":** como el formulario está "al final" de una escena fijada, el botón de la barra salta al **final del ScrollTrigger** (`ScrollTrigger.getById('hero').end`), no a la posición del elemento.

### 3.5 Sonido que acompaña sin molestar

Las claves para que no suene "a juguete":
- **Audio sprites:** cada kit es un solo archivo con todos los sonidos seguidos y un mapa `nombre → [inicio, fin]`. Hay una sola descarga por kit, en `.ogg` y `.m4a` según el navegador.
- **Variación de tono aleatoria (±3 %)** en cada reproducción, para que repetir un sonido no suene a máquina.
- **Panorama estéreo:** suena del lado de la pantalla donde está lo que tocas.
- **Límite de frecuencia por sonido:** pasar el ratón rápido no "ametralla".
- **Sonidos con significado:** la canica es más aguda cuanto más avanzada la opción, el roce más agudo al avanzar de día y más grave al volver, y la transición sube cuando la cortina tapa la pantalla y baja cuando descubre la página nueva.

**El límite que no se puede saltar:** los navegadores no dejan sonar nada hasta el **primer gesto** del usuario (clic o tecla). Es la política de autoplay; la web arranca el audio en ese primer gesto, en fase de captura, para que ya suene el primer clic.

### 3.6 Un panel que cabe exactamente en la pantalla

- **La rejilla:** CSS Grid de 12 columnas con filas `minmax(0, 1.1fr)` y `minmax(0, 1fr)`. El `minmax(0, …)` es lo que permite que una celda **encoja por debajo de su contenido** en vez de empujar la página.
- **Bordes de 1 px compartidos:** las celdas no usan `border`, sino una sombra de 1 px y un `gap` de 1 px. Así dos celdas vecinas comparten la misma línea en vez de sumar 2 px.
- **Ajustar el contenido al espacio:** la Agenda debía "llenarse justo", y un botón que añadía 6 px a la cabecera hacía caber una tarea menos. Se arregló con márgenes negativos (`-my-1`).
- **El taco isométrico sin romper la rejilla:** en vez de pintar la profundidad fuera de la celda, la cara frontal **retrocede** lo que mide el taco (24 × 14 px) y las caras de profundidad llenan ese hueco. El contorno exterior sigue respetando las líneas del layout. Se comprobó midiendo: canto del taco en x = 960,1 px y panel del logo en 960,3 px.

### 3.7 Fechas, zonas horarias y un calendario real

- **Fechas locales, no UTC:** `new Date("2026-11-12")` se interpreta en UTC y en España puede caer en el día anterior. Por eso hay funciones propias (`parseFecha`, `isoLocal`) que trabajan siempre en hora local.
- **Un índice por día:** el calendario escolar se convierte en un mapa `"YYYY-MM-DD" → qué pasa ese día`, con las vacaciones expandidas día a día. Cada consulta es un simple `get`, como un `HashMap<LocalDate, …>` en Java.
- **"¿Hay clase?":** de lunes a viernes, dentro del curso y sin festivo, día no lectivo ni vacaciones. La cuenta atrás de "próxima clase" se salta todo eso y también los módulos apagados.
- **El reloj simulado** (`?ahora=`) fue imprescindible para probar recreos, fines de semana, puentes y viernes no lectivos sin esperar a que llegaran.

### 3.8 Optimizar sin romper nada

La última petición fue "optimízalo, pero no te cargues nada". Se hizo así:
1. **Medir primero.** En reposo el panel gastaba ~30 % de un núcleo, sobre todo en el logo 3D. Los nombres de función estaban minificados (`Uh`, `Wh`); se identificaron buscando su código en `dist/`.
2. **Code splitting:** Ajustes y la landing (con GSAP) se cargan con `React.lazy` y se **precargan con `requestIdleCallback`**. El JS inicial bajó de 199 a 144 kB comprimidos, sin fotogramas vacíos al navegar (comprobado fotograma a fotograma).
3. **Demostrar que el logo se ve igual:** con movimiento reducido (sin tiempo) y `Math.random` con semilla fija, el lienzo es determinista. Se compararon **hashes de los píxeles** antes y después de optimizar: idénticos en escritorio y móvil, en reposo y con el ratón encima.
4. **Ser honesto con lo que no mejora:** `rasterizar` ya iba a ~20 ns por punto y lo frena el acceso a memoria del z-buffer, no las cuentas. Bajarlo más exigiría pintar a 30 fps o con menos puntos, y eso **sí** cambiaría el aspecto. No se hizo.

---

## 4. Decisiones de diseño

### Cada color significa una sola cosa

| Color | Significado |
|---|---|
| **Arena** `#f5b474` | "Ahora / lo destacado": la clase en curso, el día de hoy, los focos. |
| **Coral** `#f3715a` | Urgente: hoy o mañana. |
| **Verde** `#21684e` | El logo: identidad, tintes de fondo casi imperceptibles. |
| **Pastel fríos** | Las asignaturas (5 familias × 2 tonos). Nunca naranja, rojo ni verde. |

### Tipografía con función
- **Montserrat:** títulos, por coherencia con la web del instituto.
- **Inter:** lectura.
- **JetBrains Mono:** horas, cifras y cuentas atrás. Es monoespaciada, así que los números no "bailan" al cambiar.

### Menos es más
La mayoría de las peticiones del proyecto fueron para **quitar**: textos de ayuda (pasaron a tooltips), etiquetas repetitivas, marcas de ayer y mañana, candados, el pie de la landing, los segundos del reloj… La pregunta recurrente era *"¿esto ayuda a leer o solo decora?"*.

### El movimiento comunica
Las animaciones tienen dirección y significado:
- la Agenda desliza hacia el lado al que cambias de día;
- la lupa entra por el lado contrario al saltar de semana;
- la cortina de píxeles nace del botón pulsado;
- el estado de "pensando" explica la espera en vez de esconderla.

---

## 5. Ideas que se probaron y se descartaron

| Idea | Por qué se quitó |
|---|---|
| Web con scroll y secciones de presentación | El autor quería una herramienta, no una presentación: se pasó a panel. |
| Haz de "faro" barriendo la próxima prueba | Demasiado efecto para un dato. |
| Análisis de prioridades en columna lateral | Sobraba información; volvió más tarde, simplificado, como Agenda. |
| Apagado de módulos sin posibilidad de volver + botón "Restablecer" | Daba problemas; se separó en temporal (horario) y permanente (Ajustes). |
| Agenda como post-its que se pasan | Hojas translúcidas solapadas; se sustituyó por profundidad isométrica. |
| Marcas de ayer y mañana; fondo naranja en hoy | Ruido visual: solo queda "Hoy" con su subrayado. |
| Candados con cadenas en los convalidados | "Sobrecarga demasiado": se cambió por hueco frente a oculto. |
| Secciones Problema / Solución / Pasos en la landing | Una sola escena cuenta lo mismo sin tanto texto. |
| Efecto *scramble* "hacker" en la Agenda | Se pidió algo que pareciera escritura. |
| Efecto de escritura con un `<span>` por letra | Provocaba tirones (~82 ms de layout): se rehízo con la "pluma" de `textContent`. |
| Pie de página de la landing | Sobraba; los créditos están en este repositorio. |

---

## 6. Cómo se comprobaba cada cambio

No bastaba con que compilara. Cada cambio se verificaba en un navegador real:

- **`tsc` + `eslint` + `vite build`** sin errores ni avisos.
- **Puppeteer con Chrome** desde scripts:
  - **capturas** a 1440×900, 1280×720, 1920×1080, tablet y móvil (390 px), con fechas simuladas;
  - **medidas:** que el panel no tuviera scroll, que no hubiera desbordamiento horizontal en móvil, que el taco estuviera alineado con el logo al píxel;
  - **barridos de errores** de consola, peticiones fallidas y excepciones en todas las rutas, con y sin movimiento reducido;
  - **rendimiento:** tiempos entre fotogramas al mover la rueda y perfiles de CPU con el protocolo de DevTools (CDP);
  - **regresiones visuales** con hashes de píxeles de los lienzos.

Esos scripts vivieron fuera del repositorio. Pasarlos a tests automáticos es una de las tareas pendientes.

---

## 7. Lo aprendido

**Sobre React:**
- **El estado debe vivir lo más arriba que haga falta, y no más.** La fecha de la lupa vive en `App` porque la comparten el Horario y la Agenda; el reloj de la cabecera late cada segundo en su propio componente para no re-renderizar todo el panel.
- **No todo es estado de React.** Lo que cambia 60 veces por segundo (la pluma de escritura, el arrastre de un carrusel, los lienzos) se escribe directamente en el DOM, en *motion values* o en refs.
- **Patrones modernos:** `useSyncExternalStore` para leer la URL, `useEffectEvent` para listeners que leen el último estado sin re-suscribirse, y "ajustar el estado durante el render" cuando cambia el día.

**Sobre rendimiento:**
- **Medir antes de optimizar.** La intuición apuntaba a React; el perfil apuntó al fondo de puntos y a los nodos por letra.
- **Comparar contra una línea base.** "Tarda 20 ms" no dice nada; "tarda 20 ms más que sin el efecto" sí.
- **El layout es caro.** Animar opacidades en cientos de elementos en línea, o leer `getBoundingClientRect` justo después de cambiar el DOM, fuerza al navegador a recalcular la página.

**Sobre diseño:**
- **Un color, un significado.** Al reservar arena, coral y verde, las asignaturas tuvieron que buscar su propia paleta, y la interfaz se lee mejor.
- **Las opacidades se multiplican.** Un 35 % dentro de un 45 % es un 16 %. Fue el bug del viernes.
- **Quitar es diseñar.** La versión final tiene menos cosas que cualquiera de las anteriores.

**Sobre trabajar con IA:**
- **Lo que mejor funcionó:** pedir el plan antes del código, hacer cambios pequeños y comprobar siempre en el navegador.
- **El criterio sigue siendo humano.** Las mejores correcciones vinieron del autor: "antes del cambio no pasaba", "suena demasiado fuerte", "sobrecarga demasiado". Notar eso es el trabajo.
- **La IA también se equivoca:** una vez pasó Prettier con una configuración que no era la del proyecto y cambió el estilo de un archivo entero. Se detectó y se deshizo. Revisar los diffs importa.

---

## 8. Resultado final

A 30 de octubre de 2026 la web es:

- **Un panel de una pantalla:** horario con lupa de cristal, calendario de exámenes y escolar, agenda diaria generada y logo 3D interactivo como menú.
- **Una página de ajustes:** grupo, módulos, sonido y sincronización (de muestra).
- **Una landing animada con el scroll** que explica el concepto y termina en el acceso.
- **Adaptable:** apilada en móvil, sin scroll en escritorio.
- **Respetuosa con el movimiento reducido**, usable con teclado y con sonido opcional.
- **Comprobada:** sin errores en 32 combinaciones de pantalla, movimiento y ruta; con ~144 kB de JavaScript inicial comprimido.

Lo pendiente está listado en el [README](../README.md#estado-actual-y-limitaciones): datos de otros grupos, cuentas reales, sincronización con Microsoft 365, quitar los datos de prueba y añadir tests.
