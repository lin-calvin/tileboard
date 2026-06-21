import { app, BrowserWindow } from "electron";
import { join } from "path";
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from "fs";
import * as os from "os";
import { startServer } from "./server";

let mainWindow: BrowserWindow | null = null;

function getXdgConfigDir(): string {
  const base = process.env.XDG_CONFIG_HOME || join(os.homedir(), ".config");
  return join(base, "tileboard");
}

function getDefaultsDir(): string {
  if (process.resourcesPath) return process.resourcesPath;
  return join(__dirname, "..", "..");
}

function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function ensureUserConfig(): { configPath: string; tilesDir: string } {
  const userDir = getXdgConfigDir();
  const configPath = join(userDir, "config.json");
  const tilesDir = process.env.TILEBOARD_TILES_DIR || join(userDir, "tiles");

  mkdirSync(userDir, { recursive: true });
  const defaultsDir = getDefaultsDir();

  const defaultConfig = join(defaultsDir, "config.json");
  if (!existsSync(configPath) && existsSync(defaultConfig)) {
    copyFileSync(defaultConfig, configPath);
  }

  const defaultTiles = join(defaultsDir, "tiles");
  if (!existsSync(tilesDir) && existsSync(defaultTiles)) {
    copyDirRecursive(defaultTiles, tilesDir);
  }

  return { configPath, tilesDir };
}

function createWindow(): void {
  const config = loadConfigFile();
  const headless =
    process.env.TILEBOARD_HEADLESS === "true" || (config.headless ?? false);
  const port = config.httpPort || 3456;
  const w = config.viewport?.width || 1920;
  const h = config.viewport?.height || 1080;

  const winOpts: any = {
    width: w,
    height: h,
    resizable: false,
    show: !headless,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  };

  if (headless) {
    winOpts.frame = false;
    winOpts.webPreferences.offscreen = true;
  } else {
    winOpts.useContentSize = true;
  }

  mainWindow = new BrowserWindow(winOpts);
  mainWindow.loadURL(`http://localhost:${port}/board`);
  mainWindow.setMenuBarVisibility(false);

  const scale = config.scale ?? 1;
  if (scale !== 1) {
    mainWindow.webContents.on("did-finish-load", () => {
      mainWindow!.webContents.setZoomFactor(scale);
    });
  }
}

function loadConfigFile(): any {
  try {
    const fs = require("fs");
    const userDir = getXdgConfigDir();
    const configPath = join(userDir, "config.json");
    if (existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch {}

  return {
    viewport: { width: 1920, height: 1080 },
    httpPort: 3456,
  };
}

app.whenReady().then(() => {
  const { configPath, tilesDir } = ensureUserConfig();
  startServer(() => mainWindow, configPath, tilesDir);
  createWindow();
});

app.on("window-all-closed", () => {
  if (!isHeadless()) app.quit();
});

function isHeadless(): boolean {
  try {
    return loadConfigFile().headless ?? false;
  } catch {
    return false;
  }
}
