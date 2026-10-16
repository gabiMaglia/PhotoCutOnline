// GROW-36: el filtro de componentes de refineMatte («≥ 12 % del mayor») se
// pensó para la niebla de u2netp, pero borra las letras de un logo aunque el
// modelo las haya detectado (medido en la guía del logo: banda del texto
// 33 % → 0 %). Con las opciones de BiRefNet, las letras se quedan y las motas
// sueltas (fantasmas) se siguen yendo.
import { refineMatte } from "./jsEngine.js";

const W = 400;
const H = 400;

function fill(m, x0, y0, w, h, v = 255) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) m[y * W + x] = v;
}

// un emblema grande, cinco «letras» debajo y motas sueltas lejos de todo
function logoMatte() {
  const m = new Uint8ClampedArray(W * H);
  fill(m, 150, 40, 100, 100); // emblema: 10 000 px
  for (let i = 0; i < 5; i++) fill(m, 110 + i * 40, 250, 10, 30); // letras: 300 px c/u (3 % del emblema)
  fill(m, 20, 360, 4, 4); // motas: 16 px
  fill(m, 370, 20, 3, 3);
  return m;
}

const at = (m, x, y) => m[y * W + x];

describe("refineMatte (GROW-36)", () => {
  test("sin opciones (u2netp): comportamiento de siempre, las letras se pierden", () => {
    const m = refineMatte(logoMatte(), W, H);
    expect(at(m, 200, 90)).toBe(255);
    expect(at(m, 115, 265)).toBe(0); // letra borrada (el defecto que motiva el cambio)
    expect(at(m, 21, 361)).toBe(0);
  });

  test("con las opciones de BiRefNet: el emblema y las letras quedan, las motas se van", () => {
    const m = refineMatte(logoMatte(), W, H, { stretch: false, minComponentFrac: 0.0005 });
    expect(at(m, 200, 90)).toBe(255);
    for (let i = 0; i < 5; i++) expect(at(m, 115 + i * 40, 265)).toBe(255);
    expect(at(m, 21, 361)).toBe(0);
    expect(at(m, 371, 21)).toBe(0);
  });

  test("con stretch: false no se toca el alfa intermedio del borde", () => {
    const m = logoMatte();
    fill(m, 250, 40, 2, 100, 150); // borde suave pegado al emblema
    refineMatte(m, W, H, { stretch: false, minComponentFrac: 0.0005 });
    expect(at(m, 250, 90)).toBe(150);
    const d = logoMatte();
    fill(d, 250, 40, 2, 100, 150);
    refineMatte(d, W, H);
    expect(at(d, 250, 90)).toBe(Math.round(((150 - 50) / 155) * 255)); // con estiramiento: 165
  });
});
