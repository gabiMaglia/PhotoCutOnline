/** Dispara la descarga de un data/object URL con el nombre de archivo dado. */
export function downloadDataUrl(dataUrl, name) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** ¿El punto (x, y) cae dentro del rect de un elemento (getBoundingClientRect)? */
export function pointInRect(rect, x, y) {
  return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
