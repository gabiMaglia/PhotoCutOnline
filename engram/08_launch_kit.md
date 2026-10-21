# Kit de lanzamiento — para que lo publique el PO

> Todo esto lo publica **Gabriel como autor**, no el agente. Postear haciéndose
> pasar por el fundador sería astroturfing (lo que HN/Reddit/Google castigan).
> Los textos van en bloques de código para copiar y pegar tal cual.
> Actualizado 2026-10-14 con lo de Sprints 6–8 (mediciones reales, WebP en Safari).
> Actualizado 2026-10-20: primer comentario de HN alineado con scripts/pruebas.json (93 peticiones, tiempos con GPU, POST de anuncios), «sin conexión» = después del primer recorte, y celulares siempre con u2netp (BUG-13).

> **2026-10-21 — HN sigue en el plan** (corrección: el PO NO lo descarta). No habla inglés: arma los comentarios con el agente (él aporta la idea y la experiencia; el agente traduce y da forma) y asume el riesgo de la regla de HN sobre texto editado por IA. HN no deja publicar Show HN todavía. HN está restringiendo los Show HN de cuentas nuevas: hay que participar un tiempo como usuario (comentar con criterio, sin promocionar) antes de poder postear. Además, las reglas de HN piden **no publicar texto generado ni editado por IA**. Los textos de este kit los redactó el agente: tomalos como **hoja de datos** y escribí el post con tus palabras, en HN y en Reddit. Orden nuevo: directorios → Reddit (r/SideProject, r/devsarg; r/webdev el sábado) → Show HN cuando la cuenta tenga historial.

## Antes de publicar (checklist)
- [x] **Probar en un iPhone/Safari real**: exportar "Sticker WhatsApp" y abrir el
      archivo. ✅ PO 2026-10-20 (iPhone 13): sale WebP. Si falla, sacar la frase de Safari de los posts (solo está probado
      en WebKit de Playwright, no en un iPhone).
- [ ] Probar el editor en un navegador limpio (sin caché): que cargue y el recorte ande.
- [x] Correr `npm run indexnow` ✅ 2026-10-20, 125 URLs (empuja las URLs a Bing/Copilot).
- [ ] Umami cargado (para medir el pico del lanzamiento).
- [x] Licencia: **MIT** (2026-10-20). Si preguntan «is it open source?» → «Yes, MIT». ~~Decidir si enlazás el repo (es público pero no tiene licencia: en HN te
      van a preguntar "is it open source?". Respuesta honesta: "the source is
      public, I haven't picked a license yet". O agregás una antes).
- [x] **Después de BUG-12/13/14 en prod: Recorte IA en el iPhone 13 con WebGPU ACTIVADO** (baja ~6 MB, no recarga) + modo avión: el editor abre y recorta. ✅ PO 2026-10-20.
- [ ] Bloquear 3–4 h después de cada post para responder todo.

## Datos verificados para responder preguntas
Salen de `scripts/pruebas.json` (medidos, Chrome 155, macOS, 2026-10-16). No inventar otros.
- Dos modelos según el equipo (GROW-36): con una GPU que el navegador puede usar
  (WebGPU), BiRefNet-lite; sin ella, u2netp, como antes.
- Primera vez con GPU: 114,8 MB de modelo (sin comprimir, viaja tal cual) + el
  motor WebAssembly/WebGPU de ONNX Runtime (3,5 MB con Brotli): ~118 MB, «~120 MB».
  Sin GPU: u2netp (4,6 MB) + motor WebAssembly, ~6 MB. Después queda en caché.
- Recorte IA de una foto 720×900 con GPU: 22,6 s la primera vez (baja el modelo y
  prepara la GPU), 3,9 s la segunda, 16,1 s tras recargar (vuelve a preparar la
  GPU). Con u2netp (medición anterior): 5,0 s, 2,9 s y 3,6 s. Una corrida cada
  uno, laptop, no es benchmark.
- Calidad: con BiRefNet el logo de prueba conserva la palabra de la marca; con
  u2netp se perdía. Con GPU la IA queda en memoria 5 min después del último corte
  (sin GPU, 30 s).
- Red durante el recorte: 93 peticiones, **0 bytes enviados** con la foto.
  **Ojo:** el sitio carga scripts de Google AdSense, que hacen sus propias
  peticiones (sin la foto). Alguien en HN lo va a ver en la pestaña Network:
  decirlo vos antes (está en el primer comentario).
- Sticker WhatsApp: WebP 512×512, 20,2 KB en Chrome, 19,9 KB en WebKit.
- Safari no genera WebP desde canvas (`toBlob('image/webp')` devuelve PNG): el
  editor carga libwebp compilado a WebAssembly (~110 KB) solo en ese caso, en un
  worker.
- Cada guía tiene una sección "Lo probamos" con navegador, build y números,
  incluido lo que no salió bien.

---

## 1) Show HN — la mayor palanca

**Cuándo:** martes a jueves, 8–10 AM ET = **9–11 h de Argentina** (hasta el 1/11;
después del cambio de hora en EE.UU. es 10–12 h). No pidas votos ni lo compartas
pidiendo que voten.

**Título** (elegir uno):
```
Show HN: Background remover that runs entirely in the browser (ONNX + Rust/WASM)
```
```
Show HN: PhotoCut – background remover where your photo never leaves the browser
```

**URL del post:** `https://www.photocutapp.com/editor/`

**Texto:**
```
I wanted a background remover that doesn't upload my photo to someone's server and doesn't paywall the full-resolution download, so I built one that runs entirely in the browser.

How it works:
- The cutout runs through onnxruntime-web in a Web Worker: BiRefNet-lite (fp16) on WebGPU on computers whose GPU the browser can use, u2netp (a small salient-object model, ~4.6 MB) on WASM on phones, tablets and machines without one. (Phones get u2netp even with WebGPU: a 115 MB model makes iOS kill the tab.)
- Edge refinement uses a GrabCut engine I wrote in Rust and compiled to WebAssembly.
- First use downloads ~120 MB on a computer with a GPU (the model is 115 MB) or about 6 MB on phones/tablets or without a GPU; after your first cutout it's cached and works offline.
- Export to PNG/JPG/WebP. Safari can't encode WebP from a canvas (toBlob silently returns PNG), so in that case the editor lazy-loads libwebp compiled to WASM (~110 KB) in a worker.

The honest trade-off: a model small enough to run on a laptop won't beat a big server model on the hard cases (fine hair, busy backgrounds). There are keep/erase brushes to fix those by hand.

Free, no account, no watermark. It also does compress/resize/convert, EXIF/GPS stripping, face blurring, color palettes and app-icon sets, all client-side for the same reason.

Each guide on the site has a "we tested it" section with the browser, build and the numbers I measured, including what didn't work well.

Architecture details: https://www.photocutapp.com/en/how-it-works.html

Happy to go into the WASM/ONNX side or the privacy model.
```

**Primer comentario (apenas publicás):**
```
Author here. Two things people usually ask:

1. "Is the photo really not uploaded?" Open devtools → Network while you run the cutout, or turn off wifi after your first cutout (the model is cached by then). In my last measurement the session made 93 requests and none carried the image.

2. You will see requests to Google domains: the site runs AdSense to pay for hosting. Those scripts make their own requests (in one run I saw a few small ad-measurement POSTs, under 0.5 KB each), but the photo never goes to them or to me. A content blocker doesn't break the editor.

Speed depends on the path: on a computer with a GPU (BiRefNet) a 720×900 photo took 22.6 s the first time (model download + GPU warm-up) and ~4 s after; without one (u2netp, also what phones use) ~5 s and ~3 s. Single runs on a laptop, not a benchmark. Speed on low-end phones is the part I'd most like feedback on.
```
> Verificá el punto 2 antes de postear: abrí el editor con uBlock y confirmá que
> el recorte anda. Si no anda, borrá esa última frase.

**Reglas de oro:** respondé todo, incluso lo crítico, sin defenderte; si te
marcan un error, agradecé y anotalo (después va al backlog).

---

## 2) r/privacy (y PrivacyGuides forum)

Leé las reglas de autopromoción antes (algunas piden flair o permiso de mods).
Ángulo: "resolví esto sin subir nada", no "miren mi producto".

**Título:**
```
I built a background remover that runs locally in the browser, so the photo is never uploaded
```
**Texto:**
```
Most free background removers upload your photo to their servers to process it. I wanted one that doesn't, so the AI model runs inside the browser (WebAssembly + ONNX). The image never leaves your device: you can check the Network tab, or turn off wifi after your first cutout (the model is cached by then) and it keeps working.

It also strips EXIF/GPS metadata and can blur faces, same local approach.

Full disclosure: the site shows Google ads to cover hosting, and those scripts make their own network requests. They don't get the photo. No account, free.

https://www.photocutapp.com/editor/

Feedback welcome, especially from people who audit this kind of thing.
```

---

## 3) r/webdev — ángulo técnico (Safari + WebP)

Mejor 2–3 días después de HN. Usar el flair "Showoff Saturday" si lo publicás un
sábado (r/webdev limita la autopromoción al resto de los días).

**Título:**
```
Safari's canvas.toBlob('image/webp') silently gives you a PNG. Here's how I handled it in a browser-only image editor
```
**Texto:**
```
I'm building an image editor that runs entirely client-side (background removal with onnxruntime-web + a Rust/WASM GrabCut). One export preset is the WhatsApp sticker: 512×512 WebP under 100 KB.

In Chrome and Firefox, canvas.toBlob(cb, 'image/webp', q) works. In Safari/WebKit it doesn't throw: it hands you a PNG blob. If you name the file by the format you asked for, you ship a PNG called .webp.

What I ended up doing:
- Feature-detect once by encoding a tiny canvas and checking blob.type, memoized per context (main thread vs worker).
- If native WebP isn't available, lazy-load libwebp compiled to WASM (@jsquash/webp, ~110 KB brotli) in a dedicated worker. Chrome users never download it.
- If the worker or the import fails, drop it and recreate it on the next try (a failed dynamic import stays cached otherwise).
- Name the file from the blob's real type, never from the requested one.
- Tests run in Playwright with Chromium and WebKit; the WebKit run checks the bytes start with RIFF....WEBP.

Result: 512×512 sticker of ~20 KB in both engines.

Live: https://www.photocutapp.com/editor/
Happy to share code details.
```

---

## 4) r/SideProject

**Título:**
```
PhotoCut: a free image editor where everything (including the AI background removal) runs in your browser
```
**Texto:**
```
Side project I've been working on: an image editor with no uploads. Background removal, background change, stickers for WhatsApp/Telegram, compress/convert, EXIF/GPS removal, face blur, color palettes and app icons. All of it runs client-side with WebAssembly.

What I'm proudest of: every guide on the site has a "we tested it" section with the real numbers I measured (time, file size, how many pixels came out transparent) and what didn't go well.

What I'd love feedback on: speed on low-end phones, and edge quality on hair.

https://www.photocutapp.com/
```

---

## 5) r/devsarg (en castellano)

**Título:**
```
Hice un editor de imágenes que quita el fondo con IA sin subir la foto a ningún servidor
```
**Texto:**
```
Lo armé porque los removedores de fondo gratis suben la foto a sus servidores y después te cobran la descarga en alta.

Todo corre en el navegador:
- Recorte con onnxruntime-web, dentro de un Web Worker: BiRefNet-lite en la GPU (WebGPU) en computadoras donde el navegador puede usarla; u2netp en WebAssembly en celulares, tablets y equipos sin GPU (en el celular uso u2netp aunque haya WebGPU: con 115 MB iOS cierra la pestaña).
- Refinado de bordes con un GrabCut que escribí en Rust y compilé a WebAssembly.
- La primera vez baja ~120 MB en una computadora con GPU (el modelo pesa 115 MB) o ~6 MB en el celular o sin GPU; después del primer recorte queda en caché y anda sin internet.
- Safari no genera WebP desde canvas (te devuelve PNG sin avisar), así que en ese caso cargo libwebp compilado a WASM solo cuando hace falta.

Gratis, sin cuenta y sin marca de agua. Tiene publicidad de Google para pagar el hosting (esas peticiones no llevan la foto, lo pueden ver en la pestaña Red).

https://www.photocutapp.com/editor/

Acepto críticas, sobre todo de rendimiento en celulares.
```

---

## 6) Product Hunt (opcional, más tarde)

Lanzar un martes a jueves, 00:01 hora del Pacífico. Necesitás cuenta con algo de
actividad previa.
- **Nombre:** `PhotoCut`
- **Tagline (≤60):**
  ```
  Remove backgrounds in your browser. Your photo never uploads.
  ```
- **Descripción (≤260):**
  ```
  Free image editor where the AI runs on your device: background removal, stickers, compression, EXIF/GPS stripping, face blur, palettes and app icons. No account, no watermark, works offline after the first use.
  ```
- **Primer comentario:** reusar el del Show HN.

---

## 7) Directorios (enlaces permanentes, poco esfuerzo)
Alta manual en directorios gratuitos de herramientas y de apps con IA. Estar
listado en un directorio está bien; lo prohibido es que NUESTRAS páginas nombren
competidores. No pagar por alta ni por "backlinks".

---

## Qué medir después
- Umami: pico por lanzamiento y referrers (news.ycombinator.com, reddit.com).
- Search Console a las 2–3 semanas: páginas indexadas, impresiones, clics.
- Anotar en `engram/10_auditoria_2026-10.md` §6 la comparación contra la línea
  base (≈86 visitantes/mes). AdSense se reaplica con ≥1.000 visitantes/mes
  sostenidos 4 semanas, no antes.
