import * as monaco from "monaco-editor";
import { TileListItem, TileUpdatePayload } from "../core/types";

const isElectron = !!(window as any).tileboard?.isElectron;
const apiBase = isElectron ? "" : "";

let editor: monaco.editor.IStandaloneCodeEditor | null = null;
let currentTileId: string | null = null;
let tileList: TileListItem[] = [];
let previewTimer: ReturnType<typeof setTimeout> | null = null;

const DEFAULT_HTML = `<style>\n  \n</style>\n<div>New Tile</div>\n`;

async function reload(): Promise<void> {
  try {
    const res = await fetch(`${apiBase}/api/tiles`);
    tileList = await res.json();
    renderTileList();
  } catch (e) {
    console.error("Failed to load tiles:", e);
  }
}

async function selectTile(id: string): Promise<void> {
  currentTileId = id;
  try {
    const res = await fetch(`${apiBase}/api/tiles/${id}`);
    const yamlRaw = await res.text();
    const YAML = (await import("yaml")).default || (await import("yaml"));
    const data = YAML.parse(yamlRaw) || {};

    (document.getElementById("tile-id") as HTMLInputElement).value = data.id || id;
    (document.getElementById("tile-priority") as HTMLInputElement).value = data.priority ?? 0;
    (document.getElementById("tile-width") as HTMLInputElement).value = data.width || "";
    (document.getElementById("tile-height") as HTMLInputElement).value = data.height || "";
    (document.getElementById("tile-timeout") as HTMLInputElement).value = data.timeout ?? 0;
    (document.getElementById("tile-protect") as HTMLInputElement).checked = data.protect ?? false;

    if (editor) {
      editor.setValue(data.html || "");
    }
  } catch (e) {
    console.error("Failed to load tile:", e);
  }
}

function updatePreview(): void {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const frame = document.getElementById("preview-frame") as HTMLIFrameElement;
    if (!frame || !editor) return;
    const html = editor.getValue();
    frame.srcdoc = html;
  }, 400);
}

async function saveTile(): Promise<void> {
  if (!currentTileId) return;
  const payload: TileUpdatePayload = {
    id: (document.getElementById("tile-id") as HTMLInputElement).value || currentTileId,
    html: editor?.getValue() || "",
    priority: parseInt((document.getElementById("tile-priority") as HTMLInputElement).value, 10) || 0,
    protect: (document.getElementById("tile-protect") as HTMLInputElement).checked,
    timeout: parseInt((document.getElementById("tile-timeout") as HTMLInputElement).value, 10) || 0,
    width: parseInt((document.getElementById("tile-width") as HTMLInputElement).value, 10) || undefined,
    height: parseInt((document.getElementById("tile-height") as HTMLInputElement).value, 10) || undefined,
  };

  try {
    const res = await fetch(`${apiBase}/api/tiles/${payload.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    if (payload.id !== currentTileId) {
      currentTileId = payload.id;
    }

    showMessage("Tile saved.", "success");
    await reload();

    try {
      await fetch(`${apiBase}/api/tiles/reload`, { method: "POST" });
    } catch {}
  } catch (e: any) {
    showMessage(`Save failed: ${e.message}`, "error");
  }
}

async function deleteCurrentTile(): Promise<void> {
  if (!currentTileId) return;
  if (!confirm(`Delete tile "${currentTileId}"?`)) return;
  try {
    await fetch(`${apiBase}/api/tiles/${currentTileId}`, { method: "DELETE" });
    currentTileId = null;
    if (editor) editor.setValue("");
    clearForm();
    updatePreview();
    showMessage("Tile deleted.", "success");
    await reload();
    try {
      await fetch(`${apiBase}/api/tiles/reload`, { method: "POST" });
    } catch {}
  } catch (e: any) {
    showMessage(`Delete failed: ${e.message}`, "error");
  }
}

function newTile(): void {
  currentTileId = "new-" + Date.now().toString(36);
  clearForm();
  (document.getElementById("tile-id") as HTMLInputElement).value = currentTileId;
  if (editor) editor.setValue(DEFAULT_HTML);
  renderTileList();
}

async function exportZip(): Promise<void> {
  try {
    const res = await fetch(`${apiBase}/api/tiles/export`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tileboard-tiles.zip";
    a.click();
    URL.revokeObjectURL(url);
    showMessage("ZIP downloaded.", "success");
  } catch (e: any) {
    showMessage(`Export failed: ${e.message}`, "error");
  }
}

function clearForm(): void {
  (document.getElementById("tile-id") as HTMLInputElement).value = "";
  (document.getElementById("tile-priority") as HTMLInputElement).value = "0";
  (document.getElementById("tile-width") as HTMLInputElement).value = "";
  (document.getElementById("tile-height") as HTMLInputElement).value = "";
  (document.getElementById("tile-timeout") as HTMLInputElement).value = "0";
  (document.getElementById("tile-protect") as HTMLInputElement).checked = false;
}

function renderTileList(): void {
  const listEl = document.getElementById("tile-list")!;
  listEl.innerHTML = "";

  for (const tile of tileList) {
    const el = document.createElement("div");
    el.className = "tile-item";
    if (tile.id === currentTileId) el.classList.add("active");
    el.textContent = tile.id;
    el.addEventListener("click", () => selectTile(tile.id));
    listEl.appendChild(el);
  }
}

function showMessage(text: string, type: "success" | "error"): void {
  const el = document.getElementById("message")!;
  el.textContent = text;
  el.className = type;
  setTimeout(() => { el.textContent = ""; el.className = ""; }, 3000);
}

async function initEditor(): Promise<void> {
  editor = monaco.editor.create(document.getElementById("editor")!, {
    value: "",
    language: "html",
    theme: "vs-dark",
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    wordWrap: "on",
  });

  editor.onDidChangeModelContent(() => {
    updatePreview();
  });
}

async function init(): Promise<void> {
  await initEditor();

  document.getElementById("btn-save")!.addEventListener("click", saveTile);
  document.getElementById("btn-delete")!.addEventListener("click", deleteCurrentTile);
  document.getElementById("btn-new")!.addEventListener("click", newTile);
  document.getElementById("btn-reload")!.addEventListener("click", async () => {
    try {
      await fetch(`${apiBase}/api/tiles/reload`, { method: "POST" });
      showMessage("Reload triggered.", "success");
    } catch (e: any) {
      showMessage(`Reload failed: ${e.message}`, "error");
    }
  });
  document.getElementById("btn-export")!.addEventListener("click", exportZip);

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveTile();
    }
  });

  await reload();
  if (tileList.length > 0) {
    await selectTile(tileList[0].id);
  }
}

init();
