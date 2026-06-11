// Backend abstraction layer.
//
// On desktop (Tauri) the heavy GrabCut work runs in Rust via `invoke`.
// In a plain browser build, Tauri is absent, so we fall back to a JS engine
// (see ./jsEngine.js). This lets the *same* React UI ship as both products.

import { runGrabCutJS } from "./jsEngine.js";

function hasTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let invoke = null;
async function getInvoke() {
  if (invoke) return invoke;
  const mod = await import("@tauri-apps/api/core");
  invoke = mod.invoke;
  return invoke;
}

// Browser-side session state (mirrors what the Rust Session holds).
const jsSession = {
  imageData: null, // {width,height,rgba}
  mask: null,
};

export const backend = {
  isDesktop: hasTauri(),

  async loadImage(dataUrl) {
    if (hasTauri()) {
      const inv = await getInvoke();
      return inv("load_image", { dataUrl });
    }
    // browser: decode into an offscreen canvas
    const img = await loadHtmlImage(dataUrl);
    const { width, height } = img;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    jsSession.imageData = ctx.getImageData(0, 0, width, height);
    jsSession.mask = null;
    return { width, height };
  },

  async cutRect(rect, iters) {
    if (hasTauri()) {
      const inv = await getInvoke();
      return inv("cut_rect", { rect, iters });
    }
    const { dataUrl, mask } = runGrabCutJS(jsSession.imageData, rect, null, iters);
    jsSession.mask = mask;
    return dataUrl;
  },

  async refine(strokes, iters) {
    if (hasTauri()) {
      const inv = await getInvoke();
      return inv("refine", { strokes, iters });
    }
    const { dataUrl, mask } = runGrabCutJS(
      jsSession.imageData,
      null,
      { strokes, prevMask: jsSession.mask },
      iters
    );
    jsSession.mask = mask;
    return dataUrl;
  },

  async exportTransparent() {
    if (hasTauri()) {
      const inv = await getInvoke();
      return inv("export_transparent", {});
    }
    return compositeJS(jsSession, { type: "transparent" });
  },

  async exportSolid(color) {
    if (hasTauri()) {
      const inv = await getInvoke();
      return inv("export_solid", { color });
    }
    return compositeJS(jsSession, { type: "solid", color });
  },

  async exportImageBg(bgDataUrl) {
    if (hasTauri()) {
      const inv = await getInvoke();
      return inv("export_image_bg", { bgDataUrl });
    }
    return compositeJS(jsSession, { type: "image", bgDataUrl });
  },
};

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Browser compositing (desktop path does this in Rust).
async function compositeJS(session, opts) {
  const { width, height } = session.imageData;
  const src = session.imageData.data;
  const mask = session.mask;
  const out = new ImageData(width, height);

  let bgData = null;
  if (opts.type === "image") {
    const img = await loadHtmlImage(opts.bgDataUrl);
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const cx = c.getContext("2d");
    cx.drawImage(img, 0, 0, width, height);
    bgData = cx.getImageData(0, 0, width, height).data;
  }

  for (let i = 0; i < width * height; i++) {
    const fg = mask ? mask[i] === 255 : false;
    const o = i * 4;
    if (fg) {
      out.data[o] = src[o];
      out.data[o + 1] = src[o + 1];
      out.data[o + 2] = src[o + 2];
      out.data[o + 3] = 255;
    } else if (opts.type === "transparent") {
      out.data[o + 3] = 0;
    } else if (opts.type === "solid") {
      out.data[o] = opts.color[0];
      out.data[o + 1] = opts.color[1];
      out.data[o + 2] = opts.color[2];
      out.data[o + 3] = opts.color[3];
    } else if (opts.type === "image" && bgData) {
      out.data[o] = bgData[o];
      out.data[o + 1] = bgData[o + 1];
      out.data[o + 2] = bgData[o + 2];
      out.data[o + 3] = 255;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(out, 0, 0);
  return canvas.toDataURL("image/png");
}
