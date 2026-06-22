# Tileboard

MQTT-driven tiled dashboard. Tiles are HTML fragments rendered via Shadow DOM, laid out with CSS flex, and captured as PNG. Runs on Electron.

## Quick Start

```bash
npm install
npm run start          # dev mode with live reload
npm run pack           # build distributable to release/
```

Opens a window showing the board. Studio at `http://localhost:3456`, board view at `/board`, PNG capture at `/png`.

## Config

`~/.config/tileboard/config.json` (auto-created on first run from app defaults):

```json
{
  "viewport": { "width": 1920, "height": 1080 },
  "mqtt": {
    "url": "mqtt://localhost:1883",
    "topic": "tileboard/update",
    "username": "",
    "password": ""
  },
  "headless": false,
  "scale": 1,
  "httpPort": 3456
}
```

Env overrides: `TILEBOARD_MQTT_URL`, `TILEBOARD_MQTT_USERNAME`, `TILEBOARD_MQTT_PASSWORD`, `TILEBOARD_HEADLESS=true`, `TILEBOARD_HTTP_PORT`.

## MQTT Tiles

Publish to the configured topic:

```json
{ "id": "sensor-1", "content": "<div>23.5°C</div>", "priority": 50 }
{ "id": "sensor-1", "content": "" }
```

| Field | Description |
|-------|-------------|
| `id` | Unique tile ID |
| `content` | HTML with `<style>` and `<script>`. Empty string removes the tile. |
| `priority` | Higher = placed first, evicted last. Default 0. |
| `timeout` | Auto-remove after N seconds. Omit to persist. |

Content scripts run inside a Shadow DOM proxy — `document.getElementById()` only searches the tile.

Responses published to `tileboard/feedback/<id>`:
```json
{ "id": "sensor-1", "accepted": true, "reason": "ok" }
{ "id": "sensor-1", "accepted": false, "reason": "viewport_full" }
```

## Tile Studio

`http://localhost:3456` — Monaco editor for creating and editing tiles.

- Left panel lists all tiles, click to load into editor
- Right panel: HTML editor with live preview
- `Ctrl+S` saves — writes YAML to tiles directory and triggers board reload
- Export ZIP downloads all tiles

## PNG Capture

`GET http://localhost:3456/png` → `image/png` of the current board.

## Static Tiles

`~/.config/tileboard/tiles/*.yaml` are loaded at startup. Same format as MQTT, one file per tile:

```yaml
id: clock
priority: 100
protect: true       # never evicted
html: |
  <style>.c{font-size:42px}</style>
  <div class="c" id="t"></div>
  <script>setInterval(function(){document.getElementById("t").textContent=new Date().toLocaleTimeString()},1000)</script>
```

## Health & API

| Route | Description |
|-------|-------------|
| `GET /png` | Board screenshot (PNG) |
| `GET /api/health` | `{ status, viewport, uptime }` |
| `GET /api/config` | Read config |
| `POST /api/config` | Save config |

## Docker / K8s

```bash
docker build -t tileboard .
docker run -p 3456:3456 -e TILEBOARD_MQTT_URL=mqtt://broker:1883 -e TILEBOARD_HEADLESS=true -v /data/tiles:/data/tiles tileboard
```

See `k8s/` for deployment manifests.
