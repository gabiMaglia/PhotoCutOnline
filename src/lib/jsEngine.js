// Browser-only fallback segmentation engine.
//
// This is a lightweight color-statistics + flood-fill segmenter used ONLY when
// the app runs as a plain web page (no Tauri). The desktop build uses the full
// Rust GrabCut engine in photocut-core, which produces noticeably better edges.
//
// Kept intentionally simple and dependency-free. For a production web build you
// can replace this with a WASM compile of photocut-core (see README).

function buildColorModel(imageData, predicate) {
  const { width, height, data } = imageData;
  let n = 0;
  const mean = [0, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!predicate(x, y)) continue;
      const o = i * 4;
      mean[0] += data[o];
      mean[1] += data[o + 1];
      mean[2] += data[o + 2];
      n++;
    }
  }
  if (n === 0) return { mean: [0, 0, 0], n: 0 };
  return { mean: [mean[0] / n, mean[1] / n, mean[2] / n], n };
}

function dist2(data, o, mean) {
  const dr = data[o] - mean[0];
  const dg = data[o + 1] - mean[1];
  const db = data[o + 2] - mean[2];
  return dr * dr + dg * dg + db * db;
}

// rect path: classify inside-rect pixels as fg/bg by nearest color model.
export function runGrabCutJS(imageData, rect, refineArg, iters) {
  const { width, height, data } = imageData;
  const N = width * height;
  let mask = new Uint8Array(N);

  if (rect) {
    const inside = (x, y) =>
      x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
    const fgModel = buildColorModel(imageData, inside);
    const bgModel = buildColorModel(imageData, (x, y) => !inside(x, y));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!inside(x, y)) {
          mask[i] = 0;
          continue;
        }
        const o = i * 4;
        const df = dist2(data, o, fgModel.mean);
        const db = dist2(data, o, bgModel.mean);
        mask[i] = df <= db ? 255 : 0;
      }
    }
    // a couple of smoothing passes to clean speckles
    for (let k = 0; k < Math.max(1, iters); k++) {
      mask = majoritySmooth(mask, width, height);
    }
  } else if (refineArg) {
    mask = refineArg.prevMask ? Uint8Array.from(refineArg.prevMask) : new Uint8Array(N);
    for (const s of refineArg.strokes) {
      for (const [x, y] of s.points) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          mask[y * width + x] = s.foreground ? 255 : 0;
        }
      }
    }
    for (let k = 0; k < Math.max(1, iters); k++) {
      mask = majoritySmooth(mask, width, height);
    }
  }

  // build preview RGBA
  const out = new ImageData(width, height);
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (mask[i] === 255) {
      out.data[o] = data[o];
      out.data[o + 1] = data[o + 1];
      out.data[o + 2] = data[o + 2];
      out.data[o + 3] = 255;
    } else {
      out.data[o + 3] = 0;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(out, 0, 0);
  return { dataUrl: canvas.toDataURL("image/png"), mask };
}

function majoritySmooth(mask, width, height) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let fg = 0;
      let total = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          total++;
          if (mask[ny * width + nx] === 255) fg++;
        }
      }
      out[y * width + x] = fg * 2 > total ? 255 : 0;
    }
  }
  return out;
}
