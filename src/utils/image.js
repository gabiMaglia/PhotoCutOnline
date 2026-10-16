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

/**
 * Fuente ya decodificada para dibujar a resolución completa. WebKit descarta lo
 * decodificado de fotos grandes (una <img> e incluso un ImageBitmap) y, al
 * volver a dibujarlas, puede pintar bandas corruptas: lo midió F7 con 12 MP en
 * BUG-09. Se copia una vez a un canvas en memoria (willReadFrequently), que no
 * se descarta. Ocupa lo mismo que el canvas a tamaño completo que había antes.
 * Sin soporte, devuelve la <img> tal cual.
 *
 * Se copia desde la <img> recién cargada (img.decode()) y no con
 * createImageBitmap(blob): en el WebKit de Linux (CI 172c634) ese bitmap salía
 * a veces vacío (0,0,0,0) y la vista previa de Filtros quedaba en blanco. El
 * problema de las bandas es volver a dibujar la <img> MÁS TARDE, no esta copia
 * única inmediata. `url` queda por compatibilidad de firma.
 */
// eslint-disable-next-line no-unused-vars
export async function decodedSource(url, img) {
  try {
    await img.decode?.();
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0);
    return c;
  } catch {
    return img;
  }
}
