import express from "express";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { join, resolve } from "path";
import { BrowserWindow } from "electron";

let getWindow: (() => BrowserWindow | null) | null = null;
let configPath: string;
let tilesDir: string;

const webDist = resolve(__dirname, "..", "web");

function win(): BrowserWindow | null {
  return getWindow?.() ?? null;
}

function mergeEnvConfig(config: any): any {
  if (process.env.TILEBOARD_MQTT_URL) {
    config.mqtt = config.mqtt || {};
    config.mqtt.url = process.env.TILEBOARD_MQTT_URL;
  }
  if (process.env.TILEBOARD_MQTT_TOPIC) {
    config.mqtt = config.mqtt || {};
    config.mqtt.topic = process.env.TILEBOARD_MQTT_TOPIC;
  }
  if (process.env.TILEBOARD_MQTT_USERNAME) {
    config.mqtt = config.mqtt || {};
    config.mqtt.username = process.env.TILEBOARD_MQTT_USERNAME;
  }
  if (process.env.TILEBOARD_MQTT_PASSWORD) {
    config.mqtt = config.mqtt || {};
    config.mqtt.password = process.env.TILEBOARD_MQTT_PASSWORD;
  }
  if (process.env.TILEBOARD_VIEWPORT_WIDTH) {
    config.viewport = config.viewport || {};
    config.viewport.width = parseInt(process.env.TILEBOARD_VIEWPORT_WIDTH, 10);
  }
  if (process.env.TILEBOARD_VIEWPORT_HEIGHT) {
    config.viewport = config.viewport || {};
    config.viewport.height = parseInt(process.env.TILEBOARD_VIEWPORT_HEIGHT, 10);
  }
  if (process.env.TILEBOARD_HTTP_PORT) {
    config.httpPort = parseInt(process.env.TILEBOARD_HTTP_PORT, 10);
  }
  return config;
}

function loadConfig(): any {
  try {
    const raw = readFileSync(configPath, "utf-8");
    return mergeEnvConfig(JSON.parse(raw));
  } catch {
    return mergeEnvConfig({});
  }
}

function saveConfig(config: any): void {
  const dir = resolve(configPath, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

function listTileIds(tilesDir: string): string[] {
  if (!existsSync(tilesDir)) return [];
  return readdirSync(tilesDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => f.replace(/\.(yaml|yml)$/, ""));
}

function getTilePath(tilesDir: string, id: string): string {
  return join(tilesDir, `${id}.yaml`);
}

function readTile(tilesDir: string, id: string): string | null {
  const p = getTilePath(tilesDir, id);
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf-8");
}

function writeTile(tilesDir: string, id: string, content: string): void {
  if (!existsSync(tilesDir)) mkdirSync(tilesDir, { recursive: true });
  writeFileSync(getTilePath(tilesDir, id), content, "utf-8");
}

function deleteTile(tilesDir: string, id: string): boolean {
  const p = getTilePath(tilesDir, id);
  if (!existsSync(p)) return false;
  unlinkSync(p);
  return true;
}

export function startServer(gw: () => BrowserWindow | null, cfgPath: string, tDir: string): void {
  getWindow = gw;
  configPath = cfgPath;
  tilesDir = process.env.TILEBOARD_TILES_DIR || tDir;

  const app = express();
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.sendFile(join(webDist, "config.html"));
  });

  app.get("/board", (_req, res) => {
    res.sendFile(join(webDist, "index.html"));
  });

  app.get("/png", async (_req, res) => {
    try {
      const w = win();
      if (!w || w.isDestroyed()) {
        res.status(500).json({ error: "No window available" });
        return;
      }
      const [vw, vh] = w.getContentSize();
      const image = await w.webContents.capturePage({
        x: 0,
        y: 0,
        width: vw,
        height: vh,
      });
      res.set("Content-Type", "image/png");
      res.set("Refresh", "1");
      res.send(image.toPNG());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/config", (_req, res) => {
    try {
      res.json(loadConfig());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/config", (req, res) => {
    try {
      saveConfig(req.body);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/health", (_req, res) => {
    const config = loadConfig();
    res.json({
      status: "ok",
      viewport: config.viewport,
      uptime: process.uptime(),
      tilesDir,
    });
  });

  app.get("/api/tiles", (_req, res) => {
    try {
      const ids = listTileIds(tilesDir);
      const list = ids.map((id) => {
        const yamlRaw = readTile(tilesDir, id);
        if (!yamlRaw) return { id, priority: 0, protect: false, timeout: 0 };

        const YAML = require("yaml");
        const data = YAML.parse(yamlRaw) || {};
        return {
          id: data.id || id,
          priority: data.priority ?? 0,
          protect: data.protect ?? false,
          timeout: data.timeout ?? 0,
          width: data.width,
          height: data.height,
        };
      });
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tiles/reload", async (_req, res) => {
    try {
      const w = win();
      if (w && !w.isDestroyed()) {
        const result = await w.webContents.executeJavaScript(
          "window.__tileboardReload ? window.__tileboardReload().then(function(){return'ok'},function(e){return'err:'+e.message}) : 'not-ready'",
        );
        console.log("[server] Reload result:", result);
      }
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tiles/export", async (_req, res) => {
    try {
      const archiver = (await import("archiver")).default;
      const files = listTileIds(tilesDir);
      if (files.length === 0) {
        res.status(404).json({ error: "No tiles to export" });
        return;
      }

      res.set("Content-Type", "application/zip");
      res.set("Content-Disposition", `attachment; filename="tileboard-tiles.zip"`);

      const archive = (archiver as any)("zip", { zlib: { level: 9 } });
      archive.on("error", (e: any) => { throw e; });
      archive.pipe(res);

      for (const id of files) {
        const content = readTile(tilesDir, id);
        if (content) {
          archive.append(content, { name: `${id}.yaml` });
        }
      }

      archive.finalize();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tiles/:id", (req, res) => {
    try {
      const content = readTile(tilesDir, req.params.id);
      if (!content) {
        res.status(404).json({ error: "Tile not found" });
        return;
      }
      res.type("text/yaml").send(content);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tiles/:id", (req, res) => {
    try {
      const {
        id: tileId,
        html,
        priority,
        protect,
        timeout,
        width,
        height,
      } = req.body;
      const id = tileId || req.params.id;

      const yamlLines: string[] = [];
      yamlLines.push(`id: ${id}`);
      if (priority != null) yamlLines.push(`priority: ${priority}`);
      if (protect != null) yamlLines.push(`protect: ${protect}`);
      if (timeout != null) yamlLines.push(`timeout: ${timeout}`);
      if (width != null) yamlLines.push(`width: ${width}`);
      if (height != null) yamlLines.push(`height: ${height}`);
      yamlLines.push("html: |");

      const htmlStr = html || "";
      for (const line of htmlStr.split("\n")) {
        yamlLines.push(`  ${line}`);
      }

      writeTile(tilesDir, id, yamlLines.join("\n") + "\n");
      res.json({ ok: true, id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/tiles/:id", (req, res) => {
    try {
      const ok = deleteTile(tilesDir, req.params.id);
      if (!ok) {
        res.status(404).json({ error: "Tile not found" });
        return;
      }
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.use(express.static(webDist));

  if (existsSync(tilesDir)) {
    app.use("/tiles", express.static(tilesDir));
  }

  const config = loadConfig();
  const port = config.httpPort || 3456;
  app.listen(port, () => {
    console.log(`[server] Tileboard running at http://localhost:${port}`);
    console.log(`[server] Config: ${configPath}`);
    console.log(`[server] Tiles: ${tilesDir}`);
  });
}
