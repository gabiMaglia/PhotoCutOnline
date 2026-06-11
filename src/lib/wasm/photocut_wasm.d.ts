/* tslint:disable */
/* eslint-disable */

export class WasmCut {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * `rgba`: buffer row-major RGBA de `width × height` (el canal alfa se ignora).
     */
    constructor(width: number, height: number, rgba: Uint8Array);
    /**
     * Corre GrabCut con el trimap dado (0=BG, 1=FG, 2=quizásBG, 3=quizásFG)
     * y devuelve la máscara alfa binaria (255 = primer plano).
     */
    segment(trimap: Uint8Array, iters: number): Uint8Array;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmcut_free: (a: number, b: number) => void;
    readonly wasmcut_new: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasmcut_segment: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
