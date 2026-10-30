// Despliegue a agenda.alvaro.cloud: compila y sube dist/ a S3, y vacía la caché de index.html en CloudFront.
// Uso: npm run deploy   (necesita la CLI de AWS configurada con `aws configure`)
//
// Ni el bucket ni el id de la distribución son secretos (las claves viven en ~/.aws, nunca en el repo).
import { execFileSync, execSync } from 'node:child_process'

const BUCKET = 'agenda-alvaro-cloud'
const DISTRIBUCION = 'E1H6MVAAVA9EHI' // CloudFront de agenda.alvaro.cloud

const destino = `s3://${BUCKET}`
// Sin shell: los argumentos llevan espacios y comodines (*) que una shell partiría o expandiría
const aws = (...args) => execFileSync('aws', args, { stdio: 'inherit' })

// Caché:
// - assets/ lleva un hash del contenido en cada nombre (index-CtwxXVHZ.js): si cambia, cambia el nombre → un año, inmutable
// - el resto (sonidos, iconos) mantiene su nombre entre versiones → un día
// - index.html apunta a los assets nuevos → sin caché (el navegador pregunta siempre si hay versión nueva)
const UN_ANO = 'public, max-age=31536000, immutable'
const UN_DIA = 'public, max-age=86400'

// El tipo de cada archivo se pone a mano: en Windows la CLI lo adivina leyendo el registro y a veces falla
const TIPOS = {
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  woff2: 'font/woff2',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
}

console.log('\n▸ Compilando…')
execSync('npm run build', { stdio: 'inherit' }) // npm es un .cmd en Windows: necesita shell

// 1) Primero todo menos index.html: así nunca hay un index.html nuevo apuntando a archivos que aún no han subido.
//    Los assets viejos NO se borran: alguien con la web abierta puede pedir todavía un trozo diferido de la versión anterior
console.log(`\n▸ Subiendo archivos a ${destino}…`)
for (const [ext, tipo] of Object.entries(TIPOS)) {
  for (const [carpeta, cache] of [
    ['assets/*', UN_ANO],
    ['*', UN_DIA],
  ]) {
    const filtro = carpeta === '*' ? ['--exclude', 'assets/*'] : []
    aws('s3', 'cp', 'dist', destino, '--recursive', '--only-show-errors',
      '--exclude', '*', '--include', carpeta === '*' ? `*.${ext}` : `assets/*.${ext}`, ...filtro,
      '--content-type', tipo, '--cache-control', cache)
  }
}

// 2) index.html al final
aws('s3', 'cp', 'dist/index.html', `${destino}/index.html`, '--only-show-errors',
  '--content-type', 'text/html; charset=utf-8', '--cache-control', 'no-cache')

// 3) CloudFront guarda copias por todo el mundo: se le pide que olvide la de index.html (gratis hasta 1000 rutas al mes)
if (DISTRIBUCION) {
  console.log('\n▸ Vaciando la caché de index.html en CloudFront…')
  aws('cloudfront', 'create-invalidation', '--distribution-id', DISTRIBUCION, '--paths', '/index.html', '/', '--query', 'Invalidation.Status', '--output', 'text')
} else {
  console.log('\n(sin DISTRIBUCION: no se vacía la caché de CloudFront)')
}

console.log('\n✓ Desplegado en https://agenda.alvaro.cloud\n')
