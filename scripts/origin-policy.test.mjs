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
