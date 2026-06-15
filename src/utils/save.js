// Guardado de exportaciones en escritorio (Tauri): abre el diálogo nativo
// "Guardar como" y escribe los bytes en la ruta elegida. En navegador no se usa
// (allí va `downloadDataUrl`). Los plugins se importan dinámicamente para no
// entrar al bundle web.

const EXT_FILTERS = {
  png: { name: "PNG", extensions: ["png"] },
  webp: { name: "WebP", extensions: ["webp"] },
  jpg: { name: "JPEG", extensions: ["jpg", "jpeg"] },
  jpeg: { name: "JPEG", extensions: ["jpg", "jpeg"] },
};

/**
 * Abre el diálogo nativo de guardado y escribe el contenido de `url`
 * (object/data URL) en disco. Devuelve true si se guardó, false si el usuario
 * canceló. Lanza si la escritura falla.
 */
export async function saveExport(url, defaultName) {
  const ext = (defaultName.split(".").pop() || "png").toLowerCase();
  const filter = EXT_FILTERS[ext] || EXT_FILTERS.png;

  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({
    defaultPath: defaultName,
    filters: [filter],
  });
  if (!path) return false; // cancelado

  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  await writeFile(path, bytes);
  return true;
}
