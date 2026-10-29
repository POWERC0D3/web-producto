# Organizador de estudios DAW1A

> Proyecto personal de aprendizaje. No es una herramienta oficial del centro.

Web que junta mi **horario de clase** y el **calendario de exámenes y entregas** y, a partir de ellos, genera **recomendaciones, avisos y recordatorios** para organizarme mejor.

## Objetivo del proyecto

Aprender desarrollo frontend con un proyecto útil y que funcione de verdad:

- Programar con IA (Claude Code) entendiendo lo que se hace.
- React + TypeScript.
- Estilos con Tailwind CSS.
- Animaciones con Motion y GSAP.
- Probar estilos visuales y cuidar el diseño.

## Versión 1 (en la que nos centramos ahora)

Solo frontend, sin backend. Los datos viven en archivos JSON que actualizo a mano.

**Funcionalidades**
- **Horario**: qué clase toca ahora, la siguiente y en qué aula.
- **Calendario de exámenes y entregas**: lista o calendario con cuenta atrás para cada uno.
- **Avisos**: destacar lo urgente (por ejemplo, exámenes en los próximos 3 días).
- **Recomendaciones**: sugerencias de organización según lo que se acerca (qué repasar hoy, cómo repartir el estudio cuando hay varios exámenes seguidos).
- **Landing** de presentación con un estilo visual cuidado y animaciones.

**Datos**
- `horario.json`: clases por día, hora y aula.
- `examenes.json`: fecha, asignatura, tipo (examen, entrega, evaluación) y detalle.

**Stack**
- React + Vite + TypeScript
- Tailwind CSS
- Motion y GSAP (ScrollTrigger)
- ESLint
- Despliegue en Vercel o Netlify

## Ideas para el futuro

### Versión 2: sincronización automática del calendario
El calendario de exámenes se hace en Microsoft 365 (Excel o Word en la web). La idea es leerlo directamente con la **API de Microsoft Graph** en vez de copiar los datos a mano.

A tener en cuenta:
- Hace falta iniciar sesión con la cuenta del centro (autenticación con Microsoft).
- El centro puede bloquear que los alumnos registren aplicaciones.
- Implica algo de backend y gestión de credenciales.

Alternativas más sencillas: pedir que el calendario se comparta como archivo Excel o CSV, o como calendario `.ics`.

