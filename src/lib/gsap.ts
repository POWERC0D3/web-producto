import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

// Los plugins de GSAP se registran UNA vez para toda la app (como configurar un bean en Spring).
// - ScrollTrigger: liga animaciones a la posición del scroll.
// - useGSAP: un useEffect para GSAP que deshace solas las animaciones al desmontar el componente.
gsap.registerPlugin(ScrollTrigger, useGSAP)

export { gsap, ScrollTrigger, useGSAP }
