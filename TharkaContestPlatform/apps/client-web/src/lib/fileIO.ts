// Saving/opening the editor buffer as a real file on disk, for the Compiler
// page's Save / Open / Ctrl+S / Ctrl+O.
//
// Three tiers, feature-detected in this order:
//   1. Electron - `window.contestAPI.saveFile/openFile` drives a native OS
//      dialog over IPC and hands back a real absolute path, so a later Ctrl+S
//      overwrites the same file silently instead of re-prompting. Same
//      `window.contestAPI` seam as the rest of the app; the renderer never
//      touches `fs` itself, it only ever round-trips an opaque path string.
//   2. File System Access API - Chromium's `showSaveFilePicker`/
//      `showOpenFilePicker`. Gives the same save-in-place behaviour via a
//      retained FileSystemFileHandle. Secure contexts only (https or
//      localhost), so this covers dev but *not* a student browsing to the
//      lab server over plain http on a LAN IP.
//   3. Anything else - a download for save, a hidden <input type="file"> for
//      open. There is no handle to hold onto, so each Ctrl+S downloads a
//      fresh copy rather than overwriting; `canSaveInPlace` reports this so
//      the UI can label the button honestly.

export interface EditorFile {
  name: string;
  /** Electron only: absolute path on disk. */
  path?: string;
  /** Browser File System Access API only: retained write handle. */
  handle?: any;
}

export interface OpenedFile {
  file: EditorFile;
  code: string;
}

const ACCEPT_EXTENSIONS = [".cpp", ".cc", ".cxx", ".c", ".h", ".hpp", ".txt"];

const PICKER_TYPES = [
  {
    description: "C++ source",
    accept: { "text/plain": ACCEPT_EXTENSIONS },
  },
];

function electronAPI(): any {
  return (window as any).contestAPI;
}

/** True when a save would overwrite `file` in place rather than re-prompting. */
export function canSaveInPlace(file: EditorFile | null): boolean {
  return !!(file && (file.path || file.handle));
}

/** Human label for where files end up, used in the shortcuts help text. */
export function fileAccessMode(): "native" | "picker" | "download" {
  if (electronAPI()?.saveFile) return "native";
  if (typeof (window as any).showSaveFilePicker === "function") return "picker";
  return "download";
}

export async function openCodeFile(): Promise<OpenedFile | null> {
  const api = electronAPI();
  if (api?.openFile) {
    const res = await api.openFile();
    if (!res || res.canceled) return null;
    if (res.error) throw new Error(res.error);
    return { file: { name: res.name, path: res.path }, code: res.content };
  }

  if (typeof (window as any).showOpenFilePicker === "function") {
    let handles: any[];
    try {
      handles = await (window as any).showOpenFilePicker({ types: PICKER_TYPES, multiple: false });
    } catch (err: any) {
      if (err?.name === "AbortError") return null; // user closed the dialog
      throw err;
    }
    const handle = handles[0];
    const f = await handle.getFile();
    return { file: { name: f.name, handle }, code: await f.text() };
  }

  return new Promise<OpenedFile | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT_EXTENSIONS.join(",");
    let settled = false;
    const settle = (value: OpenedFile | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onWindowFocus);
      resolve(value);
    };
    input.onchange = async () => {
      const f = input.files?.[0];
      settle(f ? { file: { name: f.name }, code: await f.text() } : null);
    };
    input.oncancel = () => settle(null);
    // `cancel` isn't fired by every browser, which used to leave this
    // promise pending forever if the student closed the dialog without
    // picking a file. The window reliably regains focus the moment the
    // native dialog closes either way, so use that as a fallback - but only
    // resolve null from it if `input.files` is still empty by then (it's
    // populated synchronously as soon as a file is chosen, even before
    // onchange's own async body above finishes reading it), so a real
    // selection is never raced out by this fallback.
    const onWindowFocus = () => {
      window.removeEventListener("focus", onWindowFocus);
      setTimeout(() => {
        if (!input.files || input.files.length === 0) settle(null);
      }, 300);
    };
    window.addEventListener("focus", onWindowFocus);
    input.click();
  });
}

/**
 * Writes `code` to disk. With `saveAs` false and a `file` that carries a path
 * or handle, it overwrites silently; otherwise it prompts. Returns the file it
 * wrote to, or null if the user cancelled the dialog.
 */
export async function saveCodeFile(
  code: string,
  file: EditorFile | null,
  { saveAs = false, suggestedName = "Main.cpp" }: { saveAs?: boolean; suggestedName?: string } = {}
): Promise<EditorFile | null> {
  const target = saveAs ? null : file;
  const nameHint = file?.name || suggestedName;

  const api = electronAPI();
  if (api?.saveFile) {
    const res = await api.saveFile({ content: code, path: target?.path, suggestedName: nameHint });
    if (!res || res.canceled) return null;
    if (res.error) throw new Error(res.error);
    return { name: res.name, path: res.path };
  }

  if (target?.handle) {
    const writable = await target.handle.createWritable();
    await writable.write(code);
    await writable.close();
    return target;
  }

  if (typeof (window as any).showSaveFilePicker === "function") {
    let handle: any;
    try {
      handle = await (window as any).showSaveFilePicker({ suggestedName: nameHint, types: PICKER_TYPES });
    } catch (err: any) {
      if (err?.name === "AbortError") return null;
      throw err;
    }
    const writable = await handle.createWritable();
    await writable.write(code);
    await writable.close();
    return { name: handle.name, handle };
  }

  // Download fallback - no handle to retain, so this is always "save a copy".
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nameHint;
  a.click();
  URL.revokeObjectURL(url);
  return { name: nameHint };
}
