// BUG-13: marca persistente «intento con BiRefNet en curso». Se prueba contra un IndexedDB
// mínimo en memoria (jsdom no trae uno) que respeta el contrato asíncrono real.
function fakeIndexedDB() {
  const stores = new Map();
  const later = (fn) => setTimeout(fn, 0);
  const req = (run) => {
    const r = {};
    later(() => {
      try {
        r.result = run();
        r.onsuccess?.({ target: r });
      } catch (e) {
        r.error = e;
        r.onerror?.({ target: r });
      }
    });
    return r;
  };
  return {
    open: (name) => {
      const r = {};
      later(() => {
        const created = !stores.has(name);
        if (created) stores.set(name, new Map());
        const data = stores.get(name);
        const db = {
          objectStoreNames: { contains: () => !created },
          createObjectStore: () => ({}),
          transaction: () => {
            const tx = {};
            // se confirma después de que corrieron las operaciones pedidas, como el IndexedDB real
            later(() => later(() => tx.oncomplete?.()));
            tx.objectStore = () => ({
              put: (v, k) => req(() => void data.set(k, v)),
              get: (k) => req(() => data.get(k)),
              delete: (k) => req(() => void data.delete(k)),
            });
            return tx;
          },
          close() {},
        };
        r.result = db;
        if (created) r.onupgradeneeded?.({ target: r });
        r.onsuccess?.({ target: r });
      });
      return r;
    },
  };
}

describe("aiAttemptMark", () => {
  let mark;
  beforeEach(() => {
    jest.resetModules();
    global.indexedDB = fakeIndexedDB();
    mark = require("./aiAttemptMark.js");
  });
  afterEach(() => {
    delete global.indexedDB;
  });

  test("sin marca ⇒ hasAttempt() false", async () => {
    expect(await mark.hasAttempt()).toBe(false);
  });

  test("markAttempt() persiste: otro módulo (otra «sesión») la ve", async () => {
    await mark.markAttempt();
    jest.resetModules();
    const again = require("./aiAttemptMark.js");
    expect(await again.hasAttempt()).toBe(true);
  });

  test("clearAttempt() la borra", async () => {
    await mark.markAttempt();
    await mark.clearAttempt();
    expect(await mark.hasAttempt()).toBe(false);
  });

  test("sin indexedDB (modo privado/bloqueado): nada lanza y hasAttempt() es false", async () => {
    delete global.indexedDB;
    jest.resetModules();
    const m = require("./aiAttemptMark.js");
    await expect(m.markAttempt()).resolves.toBeUndefined();
    await expect(m.clearAttempt()).resolves.toBeUndefined();
    expect(await m.hasAttempt()).toBe(false);
  });

  test("indexedDB.open que lanza ⇒ no rompe", async () => {
    global.indexedDB = {
      open: () => {
        throw new Error("SecurityError");
      },
    };
    jest.resetModules();
    const m = require("./aiAttemptMark.js");
    await expect(m.markAttempt()).resolves.toBeUndefined();
    expect(await m.hasAttempt()).toBe(false);
  });

  test("indexedDB.open que nunca responde ⇒ se rinde por timeout, no cuelga el recorte", async () => {
    jest.useFakeTimers();
    try {
      global.indexedDB = { open: () => ({}) };
      jest.resetModules();
      const m = require("./aiAttemptMark.js");
      const p = m.hasAttempt();
      await jest.advanceTimersByTimeAsync(5000);
      expect(await p).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  // BUG-13 ampliación: la marca vence a los 7 días
  describe("vencimiento (TTL 7 días)", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const T0 = 1_800_000_000_000;
    let now;
    beforeEach(() => {
      now = jest.spyOn(Date, "now").mockReturnValue(T0);
    });
    afterEach(() => now.mockRestore());

    test("marca de 6 días ⇒ vigente", async () => {
      await mark.markAttempt();
      now.mockReturnValue(T0 + 6 * DAY);
      expect(await mark.hasAttempt()).toBe(true);
    });

    test("marca de más de 7 días ⇒ se ignora", async () => {
      await mark.markAttempt();
      now.mockReturnValue(T0 + 7 * DAY + 1);
      expect(await mark.hasAttempt()).toBe(false);
    });

    test("marca con fecha en el futuro o formato viejo (true) ⇒ se ignora", async () => {
      await mark.markAttempt();
      now.mockReturnValue(T0 - DAY);
      expect(await mark.hasAttempt()).toBe(false);
    });

    test("una marca nueva tras el vencimiento vuelve a valer", async () => {
      await mark.markAttempt();
      now.mockReturnValue(T0 + 8 * DAY);
      await mark.markAttempt();
      now.mockReturnValue(T0 + 9 * DAY);
      expect(await mark.hasAttempt()).toBe(true);
    });
  });
});
