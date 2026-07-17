# Kit de lanzamiento — para que lo publique el PO

> Todo esto lo publica **Gabriel como autor**, no el agente. Postear haciéndose
> pasar por el fundador sería astroturfing (lo que HN/Reddit/Google castigan).
> Estos son borradores listos para revisar y publicar.

## Antes de publicar (checklist)
- [ ] El deploy con "cómo funciona", llms.txt y las tools nuevas ya está live.
- [ ] Correr `npm run indexnow` (empuja las URLs a Bing/Copilot).
- [ ] Umami cargado (para medir el pico de tráfico del lanzamiento).
- [ ] Probar el editor en un navegador limpio: que cargue rápido y el recorte ande.

---

## 1) Show HN (Hacker News) — la mayor palanca

**Cuándo:** martes a jueves, ~8–10 AM ET (cuando HN está activo). Estar
disponible las siguientes 3–4 h para responder TODOS los comentarios.

**Título** (elegir uno; HN premia lo honesto y técnico, sin hype):
- `Show HN: Background removal that runs 100% in your browser (WASM + ONNX)`
- `Show HN: A private background remover – your photos never leave the browser`

**Texto del post:**
> I got tired of background removers that make you upload your photo to their
> server, then paywall the full-resolution download. So I built one that runs
> entirely in the browser — the image never gets uploaded.
>
> The cutout uses u2netp (a ~4.4 MB salient-object model) via onnxruntime-web,
> compiled to WebAssembly, plus a GrabCut engine I wrote in Rust and compiled to
> WASM for refining edges. First use downloads the model (~4.4 MB, then cached);
> after that it works offline. You can watch the Network tab and see nothing
> gets uploaded.
>
> Trade-off is honest: a model small enough to run on your device won't beat a
> big cloud model on the hardest cases (very fine hair, busy backgrounds), so I
> added keep/erase brushes to fix those by hand.
>
> It's free, no account, no watermark. There's also convert/compress/resize,
> EXIF/GPS stripping, a color palette tool and app-icon generation — all
> client-side for the same reason.
>
> How it works, in more detail: https://www.photocutapp.com/en/how-it-works.html
> Tool: https://www.photocutapp.com/editor/
>
> Happy to answer questions about the WASM/ONNX side or the privacy model.

**Primer comentario (opcional, apenas posteás)** — anticipá la pregunta obvia:
> Author here. The most common question is "is it really not uploaded?" — yes,
> open devtools → Network while you cut out an image, or just turn off wifi
> after the page loads. The heavy part was getting onnxruntime-web + the Rust
> GrabCut to play nicely at a usable speed on mid-range laptops; happy to go
> into that.

**Reglas de oro en HN:**
- Respondé todo, incluso lo crítico, sin ponerte a la defensiva.
- No pidas upvotes (te penalizan). No lo compartas en redes pidiendo que voten.
- Si te destrozan un punto, agradecé y anotalo — la audiencia lo valora.

---

## 2) Comunidades de privacidad (el encaje más natural)

**r/privacy, r/privacytoolsIO, PrivacyGuides forum.** Leé las reglas de
autopromoción de cada una ANTES (varias piden flair o permiso de mods).

**Ángulo (NO "miren mi producto", sí "resolví esto sin subir nada"):**
> Título: A background remover that runs locally in the browser — nothing gets
> uploaded
>
> Most "free" background removers upload your photo to their servers. I built
> one where the AI runs in the browser (WASM + ONNX), so the image never leaves
> your device — you can verify it in the Network tab or with wifi off. Free, no
> account. Sharing in case it's useful here.

---

## 3) Otras plataformas (menor esfuerzo, enlaces reales)

- **r/webdev, r/SideProject** (el "I built" con el ángulo técnico — mismo que HN).
- **r/InternetIsBeautiful** (regla estricta: título descriptivo, sin marca).
- **Lobsters** (si conseguís invitación; audiencia técnica como HN).
- **Directorios**: alta manual en directorios de herramientas gratis y de apps
  con IA. Enlace permanente. (Estar LISTADO en un directorio "alternativas a X"
  no viola la política — eso era sobre NUESTRAS páginas.)

---

## Qué medir después
En Umami: pico de visitas por lanzamiento y de dónde vienen. En Search Console
(2–3 semanas después): si sube "Páginas indexadas" y si aparecen impresiones.
Si el Show HN funciona, los backlinks que deje aceleran el ranking del resto.
