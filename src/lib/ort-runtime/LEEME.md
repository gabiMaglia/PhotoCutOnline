Runtime WASM de onnxruntime-web (MIT), vendoreado porque el package.json del
paquete no expone ./dist/* en "exports" y necesitamos URLs same-origin
deterministas (privacidad: nada se carga de CDNs de terceros).
Actualizar al subir onnxruntime-web:
  cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.{wasm,mjs} src/lib/ort-runtime/
