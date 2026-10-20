// Marca persistente «hay un intento con BiRefNet en curso» (BUG-13).
//
// Si iOS mata la pestaña por memoria no hay excepción que atrapar: lo único que
// sobrevive es lo que ya se escribió. Va en IndexedDB porque existe en workers
// (localStorage no) y persiste entre sesiones. Nada de acá puede romper el editor:
// sin almacenamiento (modo privado, bloqueado, colgado) la marca simplemente no
// existe y la decisión de modelo cae a la regla del dispositivo.
const DB = "photocut-ai";
const STORE = "flags";
const KEY = "birefnet-attempt";
// un IndexedDB colgado no puede frenar el recorte
const TIMEOUT_MS = 2000;
// una marca vieja no puede dejar a una computadora en u2netp para siempre
export const MARK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function withTimeout(p, fallback) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), TIMEOUT_MS);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = globalThis.indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("indexedDB blocked"));
  });
}

/** Corre `op(store)` y resuelve con su resultado recién cuando la transacción se confirmó. */
async function run(mode, op) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close?.();
  }
}

// siempre resuelve: ante cualquier fallo devuelve `fallback`
const safe = (fn, fallback) => withTimeout(Promise.resolve().then(fn).catch(() => fallback), fallback);

/** ¿Un intento anterior con BiRefNet empezó y nunca terminó (hace menos de 7 días)? */
export const hasAttempt = () =>
  safe(async () => {
    const at = await run("readonly", (s) => s.get(KEY));
    // solo vale un timestamp pasado y reciente; `true` viejo, futuro o basura se ignoran
    const age = typeof at === "number" ? Date.now() - at : -1;
    return age >= 0 && age <= MARK_TTL_MS;
  }, false);

/** Se confirma en disco ANTES de volver: llamarla justo antes de la fase que puede matar el proceso. */
export const markAttempt = () => safe(() => run("readwrite", (s) => s.put(Date.now(), KEY)).then(() => undefined), undefined);

export const clearAttempt = () => safe(() => run("readwrite", (s) => s.delete(KEY)).then(() => undefined), undefined);
