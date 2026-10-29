# Referencias visuales

Las capturas están en esta carpeta (4 por vídeo). Como son imágenes fijas, aquí se describe también el movimiento de cada vídeo.

## 1. Peces (`inspiracion1-peces-*.jpg`)
- Peces dorados dibujados con una **cuadrícula de puntos** (halftone), color ámbar/dorado sobre negro.
- Se mueven nadando de forma fluida y suben **partículas/burbujas** de puntos sueltos.
- Idea a tomar: forma hecha de puntos con un único color de acento sobre fondo oscuro, y partículas flotando.

## 2. Faro (`inspiracion2-faro-*.jpg`)
- Faro dibujado con **caracteres y símbolos** (A, I, 0, 1, +, ◆, ●) en lila, con algunos caracteres resaltados en amarillo.
- Un **haz de luz gira** desde la parte alta del faro; donde pasa, el texto de la tabla de arriba se **"rompe" en caracteres aleatorios** (efecto glitch/scramble) y luego se recompone.
- Tabla de datos en tipografía **monoespaciada** (códigos A1, B2…, descripciones y tiempos 3:10, 4:06…).
- Titular en sans en mayúsculas abajo a la izquierda ("A BEACON FOR AUTONOMOUS CODE").
- Idea a tomar: tabla monoespaciada tipo terminal, efecto scramble al revelar texto y un "foco" que destaca algo (para el examen más urgente).

## 3. Cubo "pensando" (`inspiracion3-cubo-pensando-*.jpg`)
- Interfaz clara tipo chat. A la izquierda, un objeto 3D hecho de **puntos (dithering)** que se va **transformando** (cubo de Rubik → pieza de puzle → brazo robot) con puntos sueltos alrededor.
- A la derecha, un bloque **"Thinking 3.1s… 9.0s… 15.0s"** con un contador de tiempo y pasos que **aparecen uno a uno** (los anteriores en gris, el actual en negro). Al final se convierte en "Thought 20s" y aparece la respuesta escribiéndose.
- Idea a tomar: la animación de las **recomendaciones** ("Pensando…" con pasos como "Revisando exámenes…", "BADAT en 3 días…" y después el consejo final).

## 4. Flor ASCII vs original (`inspiracion4-flor-ascii-*.jpg`)
- Landing clara con titular grande en sans y un campo de texto tipo chat con sombra suave.
- Flores/molinillos en **ASCII gris** (caracteres "X" densos) que giran y flotan alrededor del contenido.
- En la primera captura se ve un **slider de comparación** (original vs versión ASCII).
- Idea a tomar: formas en ASCII como decoración en movimiento detrás del contenido.

## Componente de referencia
- `ascii-wake.tsx` (de bencho.dev): forma en halftone de puntos que, al pasar el ratón, deja un **rastro** donde los puntos se convierten en caracteres cada vez más densos (`. : - = + * # % @`) y luego se enfrían. Al hacer clic sale una onda. Usarlo como referencia de técnica, no copiarlo tal cual.

## Aplicación al proyecto
- Fondo oscuro y acentos de los colores del logo del instituto (ver CLAUDE.md).
- Logo / arcos del instituto en halftone ASCII interactivo en el hero.
- Tipografía monoespaciada para horario, horas y cuentas atrás.
- Texto que se decodifica (scramble) al aparecer y al cambiar números.
- Recomendaciones con la animación de "Pensando…" del vídeo 3.
- El examen más urgente destacado con un foco o resplandor, como el haz del faro.
