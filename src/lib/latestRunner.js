// Una tarea por vez. Si llegan más mientras una corre, solo la ÚLTIMA espera
// turno y las de en medio se descartan (salen como stale). El encoder WASM
// trabaja de a una: encolar cada paso del slider lo dejaría segundos atrás
// (GROW-35, A1).
export function createLatestRunner() {
  let running = false;
  let next = null;
  const start = (entry) => {
    running = true;
    Promise.resolve()
      .then(entry.job)
      .then((value) => entry.resolve({ stale: false, value }), entry.reject)
      .finally(() => {
        running = false;
        if (next) {
          const n = next;
          next = null;
          start(n);
        }
      });
  };
  return {
    run(job) {
      return new Promise((resolve, reject) => {
        const entry = { job, resolve, reject };
        if (!running) return start(entry);
        next?.resolve({ stale: true });
        next = entry;
      });
    },
  };
}
