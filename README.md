# byformain
PWA personal para objetivos y hábitos. Sin backend, sin build: HTML + CSS + JS plano. Datos en localStorage del iPhone.

Archivos: index.html, style.css, logic.js (lógica pura), chessengine.js (motor de ajedrez propio), mental.js (cálculo mental), grammar-data.js (banco original de ~400 preguntas de gramática), grammar.js (sesiones, corrección y marcas de gramática), speaking.js (frases, puntuación de shadowing), english.js (UI de Gramática y Speaking), modules.js (UI de Entrenar), app.js (UI), sw.js (offline), manifest.webmanifest, icons/.

Módulos «Entrenar»: Ajedrez contra el ordenador (3 niveles), Cálculo mental, Gramática inglesa (A2–C1, test y completar, explicación en español, repaso de fallos, progreso) y Speaking y listening (Hablar con temporizador, Shadowing y Dictado); al terminar anotan solos en los objetivos vinculados (Editar objetivo → Vincular a módulo). Sin librerías externas ni CDN.

### Speaking: voz del dispositivo
Usa la Web Speech API (voz del modelo con speechSynthesis, transcripción con SpeechRecognition/webkitSpeechRecognition) y MediaRecorder para escucharte. En iPhone, la transcripción funciona en Safari (iOS 14.5+) pero puede no estar disponible o pedir permisos en la app instalada en pantalla de inicio; la pantalla de configuración muestra qué está disponible y, si no hay reconocimiento, se practica con temporizador, escuchar el modelo y autoevaluación (1–5). El audio grabado no se guarda (solo mientras la pantalla está abierta). El reconocimiento puede enviar el audio al servicio de voz del sistema, según el dispositivo.

Se anotan solos «Speaking en inglés» (Hablar y Shadowing, en minutos) y «Listening en inglés» (Dictado) si el objetivo está vinculado; un objetivo también puede vincularse a Gramática.

## Publicar (hace falta HTTPS)
- GitHub Pages: repo público con estos archivos en la raíz → Settings → Pages → Deploy from branch (main, /root). URL: https://<usuario>.github.io/<repo>/
- Netlify Drop (https://app.netlify.com/drop): arrastra la carpeta (o byformain.zip) y reclama el sitio con una cuenta gratuita para que no caduque.
- Cloudflare Pages / Vercel: subida directa de la carpeta, cuenta gratuita.

## Instalar en iPhone
Abrir la URL en Safari → Compartir → «Añadir a pantalla de inicio».

## Tests
`TZ=Europe/Madrid node --test tests/*.test.js`, `python tests/e2e.py` y `python tests/e2e_english.py` (Playwright + Chrome, con SpeechRecognition simulado), `python tests/screenshots.py` (capturas en screenshots/).
