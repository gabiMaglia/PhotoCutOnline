import { useState, useRef, useCallback, useEffect } from "react";
import { backend } from "../../../lib/backend.js";
import { t } from "../../../lib/i18n.js";
import { trackEvent } from "../../../services/analytics.js";

const ITERS = 4;

// Núcleo de la sesión de recorte: estado del resultado y todas las operaciones
// del motor (recuadro, IA, automático, pincel, deshacer/rehacer, suavizado,
// acabado). Se reinicia solo cuando cambia la imagen de trabajo.
export function useCutoutSession({ imageUrl, toast }) {
  const [resultUrl, setResultUrl] = useState(null);
  const [mode, setMode] = useState("rect"); // rect | wand | fg | bg
  const [brushSize, setBrushSize] = useState(28);
  const [wandTolerance, setWandTolerance] = useState(30);
  const [feather, setFeather] = useState(2);
  const [stickerOn, setStickerOn] = useState(false);
  const [stickerWidth, setStickerWidth] = useState(14);
  const [shadowOn, setShadowOn] = useState(false);
  const [shadowSize, setShadowSize] = useState(40);
  const [compare, setCompare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasCut, setHasCut] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const aiWarm = useRef(false);
  const finishTimer = useRef(null);
  const featherTimer = useRef(null);

  // reinicio al cargar una imagen nueva. También se cancelan los timers de
  // debounce pendientes: si no, un setFeather/setFinish en vuelo dispararía
  // setResultUrl sobre la sesión ya reiniciada (preview espurio / fuga).
  useEffect(() => {
    clearTimeout(featherTimer.current);
    clearTimeout(finishTimer.current);
    setResultUrl(null);
    setHasCut(false);
    setCanUndo(false);
    setCanRedo(false);
    setCompare(false);
    setMode("rect");
  }, [imageUrl]);

  // limpieza al desmontar: ningún timer debe sobrevivir al componente
  useEffect(
    () => () => {
      clearTimeout(featherTimer.current);
      clearTimeout(finishTimer.current);
    },
    []
  );

  const refreshUndo = useCallback(() => {
    setCanUndo(backend.canUndo());
    setCanRedo(backend.canRedo());
  }, []);

  // envuelve una operación del motor: marca busy, aplica el preview y avisa
  const runOp = useCallback(
    async (fn, okKey, { setCutMode = true, method } = {}) => {
      setBusy(true);
      try {
        const url = await fn();
        setResultUrl(url);
        setHasCut(true);
        if (setCutMode) setMode("fg");
        refreshUndo();
        if (method) trackEvent("cutout", { method });
        if (okKey) toast(t(okKey), "ok");
      } catch (e) {
        toast(String(e), "error");
      } finally {
        setBusy(false);
      }
    },
    [toast, refreshUndo]
  );

  const handleRect = useCallback(
    (rect) => runOp(() => backend.cutRect(rect, ITERS), "toast.cut", { method: "rect" }),
    [runOp]
  );

  // varita por color: cada clic suma una región; shift/clics siguientes acumulan
  const handleWand = useCallback(
    (seed, additive) =>
      runOp(() => backend.wand(seed, wandTolerance, additive), additive ? null : "toast.wand", {
        method: "wand",
      }),
    [runOp, wandTolerance]
  );

  const handleAuto = useCallback(() => {
    if (!imageUrl || busy) return;
    return runOp(() => backend.autoCut(), "toast.auto", { method: "auto" });
  }, [imageUrl, busy, runOp]);

  const handleAi = useCallback(() => {
    if (!imageUrl || busy) return;
    return runOp(async () => {
      if (!aiWarm.current) {
        toast(t("toast.aiDownloading"), "ok");
        await backend.warmupAi();
        aiWarm.current = true;
      }
      return backend.aiCut();
    }, "toast.ai", { method: "ai" });
  }, [imageUrl, busy, runOp, toast]);

  const handleStroke = useCallback(
    async (stroke) => {
      if (!stroke.points.length) return;
      setBusy(true);
      try {
        setResultUrl(await backend.refine(stroke, 2));
        refreshUndo();
      } catch (e) {
        toast(String(e), "error");
      } finally {
        setBusy(false);
      }
    },
    [toast, refreshUndo]
  );

  const handleUndo = useCallback(async () => {
    if (!backend.canUndo()) return;
    const url = await backend.undo();
    setResultUrl(url);
    setHasCut(!!url);
    if (!url) setMode("rect");
    refreshUndo();
  }, [refreshUndo]);

  const handleRedo = useCallback(async () => {
    if (!backend.canRedo()) return;
    const url = await backend.redo();
    if (url) {
      setResultUrl(url);
      setHasCut(true);
    }
    refreshUndo();
  }, [refreshUndo]);

  // suavizado y acabado son ajustes en vivo: se debouncean para no recalcular
  // el preview en cada tick del slider
  const handleFeather = useCallback((value) => {
    setFeather(value);
    clearTimeout(featherTimer.current);
    featherTimer.current = setTimeout(async () => {
      const url = await backend.setFeather(value);
      if (url) setResultUrl(url);
    }, 120);
  }, []);

  const applyFinish = useCallback((sticker, sw, shadow, ss) => {
    clearTimeout(finishTimer.current);
    finishTimer.current = setTimeout(async () => {
      const finish = {
        sticker: sticker ? { width: sw, color: [255, 255, 255] } : null,
        shadow: shadow
          ? { blur: 8 + ss * 0.5, dx: 0, dy: 4 + ss * 0.3, opacity: 0.25 + ss * 0.004 }
          : null,
      };
      const url = await backend.setFinish(finish);
      if (url) setResultUrl(url);
    }, 120);
  }, []);

  const setSticker = useCallback(
    (on) => {
      setStickerOn(on);
      applyFinish(on, stickerWidth, shadowOn, shadowSize);
    },
    [applyFinish, stickerWidth, shadowOn, shadowSize]
  );
  const changeStickerWidth = useCallback(
    (v) => {
      setStickerWidth(v);
      applyFinish(stickerOn, v, shadowOn, shadowSize);
    },
    [applyFinish, stickerOn, shadowOn, shadowSize]
  );
  const setShadow = useCallback(
    (on) => {
      setShadowOn(on);
      applyFinish(stickerOn, stickerWidth, on, shadowSize);
    },
    [applyFinish, stickerOn, stickerWidth, shadowSize]
  );
  const changeShadowSize = useCallback(
    (v) => {
      setShadowSize(v);
      applyFinish(stickerOn, stickerWidth, shadowOn, v);
    },
    [applyFinish, stickerOn, stickerWidth, shadowOn]
  );

  const nudgeBrush = useCallback(
    (delta) => setBrushSize((s) => Math.max(4, Math.min(120, s + delta))),
    []
  );

  return {
    // estado
    resultUrl,
    mode,
    setMode,
    brushSize,
    setBrushSize,
    nudgeBrush,
    wandTolerance,
    setWandTolerance,
    feather,
    handleFeather,
    stickerOn,
    stickerWidth,
    shadowOn,
    shadowSize,
    setSticker,
    changeStickerWidth,
    setShadow,
    changeShadowSize,
    compare,
    setCompare,
    busy,
    setBusy,
    hasCut,
    canUndo,
    canRedo,
    // operaciones
    handleRect,
    handleWand,
    handleAi,
    handleAuto,
    handleStroke,
    handleUndo,
    handleRedo,
  };
}
