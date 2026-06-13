# PhotoCut como MCP / API de pago por consulta — exploración (2026-06-12)

Idea de Gabriel: exponer el motor (recorte, iconos, composición) como un
servicio que recibe imagen + parámetros y devuelve el resultado, cobrando por
consulta. ¿Se puede hacer como MCP? ¿Sin backend? ¿Con una lambda?

## 1. Lo primero: qué es un servidor MCP y dónde vive

MCP (Model Context Protocol) es el protocolo con el que los agentes de IA
(Claude, IDEs, etc.) descubren y llaman "tools" externas. Un servidor MCP
**no es una página web**: es un proceso aparte que habla el protocolo por
una de dos vías:

1. **Local (stdio):** un ejecutable/paquete npm que el usuario instala y su
   cliente de IA lanza en su máquina. Cero servidores nuestros.
2. **Remoto (HTTP streamable):** un endpoint HTTPS que el cliente de IA
   llama por red, con OAuth/API key. Aquí sí hay backend — y aquí se cobra.

**Respuesta directa a la pregunta "¿como con React, sin back?":** no — la
SPA no puede *ser* el servidor MCP (el navegador no puede escuchar
conexiones). Pero NO hace falta construir un backend "de app": las dos vías
de arriba reutilizan el motor que ya tenemos sin tocar la web.

## 2. La ventaja injusta: el motor ya es portable

`crates/photocut-core` (Rust) ya compila a tres destinos: WASM para la web,
nativo para Tauri… y puede compilar a **un binario de servidor**. La IA
(u2netp, 4.6 MB, Apache-2.0) corre con `ort` (ONNX Runtime para Rust) o con
onnxruntime-node. Es decir: el "producto API" es empaquetado, no desarrollo
de motor nuevo.

## 3. Las tres formas de hacerlo, comparadas

### A. Paquete npm `photocut-mcp` (local, gratis) — el quick win

- Node + el WASM existente + onnxruntime-node. Tools: `remove_background`,
  `make_icons`, `composite_background`, `crop_to_content`.
- El usuario lo agrega a Claude Code/Desktop con una línea de config; las
  imágenes **no salen de su máquina** (¡consistente con nuestra marca!).
- No se cobra por uso, pero es marketing potente con la audiencia dev (la
  misma de Carbon/EthicalAds) y el funnel a la web/app.
- Esfuerzo: bajo (días). Riesgo: ninguno. Costo de operación: cero.

### B. API REST en lambda (pago por consulta) — el negocio

- `POST /v1/cutout`, `POST /v1/icons` con imagen + parámetros → resultado.
  Auth por API key, créditos prepagos (Stripe).
- Infra: AWS Lambda (contenedor con el binario Rust + modelo en la imagen;
  2 GB RAM, ~1–3 s por imagen) detrás de API Gateway. Alternativa:
  Cloudflare Workers con el WASM que ya tenemos (más barato, pero 128 MB de
  RAM aprieta para imágenes grandes — Lambda da más margen).
- **Números:** una invocación de 2 GB × 2 s cuesta ≈ $0.0003. remove.bg
  cobra ~$0.10–0.20 por imagen vía API. Cobrando $0.01–0.02 por crédito el
  margen es >95% y seguimos siendo 10× más baratos que el líder.
- Esfuerzo: medio (semanas: empaquetado, auth, billing, docs, límites).
- Importante: NO toca la web. La promesa "tus fotos nunca salen de tu
  navegador" sigue intacta para usuarios de la página; la API es un canal
  para desarrolladores que *eligen* mandar imágenes.

### C. Servidor MCP remoto (encima de B)

- Una vez que existe la API REST, exponerla como MCP remoto es una capa
  fina (el SDK de MCP en TypeScript sobre el mismo endpoint, con la misma
  API key). Los agentes de IA se vuelven un canal de venta más: "Claude,
  quitale el fondo a estas 200 fotos" → 200 créditos.

## 4. Sobre "la lógica debería vivir en una lambda y la app enviar ahí"

Matiz importante: **para la web, no**. Mover el proceso de la página a una
lambda rompería el diferencial (privacidad, offline, costo cero por uso) y
nos pondría a competir con remove.bg en su cancha. La arquitectura sana es:

```
photocut-core (Rust, único motor)
 ├─ WASM → web (gratis, local, ads)        ← no cambia
 ├─ nativo → desktop Tauri                  ← no cambia
 └─ binario lambda → API de pago (B) → MCP remoto (C)
            ↑ npm local (A) usa el WASM
```

La web y la API comparten motor pero son productos distintos para públicos
distintos. La app web *podría* opcionalmente ofrecer "procesar en la nube"
para móviles de gama baja, pero como opt-in explícito y más adelante.

## 5. Recomendación y orden

1. **Ahora no** — el foco acordado es tráfico + ads (ver
   [INSTRUCCIONES-MONETIZACION.md](INSTRUCCIONES-MONETIZACION.md)).
2. **Fase A (cuando haya tráfico estable):** publicar `photocut-mcp` local.
   Barato, refuerza la marca dev y mide el interés real ("¿cuántos lo
   instalan?") sin costo de infra.
3. **Fase B (si A muestra demanda o llegan pedidos de API):** lambda Rust +
   API keys + Stripe. Recién acá se cobra por consulta.
4. **Fase C:** MCP remoto sobre B.

La señal para pasar de A a B: issues/mails pidiendo "¿tienen API?", o uso
intenso del paquete local. Eso valida pagar el esfuerzo de billing.

## Fuentes / referencias técnicas

- [Model Context Protocol — especificación](https://modelcontextprotocol.io)
- [MCP servers remotos con OAuth (Anthropic docs)](https://docs.anthropic.com/en/docs/agents-and-tools/mcp)
- [ort — ONNX Runtime para Rust](https://ort.pyke.io)
- [AWS Lambda pricing](https://aws.amazon.com/lambda/pricing/)
- [remove.bg API pricing (referencia competitiva)](https://www.remove.bg/pricing)
