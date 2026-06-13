// i18n mínimo, sin dependencias: ES / EN / PT.
//
// - Detección por localStorage ("pc-lang") → navigator.language → "en".
// - `t(key, vars)` interpola {tokens}; cae a EN y luego a la propia key.
// - `useLang()` re-suscribe el componente al cambio de idioma (con llamarlo
//   en App basta: todos los hijos se re-renderizan).

import { useState, useEffect } from "react";

export const LANGS = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "pt", label: "PT" },
];

const DICT = {
  es: {
    "tab.cut": "Recorte",
    openPhoto: "Abrir foto",
    "about.aria": "Acerca de y licencias",
    "lang.aria": "Idioma",

    "rail.mark": "Marcar",
    "rail.export": "Exportar",
    "tool.ai": "Recorte IA ✨",
    "tool.auto": "Recorte automático",
    "tool.rect": "Recuadro",
    "tool.keep": "Pincel mantener",
    "tool.remove": "Pincel quitar",
    "brush.label": "Pincel — {n}px",
    "feather.label": "Suavizado de borde — {n}px",
    undo: "↩ Deshacer",
    redo: "↪ Rehacer",
    "preview.show": "Vista previa",
    "preview.hide": "Ocultar vista previa",
    "export.clipboard": "Copiar al portapapeles",
    "export.bgcolor.aria": "Color de fondo",
    "export.icons": "→ Crear iconos de app",
    "export.modeAria": "Fondo de la exportación",
    "export.mode.transparent": "Transparente",
    "export.mode.solid": "Color",
    "export.mode.image": "Imagen",
    "export.download": "Descargar",
    "export.bgChoose": "Elegir imagen de fondo…",
    "export.bgRemove": "Quitar imagen de fondo",
    "export.bgOpacity": "Opacidad del fondo — {n}%",
    "toast.bgSet": "Fondo cargado — míralo en la vista previa (P)",
    "toast.cutLoaded": "Recorte cargado como nueva imagen — seguí editando",
    "preview.dropHint": "Arrastra el recorte y suéltalo en el lienzo para seguir editándolo",
    "rail.help":
      "A automático · 1 recuadro · 2/3 pinceles · P vista previa · E exportar · ? atajos. Arrastra o pega (⌘V) cualquier imagen.",

    "toast.loaded": "{w} × {h} px cargados",
    "toast.ai": "Recorte IA aplicado — pinta para afinar",
    "toast.aiDownloading": "Descargando el modelo IA (~18 MB, solo la primera vez)…",
    "toast.cut": "Recorte listo — pinta para afinar bordes",
    "toast.auto": "Recorte automático aplicado",
    "toast.exported": "Exportado ✓",
    "toast.copied": "PNG copiado al portapapeles ✓",
    "toast.copyfail": "No se pudo copiar: {e}",
    "toast.heic": "HEIC del iPhone no soportado — exporta la foto como JPG o PNG",
    "toast.unreadable": "No se pudo leer ese archivo como imagen",
    "toast.reduced": "Reducida a 4K (original {w} × {h} px)",
    "toast.zip": "ZIP listo — {n}+ iconos en {p} plataformas",
    "toast.py": "make_icons.py descargado — pip install pillow y listo",
    "toast.cutfail": "No se pudo obtener el recorte: {e}",
    "toast.iconsfail": "Error generando iconos: {e}",

    "large.title": "Imagen muy grande",
    "large.body":
      "{w} × {h} px ({mp} MP). Procesarla entera puede agotar la memoria del navegador.",
    "large.reduce": "Reducir a 4K (recomendado)",
    "large.cancel": "Cancelar",
    "drop.here": "Suéltala aquí",

    "canvas.empty.title": "Suelta una imagen aquí",
    "canvas.empty.body":
      "Arrastra un archivo, pega desde el portapapeles (⌘V) o usa «Abrir foto». Luego dibuja un recuadro alrededor del sujeto — o prueba el recorte automático.",
    busy: "procesando…",

    "previewPanel.title": "Vista previa",
    "previewPanel.alt": "Vista previa del recorte sobre el fondo elegido",
    "previewPanel.transparent": "Fondo transparente",
    "previewPanel.white": "Fondo blanco",
    "previewPanel.black": "Fondo negro",
    "previewPanel.custom": "Color de fondo personalizado",
    "previewPanel.close": "Cerrar vista previa",
    "previewPanel.bgAria": "Fondo de la vista previa",
    "previewPanel.resize": "Redimensionar la vista previa",

    "icon.source": "Fuente",
    "icon.useCurrent": "Usar recorte actual",
    "icon.openPng": "Abrir PNG…",
    "icon.currentTag": "recorte actual",
    "icon.settings": "Ajustes",
    "icon.margin": "Margen — {n}%",
    "icon.bg": "Fondo",
    "icon.bgAria": "Color de fondo del icono",
    "icon.appName": "Nombre de la app",
    "icon.platforms": "Plataformas",
    "icon.generate": "Generar",
    "icon.zipBtn": "Descargar ZIP de iconos",
    "icon.building": "Generando…",
    "icon.pyBtn": "Script Python (CLI)",
    "icon.trim": "Recortar al contenido",
    "icon.fitAria": "Encaje de la imagen",
    "icon.fit.contain": "Imagen entera",
    "icon.fit.cover": "Recortar sobrante",
    "icon.bgImage": "Imagen de fondo…",
    "icon.bgImageRemove": "Quitar imagen de fondo",
    "icon.trimmed": "Recortada a {w} × {h} px — solo lo pintado",
    "icon.trimNone": "Sin margen transparente que recortar",
    "icon.trimTag": "(recortado)",
    "icon.removeBg": "Quitar fondo ✨",
    "icon.removing": "Quitando fondo…",
    "icon.bgRemoved": "Fondo eliminado ✓",
    "icon.noBgTag": "(sin fondo)",
    "icon.snippetBtn": "Copiar HTML de favicons",
    "icon.snippetCopied": "Snippet de favicons copiado ✓",
    "icon.py1": "El script",
    "icon.py2": "genera las mismas medidas desde la terminal:",
    "icon.py3": "Solo requiere Pillow.",
    "icon.emptyBody":
      "Usa el recorte actual o abre un PNG transparente. Generamos todas las medidas para iOS, Android, macOS, Windows y Web — listas para pegar en tu proyecto.",
    "icon.note":
      "Vista pixel-perfect — así se verá el icono en el dock, la barra de pestañas y la home screen.",

    "about.body": "Recorte de fondo y generación de iconos, 100% en tu navegador.",
    "about.privacy": "Tus imágenes nunca se suben a ningún servidor.",
    "about.thirdparty": "Software de terceros",
    "about.donate": "☕ Invitame un cafecito (Ko-fi)",
    "about.linksAria": "Enlaces legales y guías",
    "about.privacyLink": "Privacidad",
    "about.termsLink": "Términos de uso",
    "about.guides": "Guías",
    "donate.aria": "Apoyar el proyecto en Ko-fi",
    "ad.label": "Publicidad",
    "house.label": "Proyecto independiente",
    "house.body":
      "PhotoCut es gratis y tus fotos nunca salen de tu navegador. Si te sirve, ayudá a que siga así.",
    "house.donate": "☕ Invitar un cafecito",
    "house.desktop": "⬇ App de escritorio",
    close: "Cerrar",

    "compare.toggle": "Comparar",
    "compare.before": "Antes",
    "compare.after": "Después",
    "compare.aria": "Divisor antes/después",
    "zoom.reset": "Restablecer zoom (doble clic)",
    "sc.compare": "Comparar antes/después",
    "sc.zoom": "Zoom hacia el cursor",
    "sc.pan": "Mover el lienzo (con zoom)",
    "help.title": "Atajos de teclado",
    "sc.ai": "Recorte IA", "sc.auto": "Recorte automático",
    "sc.rect": "Recuadro",
    "sc.brushes": "Pincel mantener / quitar",
    "sc.brushsize": "Tamaño del pincel",
    "sc.preview": "Vista previa",
    "sc.export": "Exportar PNG transparente",
    "sc.undoredo": "Deshacer / Rehacer",
    "sc.paste": "Pegar imagen del portapapeles",
    "sc.help": "Esta ayuda",
    "sc.close": "Cerrar paneles",

    "ob.title": "Quita el fondo en tres pasos",
    "ob.privacy":
      "Todo ocurre en tu navegador — tus fotos nunca se suben a ningún servidor.",
    "ob.1.title": "Abre una foto",
    "ob.1.body": "Arrastra un archivo, pega con ⌘V o toca «Abrir foto».",
    "ob.2.title": "Marca el sujeto",
    "ob.2.body": "Dibuja un recuadro alrededor — o usa el recorte automático (A).",
    "ob.3.title": "Afina y exporta",
    "ob.3.body":
      "Pinceles mantener/quitar para los bordes. Exporta PNG transparente o crea iconos de app.",
    "ob.go": "¡A recortar!",

    "finish.title": "Acabado",
    "finish.sticker": "Sticker (contorno)",
    "finish.stickerWidth": "Grosor — {n}px",
    "finish.shadow": "Sombra",
    "finish.shadowSize": "Intensidad — {n}",
    "preset.label": "Preset de tamaño",
    "preset.original": "Original",
    "preset.amazon": "Amazon 2000×2000",
    "preset.etsy": "Etsy 2700×2025",
    "preset.shopify": "Shopify 2048×2048",
    "preset.igPost": "Instagram post 1080×1080",
    "preset.igStory": "Instagram story 1080×1920",
    "preset.avatar": "Avatar circular 512",

    "dl.aria": "Descargar la app de escritorio",
    "dl.title": "App de escritorio",
    "dl.body":
      "El motor Rust completo, sin navegador y 100% offline. Builds sin firmar: en macOS, clic derecho → Abrir la primera vez.",
    "dl.loading": "Buscando la última versión…",
    "dl.none": "Aún no hay instaladores publicados — muy pronto.",
    "dl.win": "Windows (x64)",
    "dl.macArm": "macOS Apple Silicon",
    "dl.macIntel": "macOS Intel",
    "dl.recommended": "tu equipo",
    "dl.all": "Ver todas las versiones",

    "crash.title": "Algo salió mal",
    "crash.body":
      "La aplicación encontró un error inesperado. Tu imagen no se ha enviado a ningún sitio — todo ocurre en tu navegador.",
    "crash.reset": "Reiniciar",
    "crash.detail": "Detalle técnico",
  },

  en: {
    "tab.cut": "Cutout",
    openPhoto: "Open photo",
    "about.aria": "About & licenses",
    "lang.aria": "Language",

    "rail.mark": "Mark",
    "rail.export": "Export",
    "tool.ai": "AI cutout ✨",
    "tool.auto": "Auto cutout",
    "tool.rect": "Box select",
    "tool.keep": "Keep brush",
    "tool.remove": "Remove brush",
    "brush.label": "Brush — {n}px",
    "feather.label": "Edge feather — {n}px",
    undo: "↩ Undo",
    redo: "↪ Redo",
    "preview.show": "Preview",
    "preview.hide": "Hide preview",
    "export.clipboard": "Copy to clipboard",
    "export.bgcolor.aria": "Background color",
    "export.icons": "→ Create app icons",
    "export.modeAria": "Export background",
    "export.mode.transparent": "Transparent",
    "export.mode.solid": "Color",
    "export.mode.image": "Image",
    "export.download": "Download",
    "export.bgChoose": "Choose background image…",
    "export.bgRemove": "Remove background image",
    "export.bgOpacity": "Background opacity — {n}%",
    "toast.bgSet": "Background loaded — see it in the preview (P)",
    "toast.cutLoaded": "Cutout loaded as a new image — keep editing",
    "preview.dropHint": "Drag the cutout and drop it on the canvas to keep editing it",
    "rail.help":
      "A auto · 1 box · 2/3 brushes · P preview · E export · ? shortcuts. Drag or paste (⌘V) any image.",

    "toast.loaded": "{w} × {h} px loaded",
    "toast.ai": "AI cutout applied — paint to refine",
    "toast.aiDownloading": "Downloading the AI model (~18 MB, first time only)…",
    "toast.cut": "Cutout ready — paint to refine edges",
    "toast.auto": "Auto cutout applied",
    "toast.exported": "Exported ✓",
    "toast.copied": "PNG copied to clipboard ✓",
    "toast.copyfail": "Couldn't copy: {e}",
    "toast.heic": "iPhone HEIC isn't supported — export the photo as JPG or PNG",
    "toast.unreadable": "Couldn't read that file as an image",
    "toast.reduced": "Reduced to 4K (original {w} × {h} px)",
    "toast.zip": "ZIP ready — {n}+ icons across {p} platforms",
    "toast.py": "make_icons.py downloaded — pip install pillow and go",
    "toast.cutfail": "Couldn't get the cutout: {e}",
    "toast.iconsfail": "Error generating icons: {e}",

    "large.title": "Very large image",
    "large.body":
      "{w} × {h} px ({mp} MP). Processing it at full size can exhaust the browser's memory.",
    "large.reduce": "Reduce to 4K (recommended)",
    "large.cancel": "Cancel",
    "drop.here": "Drop it here",

    "canvas.empty.title": "Drop an image here",
    "canvas.empty.body":
      "Drag a file in, paste from the clipboard (⌘V) or use “Open photo”. Then draw a box around the subject — or try the auto cutout.",
    busy: "processing…",

    "previewPanel.title": "Preview",
    "previewPanel.alt": "Cutout preview over the chosen background",
    "previewPanel.transparent": "Transparent background",
    "previewPanel.white": "White background",
    "previewPanel.black": "Black background",
    "previewPanel.custom": "Custom background color",
    "previewPanel.close": "Close preview",
    "previewPanel.bgAria": "Preview background",
    "previewPanel.resize": "Resize the preview",

    "icon.source": "Source",
    "icon.useCurrent": "Use current cutout",
    "icon.openPng": "Open PNG…",
    "icon.currentTag": "current cutout",
    "icon.settings": "Settings",
    "icon.margin": "Margin — {n}%",
    "icon.bg": "Background",
    "icon.bgAria": "Icon background color",
    "icon.appName": "App name",
    "icon.platforms": "Platforms",
    "icon.generate": "Generate",
    "icon.zipBtn": "Download icon ZIP",
    "icon.building": "Generating…",
    "icon.pyBtn": "Python script (CLI)",
    "icon.trim": "Trim to content",
    "icon.fitAria": "Image fit",
    "icon.fit.contain": "Whole image",
    "icon.fit.cover": "Crop overflow",
    "icon.bgImage": "Background image…",
    "icon.bgImageRemove": "Remove background image",
    "icon.trimmed": "Trimmed to {w} × {h} px — painted pixels only",
    "icon.trimNone": "No transparent margin to trim",
    "icon.trimTag": "(trimmed)",
    "icon.removeBg": "Remove background ✨",
    "icon.removing": "Removing background…",
    "icon.bgRemoved": "Background removed ✓",
    "icon.noBgTag": "(no background)",
    "icon.snippetBtn": "Copy favicon HTML",
    "icon.snippetCopied": "Favicon snippet copied ✓",
    "icon.py1": "The",
    "icon.py2": "script generates the same sizes from the terminal:",
    "icon.py3": "Only needs Pillow.",
    "icon.emptyBody":
      "Use the current cutout or open a transparent PNG. We generate every size for iOS, Android, macOS, Windows and Web — ready to drop into your project.",
    "icon.note":
      "Pixel-perfect preview — exactly how the icon will look in the dock, tab bar and home screen.",

    "about.body": "Background removal and app-icon generation, 100% in your browser.",
    "about.privacy": "Your images never get uploaded to any server.",
    "about.thirdparty": "Third-party software",
    "about.donate": "☕ Buy me a coffee (Ko-fi)",
    "about.linksAria": "Legal links and guides",
    "about.privacyLink": "Privacy",
    "about.termsLink": "Terms of use",
    "about.guides": "Guides",
    "donate.aria": "Support the project on Ko-fi",
    "ad.label": "Advertisement",
    "house.label": "Independent project",
    "house.body":
      "PhotoCut is free and your photos never leave your browser. If it helps you, help keep it that way.",
    "house.donate": "☕ Buy me a coffee",
    "house.desktop": "⬇ Desktop app",
    close: "Close",

    "compare.toggle": "Compare",
    "compare.before": "Before",
    "compare.after": "After",
    "compare.aria": "Before/after divider",
    "zoom.reset": "Reset zoom (double-click)",
    "sc.compare": "Compare before/after",
    "sc.zoom": "Zoom to cursor",
    "sc.pan": "Pan the canvas (when zoomed)",
    "help.title": "Keyboard shortcuts",
    "sc.ai": "AI cutout", "sc.auto": "Auto cutout",
    "sc.rect": "Box select",
    "sc.brushes": "Keep / remove brush",
    "sc.brushsize": "Brush size",
    "sc.preview": "Preview",
    "sc.export": "Export transparent PNG",
    "sc.undoredo": "Undo / redo",
    "sc.paste": "Paste image from clipboard",
    "sc.help": "This help",
    "sc.close": "Close panels",

    "ob.title": "Remove the background in three steps",
    "ob.privacy":
      "Everything happens in your browser — your photos never get uploaded anywhere.",
    "ob.1.title": "Open a photo",
    "ob.1.body": "Drag a file in, paste with ⌘V or tap “Open photo”.",
    "ob.2.title": "Mark the subject",
    "ob.2.body": "Draw a box around it — or use the auto cutout (A).",
    "ob.3.title": "Refine and export",
    "ob.3.body":
      "Keep/remove brushes for the edges. Export a transparent PNG or create app icons.",
    "ob.go": "Let's cut!",

    "finish.title": "Finishing",
    "finish.sticker": "Sticker (outline)",
    "finish.stickerWidth": "Width — {n}px",
    "finish.shadow": "Shadow",
    "finish.shadowSize": "Intensity — {n}",
    "preset.label": "Size preset",
    "preset.original": "Original",
    "preset.amazon": "Amazon 2000×2000",
    "preset.etsy": "Etsy 2700×2025",
    "preset.shopify": "Shopify 2048×2048",
    "preset.igPost": "Instagram post 1080×1080",
    "preset.igStory": "Instagram story 1080×1920",
    "preset.avatar": "Circle avatar 512",

    "dl.aria": "Download the desktop app",
    "dl.title": "Desktop app",
    "dl.body":
      "The full Rust engine, no browser, 100% offline. Unsigned builds: on macOS, right-click → Open the first time.",
    "dl.loading": "Looking up the latest version…",
    "dl.none": "No installers published yet — coming very soon.",
    "dl.win": "Windows (x64)",
    "dl.macArm": "macOS Apple Silicon",
    "dl.macIntel": "macOS Intel",
    "dl.recommended": "your machine",
    "dl.all": "See all releases",

    "crash.title": "Something went wrong",
    "crash.body":
      "The app hit an unexpected error. Your image was never sent anywhere — everything happens in your browser.",
    "crash.reset": "Restart",
    "crash.detail": "Technical details",
  },

  pt: {
    "tab.cut": "Recorte",
    openPhoto: "Abrir foto",
    "about.aria": "Sobre e licenças",
    "lang.aria": "Idioma",

    "rail.mark": "Marcar",
    "rail.export": "Exportar",
    "tool.ai": "Recorte IA ✨",
    "tool.auto": "Recorte automático",
    "tool.rect": "Retângulo",
    "tool.keep": "Pincel manter",
    "tool.remove": "Pincel remover",
    "brush.label": "Pincel — {n}px",
    "feather.label": "Suavização de borda — {n}px",
    undo: "↩ Desfazer",
    redo: "↪ Refazer",
    "preview.show": "Pré-visualização",
    "preview.hide": "Ocultar pré-visualização",
    "export.clipboard": "Copiar para a área de transferência",
    "export.bgcolor.aria": "Cor de fundo",
    "export.icons": "→ Criar ícones de app",
    "export.modeAria": "Fundo da exportação",
    "export.mode.transparent": "Transparente",
    "export.mode.solid": "Cor",
    "export.mode.image": "Imagem",
    "export.download": "Baixar",
    "export.bgChoose": "Escolher imagem de fundo…",
    "export.bgRemove": "Remover imagem de fundo",
    "export.bgOpacity": "Opacidade do fundo — {n}%",
    "toast.bgSet": "Fundo carregado — veja na pré-visualização (P)",
    "toast.cutLoaded": "Recorte carregado como nova imagem — continue editando",
    "preview.dropHint": "Arraste o recorte e solte na tela para continuar editando",
    "rail.help":
      "A automático · 1 retângulo · 2/3 pincéis · P pré-visualização · E exportar · ? atalhos. Arraste ou cole (⌘V) qualquer imagem.",

    "toast.loaded": "{w} × {h} px carregados",
    "toast.ai": "Recorte IA aplicado — pinte para refinar",
    "toast.aiDownloading": "Baixando o modelo de IA (~18 MB, só na primeira vez)…",
    "toast.cut": "Recorte pronto — pinte para refinar as bordas",
    "toast.auto": "Recorte automático aplicado",
    "toast.exported": "Exportado ✓",
    "toast.copied": "PNG copiado ✓",
    "toast.copyfail": "Não foi possível copiar: {e}",
    "toast.heic": "HEIC do iPhone não é suportado — exporte a foto como JPG ou PNG",
    "toast.unreadable": "Não foi possível ler esse arquivo como imagem",
    "toast.reduced": "Reduzida para 4K (original {w} × {h} px)",
    "toast.zip": "ZIP pronto — {n}+ ícones em {p} plataformas",
    "toast.py": "make_icons.py baixado — pip install pillow e pronto",
    "toast.cutfail": "Não foi possível obter o recorte: {e}",
    "toast.iconsfail": "Erro ao gerar ícones: {e}",

    "large.title": "Imagem muito grande",
    "large.body":
      "{w} × {h} px ({mp} MP). Processá-la inteira pode esgotar a memória do navegador.",
    "large.reduce": "Reduzir para 4K (recomendado)",
    "large.cancel": "Cancelar",
    "drop.here": "Solte aqui",

    "canvas.empty.title": "Solte uma imagem aqui",
    "canvas.empty.body":
      "Arraste um arquivo, cole da área de transferência (⌘V) ou use «Abrir foto». Depois desenhe um retângulo ao redor do sujeito — ou experimente o recorte automático.",
    busy: "processando…",

    "previewPanel.title": "Pré-visualização",
    "previewPanel.alt": "Pré-visualização do recorte sobre o fundo escolhido",
    "previewPanel.transparent": "Fundo transparente",
    "previewPanel.white": "Fundo branco",
    "previewPanel.black": "Fundo preto",
    "previewPanel.custom": "Cor de fundo personalizada",
    "previewPanel.close": "Fechar pré-visualização",
    "previewPanel.bgAria": "Fundo da pré-visualização",
    "previewPanel.resize": "Redimensionar a pré-visualização",

    "icon.source": "Fonte",
    "icon.useCurrent": "Usar recorte atual",
    "icon.openPng": "Abrir PNG…",
    "icon.currentTag": "recorte atual",
    "icon.settings": "Ajustes",
    "icon.margin": "Margem — {n}%",
    "icon.bg": "Fundo",
    "icon.bgAria": "Cor de fundo do ícone",
    "icon.appName": "Nome do app",
    "icon.platforms": "Plataformas",
    "icon.generate": "Gerar",
    "icon.zipBtn": "Baixar ZIP de ícones",
    "icon.building": "Gerando…",
    "icon.pyBtn": "Script Python (CLI)",
    "icon.trim": "Recortar ao conteúdo",
    "icon.fitAria": "Encaixe da imagem",
    "icon.fit.contain": "Imagem inteira",
    "icon.fit.cover": "Cortar excedente",
    "icon.bgImage": "Imagem de fundo…",
    "icon.bgImageRemove": "Remover imagem de fundo",
    "icon.trimmed": "Recortada para {w} × {h} px — só o pintado",
    "icon.trimNone": "Sem margem transparente para recortar",
    "icon.trimTag": "(recortado)",
    "icon.removeBg": "Remover fundo ✨",
    "icon.removing": "Removendo fundo…",
    "icon.bgRemoved": "Fundo removido ✓",
    "icon.noBgTag": "(sem fundo)",
    "icon.snippetBtn": "Copiar HTML de favicons",
    "icon.snippetCopied": "Snippet de favicons copiado ✓",
    "icon.py1": "O script",
    "icon.py2": "gera as mesmas medidas pelo terminal:",
    "icon.py3": "Só precisa do Pillow.",
    "icon.emptyBody":
      "Use o recorte atual ou abra um PNG transparente. Geramos todas as medidas para iOS, Android, macOS, Windows e Web — prontas para colar no seu projeto.",
    "icon.note":
      "Visualização pixel-perfect — é assim que o ícone vai aparecer no dock, na barra de abas e na home screen.",

    "about.body": "Remoção de fundo e geração de ícones, 100% no seu navegador.",
    "about.privacy": "Suas imagens nunca são enviadas a nenhum servidor.",
    "about.thirdparty": "Software de terceiros",
    "about.donate": "☕ Me pague um cafezinho (Ko-fi)",
    "about.linksAria": "Links legais e guias",
    "about.privacyLink": "Privacidade",
    "about.termsLink": "Termos de uso",
    "about.guides": "Guias",
    "donate.aria": "Apoiar o projeto no Ko-fi",
    "ad.label": "Publicidade",
    "house.label": "Projeto independente",
    "house.body":
      "O PhotoCut é grátis e suas fotos nunca saem do seu navegador. Se ele te ajuda, ajude a continuar assim.",
    "house.donate": "☕ Pagar um cafezinho",
    "house.desktop": "⬇ App para desktop",
    close: "Fechar",

    "compare.toggle": "Comparar",
    "compare.before": "Antes",
    "compare.after": "Depois",
    "compare.aria": "Divisor antes/depois",
    "zoom.reset": "Redefinir zoom (clique duplo)",
    "sc.compare": "Comparar antes/depois",
    "sc.zoom": "Zoom no cursor",
    "sc.pan": "Mover a tela (com zoom)",
    "help.title": "Atalhos de teclado",
    "sc.ai": "Recorte IA", "sc.auto": "Recorte automático",
    "sc.rect": "Retângulo",
    "sc.brushes": "Pincel manter / remover",
    "sc.brushsize": "Tamanho do pincel",
    "sc.preview": "Pré-visualização",
    "sc.export": "Exportar PNG transparente",
    "sc.undoredo": "Desfazer / refazer",
    "sc.paste": "Colar imagem da área de transferência",
    "sc.help": "Esta ajuda",
    "sc.close": "Fechar painéis",

    "ob.title": "Remova o fundo em três passos",
    "ob.privacy":
      "Tudo acontece no seu navegador — suas fotos nunca são enviadas a nenhum servidor.",
    "ob.1.title": "Abra uma foto",
    "ob.1.body": "Arraste um arquivo, cole com ⌘V ou toque em «Abrir foto».",
    "ob.2.title": "Marque o sujeito",
    "ob.2.body": "Desenhe um retângulo ao redor — ou use o recorte automático (A).",
    "ob.3.title": "Refine e exporte",
    "ob.3.body":
      "Pincéis manter/remover para as bordas. Exporte PNG transparente ou crie ícones de app.",
    "ob.go": "Vamos recortar!",

    "finish.title": "Acabamento",
    "finish.sticker": "Sticker (contorno)",
    "finish.stickerWidth": "Espessura — {n}px",
    "finish.shadow": "Sombra",
    "finish.shadowSize": "Intensidade — {n}",
    "preset.label": "Preset de tamanho",
    "preset.original": "Original",
    "preset.amazon": "Amazon 2000×2000",
    "preset.etsy": "Etsy 2700×2025",
    "preset.shopify": "Shopify 2048×2048",
    "preset.igPost": "Instagram post 1080×1080",
    "preset.igStory": "Instagram story 1080×1920",
    "preset.avatar": "Avatar circular 512",

    "dl.aria": "Baixar o app para desktop",
    "dl.title": "App para desktop",
    "dl.body":
      "O motor Rust completo, sem navegador e 100% offline. Builds sem assinatura: no macOS, clique com o botão direito → Abrir na primeira vez.",
    "dl.loading": "Buscando a última versão…",
    "dl.none": "Ainda não há instaladores publicados — em breve.",
    "dl.win": "Windows (x64)",
    "dl.macArm": "macOS Apple Silicon",
    "dl.macIntel": "macOS Intel",
    "dl.recommended": "sua máquina",
    "dl.all": "Ver todas as versões",

    "crash.title": "Algo deu errado",
    "crash.body":
      "O aplicativo encontrou um erro inesperado. Sua imagem não foi enviada a lugar nenhum — tudo acontece no seu navegador.",
    "crash.reset": "Reiniciar",
    "crash.detail": "Detalhes técnicos",
  },
};

function detectLang() {
  try {
    const stored = localStorage.getItem("pc-lang");
    if (stored && DICT[stored]) return stored;
  } catch {
    /* sin storage */
  }
  const nav = (typeof navigator !== "undefined" && navigator.language) || "en";
  const prefix = nav.slice(0, 2).toLowerCase();
  return DICT[prefix] ? prefix : "en";
}

let lang = detectLang();
const listeners = new Set();

if (typeof document !== "undefined") {
  document.documentElement.lang = lang;
}

export function getLang() {
  return lang;
}

export function setLang(next) {
  if (!DICT[next] || next === lang) return;
  lang = next;
  try {
    localStorage.setItem("pc-lang", next);
  } catch {
    /* sin storage */
  }
  if (typeof document !== "undefined") document.documentElement.lang = next;
  for (const fn of listeners) fn(next);
}

/** Suscribe el componente al idioma actual (re-render al cambiar). */
export function useLang() {
  const [current, setCurrent] = useState(lang);
  useEffect(() => {
    listeners.add(setCurrent);
    return () => listeners.delete(setCurrent);
  }, []);
  return current;
}

export function t(key, vars) {
  const s = DICT[lang][key] ?? DICT.en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? "")) : s;
}
