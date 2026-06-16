// Guardado de exportaciones en escritorio (Tauri): abre el diálogo nativo
// "Guardar como" y escribe los bytes en la ruta elegida. En navegador no se usa
// (allí va `downloadDataUrl`). Los plugins se importan dinámicamente para no
// entrar al bundle web.

const EXT_FILTERS = {
  png: { name: "PNG", extensions: ["png"] },
  webp: { name: "WebP", extensions: ["webp"] },
  jpg: { name: "JPEG", extensions: ["jpg", "jpeg"] },
  jpeg: { name: "JPEG", extensions: ["jpg", "jpeg"] },
  zip: { name: "ZIP", extensions: ["zip"] },
  py: { name: "Python", extensions: ["py"] },
};

/**
 * Abre el diálogo nativo de guardado y escribe en disco el contenido de
 * `source`, que puede ser un Blob o un object/data URL (se descarga con fetch).
 * Devuelve true si se guardó, false si el usuario canceló. Lanza si la
 * escritura falla. El filtro de archivo se deriva de la extensión de
 * `defaultName`.
 */
export async function saveExport(source, defaultName) {
  const ext = (defaultName.split(".").pop() || "").toLowerCase();
  const filter = EXT_FILTERS[ext];

  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({
    defaultPath: defaultName,
    ...(filter ? { filters: [filter] } : {}),
  });
  if (!path) return false; // cancelado

  const buf =
    source instanceof Blob
      ? await source.arrayBuffer()
      : await (await fetch(source)).arrayBuffer();
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  await writeFile(path, new Uint8Array(buf));
  return true;
}
