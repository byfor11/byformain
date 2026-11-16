# byformain
PWA personal para objetivos y hábitos. Sin backend, sin build: HTML + CSS + JS plano. Datos en localStorage del iPhone.

Archivos: index.html, style.css, logic.js (lógica pura), chessengine.js (motor de ajedrez propio), mental.js (cálculo mental), modules.js (UI de Entrenar), app.js (UI), sw.js (offline), manifest.webmanifest, icons/.

Módulos «Entrenar»: Ajedrez contra el ordenador (3 niveles) y Cálculo mental; al terminar anotan solos en los objetivos vinculados (Editar objetivo → Vincular a módulo). Sin librerías externas ni CDN.

## Publicar (hace falta HTTPS)
- GitHub Pages: repo público con estos archivos en la raíz → Settings → Pages → Deploy from branch (main, /root). URL: https://<usuario>.github.io/<repo>/
- Netlify Drop (https://app.netlify.com/drop): arrastra la carpeta (o byformain.zip) y reclama el sitio con una cuenta gratuita para que no caduque.
- Cloudflare Pages / Vercel: subida directa de la carpeta, cuenta gratuita.

## Instalar en iPhone
Abrir la URL en Safari → Compartir → «Añadir a pantalla de inicio».

## Tests
`TZ=Europe/Madrid node --test tests/*.test.js` y `python tests/e2e.py` (Playwright + Chrome; ver tests/).
