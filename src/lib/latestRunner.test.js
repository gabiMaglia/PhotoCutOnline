import { createLatestRunner } from "./latestRunner.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((r, j) => ((resolve = r), (reject = j)));
  return { promise, resolve, reject };
};

it("sin carrera corre la tarea y devuelve su valor", async () => {
  const r = createLatestRunner();
  expect(await r.run(async () => 5)).toEqual({ stale: false, value: 5 });
});

it("con una en vuelo, de tres pedidos solo corre el último; los intermedios salen stale", async () => {
  const r = createLatestRunner();
  const first = deferred();
  const ran = [];
  const p1 = r.run(() => (ran.push(1), first.promise));
  const p2 = r.run(async () => (ran.push(2), 2));
  const p3 = r.run(async () => (ran.push(3), 3));
  const p4 = r.run(async () => (ran.push(4), 4));
  await Promise.resolve();
  expect(ran).toEqual([1]);
  first.resolve(1);
  expect(await p1).toEqual({ stale: false, value: 1 });
  expect(await p2).toEqual({ stale: true });
  expect(await p3).toEqual({ stale: true });
  expect(await p4).toEqual({ stale: false, value: 4 });
  expect(ran).toEqual([1, 4]);
});

it("un error rechaza solo esa tarea y la que espera corre igual", async () => {
  const r = createLatestRunner();
  const first = deferred();
  const p1 = r.run(() => first.promise);
  const p2 = r.run(async () => "ok");
  first.reject(new Error("WEBP_ENCODE_FAILED: x"));
  await expect(p1).rejects.toThrow(/WEBP/);
  expect(await p2).toEqual({ stale: false, value: "ok" });
});
