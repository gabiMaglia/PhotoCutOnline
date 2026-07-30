# PhotoCut Studio — Launch / difusión kit

Textos listos para pegar. Primera persona (Gabriel Maglia), honestos, sin nombrar
competidores. URL: https://www.photocutapp.com

---

## 1. Show HN (Hacker News)

**Título** (URL = https://www.photocutapp.com):
```
Show HN: PhotoCut – background removal and image tools, 100% in the browser
```

**Primer comentario** (postealo apenas suba):
```
Hi HN, I'm Gabriel. I built PhotoCut because almost every "free" background
remover uploads your photo to a server, processes it there, and after a few
uses asks you to pay or sign up.

PhotoCut does the opposite: everything runs inside your browser. There's no
backend that receives your images — there's literally nowhere to upload them.
You can open a photo, disconnect from the internet, and keep cutting out; it
still works.

How it works:
- Auto background removal uses a u2netp ONNX model (4.6 MB, Apache-2.0) running
  via onnxruntime-web in a Web Worker, with WebGPU/WebGL acceleration when
  available.
- Interactive cutout is GrabCut compiled to WASM, plus pixel-zoom refine brushes.
- Export is a real alpha channel (PNG/WebP).

Besides cutout it also does: change/white background, round avatars, WhatsApp/
Telegram stickers, app icons + favicons + PNG→ICO, watermark, an EXIF/metadata
viewer + stripper, color palette/HEX with WCAG contrast, and batch (a ZIP of
transparent PNGs).

Free, no signup, no watermark. It's an independent project — I'd love feedback,
especially on edge quality (hair) and anything that feels off.
```

Tips: martes–jueves ~8–10am ET. No pidas upvotes. Respondé comentarios rápido.

---

## 2. Reddit

Subs: r/SideProject, r/webdev (días distintos). Opcional r/InternetIsBeautiful.

**r/SideProject — título:**
```
I built a background remover that runs 100% in your browser — your photo never gets uploaded
```
**Cuerpo:**
```
The thing that always bugged me: "free" cutout tools upload your photo to a
server, then paywall or watermark it. So I built one where nothing leaves your
device — the AI runs in the browser (WASM + an ONNX model), and it even works
offline after the first load.

It also does white/changed backgrounds, round avatars, WhatsApp/Telegram
stickers, app icons + favicons, watermarks, an EXIF/GPS metadata stripper, and
color-palette extraction with WCAG contrast checks.

Free, no signup, no watermark. It's a solo project — happy to hear what breaks
or what's missing.

https://www.photocutapp.com
```

**r/webdev — título:**
```
Show-off: full image editor (background removal, icons, stickers) with zero backend — WASM + ONNX in the browser
```
**Cuerpo:**
```
Sharing a side project: an image editor where all processing is client-side.
No server receives the images at all.

Stack: React + Vite MPA, u2netp ONNX via onnxruntime-web in a Web Worker
(WebGPU/WebGL fallback), GrabCut compiled to WASM for interactive cutout,
canvas for the rest. Model is cached after first load so it works offline.

Curious what this community thinks about the tradeoffs of doing everything in
the browser (bundle size vs. privacy vs. no infra cost). AMA about the setup.

https://www.photocutapp.com
```

Tips: leé reglas de cada sub. Respondé todos los comentarios.

---

## 3. Product Hunt

- **Name:** PhotoCut Studio
- **Tagline (60):** `Remove backgrounds & edit images — 100% in your browser`
- **Topics:** Design Tools, Photography, Privacy, Web App

**Description:**
```
A free image editor where nothing leaves your device. Remove backgrounds with
AI, change or whiten backgrounds, make round avatars and WhatsApp/Telegram
stickers, generate app icons and favicons, add watermarks, strip EXIF/GPS
metadata, and pull color palettes — all processed in your browser, with no
uploads, no signup and no watermark. Works offline after the first load.
```

**Primer comentario del maker:**
```
Hey Product Hunt 👋 I'm Gabriel, the maker.

I got tired of "free" background removers that upload your photo, watermark it,
or paywall it after a few tries. So I built the opposite: PhotoCut runs entirely
in your browser — the AI model and every tool process locally, your images never
touch a server, and it keeps working even offline.

It grew from a background remover into a small studio: cutout, backgrounds,
avatars, stickers, app icons/favicons, watermarks, a metadata stripper and a
color-palette tool. Free, no account.

Would genuinely love your feedback on edge quality and what tool to add next.
```

Tip: martes/miércoles 00:01 PST. Tené 3-4 imágenes/GIF listos.

---

## 4. Directorios

**Blurb corto:**
```
PhotoCut Studio — a free, in-browser image editor. Remove backgrounds with AI,
change/whiten backgrounds, make avatars, stickers, app icons and favicons, add
watermarks, strip EXIF metadata and extract color palettes. 100% client-side:
your photos are never uploaded. No signup, no watermark.
```

Dónde: SaaSHub, Toolify/Toolfinder, BetaList, awesome-lists de GitHub (PR),
r/InternetIsBeautiful. No armes páginas comparando con competidores; comunicá
la ventaja en positivo.

---

## 5. LinkedIn

```
Durante años me molestó lo mismo: casi todos los editores de fotos "gratis"
suben tu imagen a un servidor, la procesan ahí, y después te piden pagar,
crear una cuenta o te dejan una marca de agua.

Así que construí lo contrario.

PhotoCut Studio es un editor de imágenes que corre 100% dentro de tu navegador.
No hay backend que reciba tus fotos: no hay a dónde subirlas. Podés abrir una
imagen, desconectarte de internet y seguir editando — funciona igual.

Por dentro:
→ Recorte de fondo con IA (modelo ONNX corriendo local vía WebAssembly)
→ Recorte interactivo con GrabCut compilado a WASM
→ Y un montón más: fondos, avatares, stickers, iconos de app, favicons,
  marca de agua, lector/limpiador de metadatos EXIF, paleta de colores…

Gratis, sin registro, sin marca de agua. Lo hice de punta a punta: producto,
diseño, código y deploy.

La privacidad no es una promesa de marketing acá — es una consecuencia técnica
de dónde se procesa la imagen (en tu equipo, no en mi servidor).

Me encantaría que lo prueben y me digan qué le agregarían 👇
https://www.photocutapp.com

#WebDevelopment #React #WebAssembly #Privacy #IndieHacker #FrontEnd
```

Tip: martes–jueves 8–10am. Probá el link en el primer comentario (LinkedIn baja
el alcance de posts con links externos en el cuerpo).

---

## Orden recomendado
1. LinkedIn (tu red da el empujón inicial + primeros backlinks)
2. Show HN (martes am ET)
3. Reddit (días separados)
4. Product Hunt (con GIFs)
5. Directorios (en paralelo)

Cada post con tracción = un backlink real, que es lo que le falta al sitio para
indexar mejor y para que AdSense no lo vea aislado.

## Screenshots para adjuntar
En `marketing/screenshots/` (generados del editor real).
