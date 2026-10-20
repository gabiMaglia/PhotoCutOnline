// BUG-15: la promesa de privacidad de los tests de navegador. Una request con
// cuerpo a otro origen es falla, salvo los pings de los anuncios declarados
// (docs/MONETIZACION.md) que NO llevan la foto.
import test from "node:test";
import assert from "node:assert/strict";
import { foreignBodyViolation, AD_HOSTS } from "../test/lib/originPolicy.mjs";

const ORIGIN = "http://localhost:5188";
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const req = (o) => ({ origin: ORIGIN, method: "POST", url: "https://example.com/x", body: Buffer.from("hola"), ...o });

test("el ping de AdSense (POST sin foto) no es violación", () => {
  assert.equal(foreignBodyViolation(req({ url: "https://pagead2.googlesyndication.com/pagead/ping?e=1", body: Buffer.from("e=1") })), null);
});

test("un POST a AdSense que lleva la foto SÍ es violación", () => {
  const body = Buffer.concat([Buffer.from("a="), png]);
  assert.match(foreignBodyViolation(req({ url: "https://pagead2.googlesyndication.com/pagead/ping?e=1", body })), /POST https:\/\/pagead2/);
});

test("la foto en base64 también se detecta", () => {
  const b64 = Buffer.from("img=" + png.toString("base64"));
  assert.ok(foreignBodyViolation(req({ url: "https://googleads.g.doubleclick.net/p", body: b64 })));
});

test("un cuerpo enorme a un host de anuncios es violación (no es un ping)", () => {
  assert.ok(foreignBodyViolation(req({ url: "https://pagead2.googlesyndication.com/p", body: Buffer.alloc(64 * 1024, 65) })));
});

test("cualquier otro host con cuerpo es violación", () => {
  assert.ok(foreignBodyViolation(req({ url: "https://evil.example/up" })));
});

test("mismo origen, blob/data y requests sin cuerpo no cuentan", () => {
  assert.equal(foreignBodyViolation(req({ url: `${ORIGIN}/api`, body: png })), null);
  assert.equal(foreignBodyViolation(req({ url: "blob:http://localhost/1" })), null);
  assert.equal(foreignBodyViolation(req({ url: "data:text/plain,x" })), null);
  assert.equal(foreignBodyViolation(req({ body: null })), null);
  assert.equal(foreignBodyViolation(req({ body: Buffer.alloc(0) })), null);
});

test("los hosts declarados son los de docs/MONETIZACION.md", () => {
  for (const h of ["pagead2.googlesyndication.com", "googleads.g.doubleclick.net", "tpc.googlesyndication.com", "fundingchoicesmessages.google.com"])
    assert.ok(AD_HOSTS.includes(h), h);
});

// ---- BUG-16: política endurecida ----
const PING = "https://pagead2.googlesyndication.com/pagead/ping?e=1";
const b64 = (buf, pad = 0) => Buffer.from(Buffer.concat([Buffer.alloc(pad, 0x41), buf]).toString("base64"));

test("solo se tolera POST al path /pagead/ping", () => {
  assert.equal(foreignBodyViolation(req({ url: PING })), null);
  assert.ok(foreignBodyViolation(req({ url: "https://pagead2.googlesyndication.com/otro/path" })));
  assert.ok(foreignBodyViolation(req({ method: "PUT", url: PING })));
});

test("tope de 2 KiB por ping", () => {
  assert.equal(foreignBodyViolation(req({ url: PING, body: Buffer.alloc(2048, 65) })), null);
  assert.ok(foreignBodyViolation(req({ url: PING, body: Buffer.alloc(2049, 65) })));
});

test("presupuesto acumulado de 8 KiB por sesión", () => {
  const budget = { used: 0 };
  const ping = () => foreignBodyViolation(req({ url: PING, body: Buffer.alloc(2048, 65), budget }));
  for (let i = 0; i < 4; i++) assert.equal(ping(), null, `ping ${i}`);
  assert.ok(ping(), "el quinto excede 8 KiB");
});

test("detecta GIF, BMP, AVIF, HEIC y gzip en crudo", () => {
  const cases = {
    gif: Buffer.from("GIF89a.."),
    bmp: Buffer.from("BM\x36\x00\x00\x00"),
    avif: Buffer.from("\0\0\0\x1cftypavif\0\0"),
    heic: Buffer.from("\0\0\0\x18ftypheic\0\0"),
    gzip: Buffer.from([0x1f, 0x8b, 0x08, 0, 0, 0]),
  };
  for (const [k, body] of Object.entries(cases)) assert.ok(foreignBodyViolation(req({ url: PING, body })), k);
});

test("detecta base64 desalineado (0, 1 y 2 bytes de relleno)", () => {
  for (const pad of [0, 1, 2]) {
    assert.ok(foreignBodyViolation(req({ url: PING, body: b64(png, pad) })), `png pad ${pad}`);
    assert.ok(foreignBodyViolation(req({ url: PING, body: b64(Buffer.from("GIF89a"), pad) })), `gif pad ${pad}`);
    assert.ok(foreignBodyViolation(req({ url: PING, body: b64(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), pad) })), `jpg pad ${pad}`);
  }
});

test("el origen se compara con new URL().origin, no con startsWith", () => {
  assert.ok(foreignBodyViolation(req({ url: "http://localhost:5188.evil.com/x" })));
  assert.ok(foreignBodyViolation(req({ url: "http://localhost:51880/x" })));
  assert.equal(foreignBodyViolation(req({ url: "http://localhost:5188/x" })), null);
});
