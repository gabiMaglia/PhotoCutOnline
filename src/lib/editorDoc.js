// Traducción del contenido indexable de /editor/ (el bloque `.ed-doc`, el pie
// `.ed-foot`, el <title> y la meta description).
//
// El HTML estático de editor/index.html queda en ES: lo necesita el rastreador
// y es el fallback sin JS. Al montar la app (y al cambiar de idioma) se
// reemplaza por la versión del idioma activo; "es" restaura el original.

// Fuente de verdad de los enlaces de confianza (la misma que usa check-footers).
import { TRUST } from "../../scripts/lib/trust.mjs";

function buildFoot(home, guidesHref, guidesLabel, lang) {
  const links = [[home, "PhotoCut Studio"], [guidesHref, guidesLabel], ...TRUST[lang]];
  return links.map(([href, label]) => `<a href="${href}">${label}</a>`).join(" ·\n      ");
}

export const EDITOR_DOC = {
  en: {
    title: "Free online photo editor — remove background, crop and more — PhotoCut Studio",
    description:
      "Free photo editor that runs 100% in your browser: remove or change the background with AI, crop, censor faces, filters, watermark, app icons and format conversion. No sign-up and your photos are never uploaded to a server.",
    doc: `
      <h1>Free photo editor in your browser</h1>
      <p>
        PhotoCut Studio is an image editor that runs entirely
        <strong>inside your browser</strong>: nothing to install, no account, and
        <strong>your photos are never uploaded to a server</strong>. AI cutout and
        the rest of the tools run locally thanks to WebAssembly and an AI model
        that is downloaded only once. Drag a photo in or tap
        <strong>“Open photo”</strong> above to get started.
      </p>

      <h2>What you can do</h2>
      <ul class="feat">
        <li>Remove the background with AI in one click</li>
        <li>Swap the background for a color or an image</li>
        <li>Crop and refine edges with brushes</li>
        <li>Censor or blur faces and sensitive data</li>
        <li>Apply filters and adjustments</li>
        <li>Add a watermark</li>
        <li>Annotate with arrows and shapes</li>
        <li>Create app icons and favicons</li>
        <li>Extract the color palette from an image</li>
        <li>Convert, compress and resize</li>
      </ul>

      <h2>How to remove a photo background, in short</h2>
      <ol>
        <li>Load your photo with <strong>“Open photo”</strong> (or drag it onto the canvas).</li>
        <li>Press <strong>AI cutout</strong>: the model detects the subject and removes the background.</li>
        <li>If needed, touch up the edge with the <strong>keep</strong> and <strong>remove</strong> brushes.</li>
        <li>Choose a <strong>transparent</strong> background and export as <strong>PNG</strong> (or WebP/JPG), with no watermark.</li>
      </ol>
      <p>
        Want the step-by-step with screenshots? Read the guide
        <a href="/en/guides/remove-background-free.html">Remove a photo background for free</a>
        or browse all the <a href="/en/guides/">guides</a>.
      </p>

      <h2>Your photos never leave your browser</h2>
      <p>
        Unlike most online editors, PhotoCut does not send your images to the
        cloud to process them. Everything — AI cutout, filters, conversion —
        happens on your own device. That is why there are no usage limits, no
        watermark and no copy of your photo left on any server.
      </p>

      <h2>Frequently asked questions</h2>
      <h3>Are my photos uploaded to a server?</h3>
      <p>No. All processing happens inside your browser; your images never leave your device.</p>
      <h3>Is it free?</h3>
      <p>Yes, it is free, with no usage limits and no watermark on exports.</p>
      <h3>Do I need to install anything or create an account?</h3>
      <p>No. It works directly in the browser, with nothing to install and no sign-up.</p>
      <h3>Which formats can I export to?</h3>
      <p>PNG (with transparency), WebP and JPG. You can also resize, compress and convert between formats.</p>

      <a class="ed-cta" href="/en/guides/">See the step-by-step guides →</a>
    `,
    foot: buildFoot("/en/", "/en/guides/", "Guides", "en"),
  },
  pt: {
    title: "Editor de fotos grátis no navegador — remover fundo, recortar e mais — PhotoCut Studio",
    description:
      "Editor de fotos grátis que roda 100% no seu navegador: remova ou troque o fundo com IA, recorte, censure rostos, filtros, marca d'água, ícones de app e conversão de formato. Sem cadastro e sem enviar suas fotos a nenhum servidor.",
    doc: `
      <h1>Editor de fotos grátis no seu navegador</h1>
      <p>
        O PhotoCut Studio é um editor de imagens que funciona por completo
        <strong>dentro do seu navegador</strong>: não instala nada, não pede
        conta e <strong>suas fotos nunca são enviadas a um servidor</strong>. O
        recorte com inteligência artificial e as demais ferramentas rodam
        localmente graças ao WebAssembly e a um modelo de IA que é baixado uma
        única vez. Arraste uma foto ou toque em <strong>“Abrir foto”</strong>
        acima para começar.
      </p>

      <h2>O que você pode fazer</h2>
      <ul class="feat">
        <li>Remover o fundo com IA em um clique</li>
        <li>Trocar o fundo por uma cor ou uma imagem</li>
        <li>Recortar e refinar bordas com pincéis</li>
        <li>Censurar ou desfocar rostos e dados</li>
        <li>Aplicar filtros e ajustes</li>
        <li>Colocar uma marca d'água</li>
        <li>Anotar com setas e formas</li>
        <li>Criar ícones de app e favicons</li>
        <li>Extrair a paleta de cores de uma imagem</li>
        <li>Converter, comprimir e redimensionar</li>
      </ul>

      <h2>Como remover o fundo de uma foto, em resumo</h2>
      <ol>
        <li>Carregue sua foto com <strong>“Abrir foto”</strong> (ou arrastando-a para a tela).</li>
        <li>Clique em <strong>Recorte IA</strong>: o modelo detecta o assunto e remove o fundo.</li>
        <li>Se precisar, retoque a borda com os pincéis <strong>manter</strong> e <strong>remover</strong>.</li>
        <li>Escolha o fundo <strong>transparente</strong> e exporte em <strong>PNG</strong> (ou WebP/JPG), sem marca d'água.</li>
      </ol>
      <p>
        Quer o passo a passo com capturas de tela? Veja o guia
        <a href="/pt/guias/remover-fundo-gratis.html">Remover o fundo de uma foto grátis</a>
        ou todos os <a href="/pt/guias/">guias</a>.
      </p>

      <h2>Suas fotos não saem do seu navegador</h2>
      <p>
        Ao contrário da maioria dos editores online, o PhotoCut não envia suas
        imagens para a nuvem para processá-las. Tudo — o recorte por IA, os
        filtros, a conversão — acontece no seu próprio dispositivo. Por isso não
        há limite de uso, não há marca d'água e nenhuma cópia da sua foto fica em
        servidor algum.
      </p>

      <h2>Perguntas frequentes</h2>
      <h3>Minhas fotos são enviadas a um servidor?</h3>
      <p>Não. Todo o processamento acontece dentro do seu navegador; as imagens nunca saem do seu dispositivo.</p>
      <h3>É grátis?</h3>
      <p>Sim, é grátis, sem limite de uso e sem marca d'água nas exportações.</p>
      <h3>Preciso instalar algo ou criar uma conta?</h3>
      <p>Não. Funciona direto no navegador, sem instalar programas nem se cadastrar.</p>
      <h3>Em quais formatos posso exportar?</h3>
      <p>PNG (com transparência), WebP e JPG. Você também pode redimensionar, comprimir e converter entre formatos.</p>

      <a class="ed-cta" href="/pt/guias/">Ver os guias passo a passo →</a>
    `,
    foot: buildFoot("/pt/", "/pt/guias/", "Guias", "pt"),
  },
};

// Original ES capturado la primera vez, antes de reemplazar nada.
let original = null;

function capture() {
  if (original) return original;
  const doc = document.querySelector(".ed-doc");
  const foot = document.querySelector(".ed-foot");
  const desc = document.querySelector('meta[name="description"]');
  original = {
    title: document.title,
    description: desc?.getAttribute("content") ?? null,
    doc: doc?.innerHTML ?? null,
    foot: foot?.innerHTML ?? null,
  };
  return original;
}

// Solo una elección explícita del usuario (pc-lang) cambia el contenido
// estático; la autodetección por navigator.language nunca lo toca, así el
// rastreador (sin pc-lang) siempre ve el documento ES canónico.
function hasExplicitLang() {
  try {
    return !!localStorage.getItem("pc-lang");
  } catch {
    return false;
  }
}

/** Aplica el idioma al bloque SEO, pie, <title> y meta description. No-op fuera de /editor/. */
export function localizeEditorDoc(lang) {
  if (typeof document === "undefined") return;
  const doc = document.querySelector(".ed-doc");
  const foot = document.querySelector(".ed-foot");
  const desc = document.querySelector('meta[name="description"]');
  if (!doc && !foot) return;
  if (!hasExplicitLang()) return;
  const src = capture();
  const tr = EDITOR_DOC[lang]; // undefined para "es" → restaurar
  document.title = tr?.title ?? src.title;
  if (desc) desc.setAttribute("content", tr?.description ?? src.description ?? "");
  if (doc) doc.innerHTML = tr?.doc ?? src.doc;
  if (foot) foot.innerHTML = tr?.foot ?? src.foot;
}
