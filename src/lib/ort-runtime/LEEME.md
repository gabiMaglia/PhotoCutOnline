Runtime WASM de onnxruntime-web (MIT), vendoreado porque el package.json del
paquete no expone ./dist/* en "exports" y necesitamos URLs same-origin
deterministas (privacidad: nada se carga de CDNs de terceros).
Actualizar al subir onnxruntime-web:
  cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.{wasm,mjs} src/lib/ort-runtime/

Camino GPU (GROW-36): el runtime WebGPU (`ort-wasm-simd-threaded.asyncify.{wasm,mjs}`,
23,7 MB sin comprimir, ~3,4 MB con Brotli) NO se vendorea: desde 1.26 el paquete lo
expone en "exports" y aiSegmenter.js lo importa con `?url` desde
`onnxruntime-web/…`. Vite lo emite como asset same-origin y solo se pide en el
camino GPU. Al subir onnxruntime-web, verificar que el bundle
`ort.webgpu.bundle.min.mjs` siga pidiendo el asyncify (y no jsep/jspi).
