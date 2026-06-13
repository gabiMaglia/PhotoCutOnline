/** Lee un File como data URL (base64). */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/**
 * Pre-compone un fondo con la opacidad elegida (cover, al tamaño de la imagen
 * de trabajo) para que el motor lo reciba listo para componer. Si la opacidad
 * es 100% devuelve el dataURL original sin re-encodear.
 */
export async function bgWithOpacity(bgDataUrl, opacity, imageSize) {
  if (opacity >= 100 || !imageSize) return bgDataUrl;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = bgDataUrl;
  });
  const c = document.createElement("canvas");
  c.width = imageSize.width;
  c.height = imageSize.height;
  const ctx = c.getContext("2d");
  ctx.globalAlpha = opacity / 100;
  const s = Math.max(c.width / img.width, c.height / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
  return c.toDataURL("image/png");
}
