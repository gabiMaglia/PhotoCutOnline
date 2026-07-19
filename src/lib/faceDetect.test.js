import { decodeYunet, nms } from "./faceDetect.js";

// decode/NMS son matemática pura → se testean sin cargar el modelo ni el canvas
// (la inferencia real de YuNet la valida el harness de Chrome con una cara real).

describe("decodeYunet", () => {
  it("decodifica una celda con score alto a la caja correcta", () => {
    // grilla padded 64×64; stride 8 → 8×8 = 64 celdas
    const N = 64;
    const cls = new Float32Array(N);
    const obj = new Float32Array(N);
    const bbox = new Float32Array(N * 4);
    const r = 2, c = 3, idx = r * 8 + c; // celda (row 2, col 3)
    cls[idx] = 0.81;
    obj[idx] = 1.0; // score = √(0.81·1) = 0.9
    bbox[idx * 4] = 0.5;      // dx
    bbox[idx * 4 + 1] = 0.5;  // dy
    bbox[idx * 4 + 2] = Math.log(2); // dw → exp = 2
    bbox[idx * 4 + 3] = Math.log(2); // dh
    const boxes = decodeYunet({ cls_8: cls, obj_8: obj, bbox_8: bbox }, 64, 64, 0.6);
    expect(boxes).toHaveLength(1);
    const b = boxes[0];
    // cx = (3+0.5)*8 = 28, cy = (2+0.5)*8 = 20, w = h = 2*8 = 16
    expect(b.x).toBeCloseTo(20, 5); // 28 - 16/2
    expect(b.y).toBeCloseTo(12, 5); // 20 - 16/2
    expect(b.w).toBeCloseTo(16, 5);
    expect(b.h).toBeCloseTo(16, 5);
    expect(b.score).toBeCloseTo(0.9, 5);
  });

  it("descarta celdas por debajo del umbral de score", () => {
    const N = 64;
    const cls = new Float32Array(N).fill(0.2);
    const obj = new Float32Array(N).fill(0.2); // score 0.2 < 0.6
    const bbox = new Float32Array(N * 4);
    expect(decodeYunet({ cls_8: cls, obj_8: obj, bbox_8: bbox }, 64, 64, 0.6)).toHaveLength(0);
  });

  it("salta un stride si falta alguna de sus salidas", () => {
    expect(decodeYunet({ cls_8: new Float32Array(64) }, 64, 64)).toEqual([]);
  });
});

describe("nms", () => {
  it("descarta la caja de menor score muy solapada, conserva la de mayor", () => {
    const a = { x: 0, y: 0, w: 100, h: 100, score: 0.9 };
    const b = { x: 10, y: 10, w: 100, h: 100, score: 0.6 }; // IoU alto con a
    expect(nms([a, b], 0.3)).toEqual([a]);
  });

  it("conserva dos caras separadas (sin solape)", () => {
    const a = { x: 0, y: 0, w: 50, h: 50, score: 0.9 };
    const b = { x: 200, y: 200, w: 50, h: 50, score: 0.8 };
    const keep = nms([a, b], 0.3);
    expect(keep).toHaveLength(2);
  });

  it("ordena por score (la más confiable primero)", () => {
    const a = { x: 0, y: 0, w: 50, h: 50, score: 0.5 };
    const b = { x: 200, y: 200, w: 50, h: 50, score: 0.95 };
    expect(nms([a, b], 0.3)[0].score).toBe(0.95);
  });
});
