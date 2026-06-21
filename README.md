# Tileboard

MQTT-driven tile-based dashboard with Snabbdom Virtual DOM rendering and optional PNG capture.

Tiles arrive as HTML fragments over MQTT, are rendered independently with Snabbdom, and flow-laid out into a configurable viewport. Supports static tiles, priority-based competition when viewport space is tight, and MQTT feedback.

Dual-mode: pure browser (config to localStorage) or Electron (Express config server + PNG capture).

## Architecture

```
MQTT Broker ──JSON──► tile-manager ──► per-tile snabbdom ──► DOM
                              │                    │
                        priority sort      <script> execute
                        flow layout        auto-size measure
                        eviction
                              │
                        publish feedback
```

Each tile is an independent Snabbdom instance. Content is HTML with inline `<script>` support. Tiles are sorted by `priority` (descending) and laid out in flow order. When the viewport overflows, lower-priority tiles are evicted.

## Quick Start

### Install

```bash
npm install
```

### Web mode

```bash
npx vite
```

Opens at `http://localhost:5173`. Config UI at `http://localhost:5173/config.html`.

Config is stored in `localStorage`. No PNG capture in web mode.

### Electron mode

```bash
npm run dev:electron
```

- Tileboard window opens at configured viewport size
- Express HTTP server on configured port (default `3456`)
- Config UI at `http://localhost:3456/` (default route)
- Tileboard page at `http://localhost:3456/board`
- PNG capture at `http://localhost:3456/png`
- Config stored in `config.json` file

## Configuration

See `config.json`:

```json
{
  "viewport": { "width": 1920, "height": 1080 },
  "mqtt": {
    "url": "mqtt://localhost:1883",
    "topic": "tileboard/update",
    "feedbackPrefix": "tileboard/feedback",
    "clientId": "tileboard-renderer",
    "clean": true,
    "keepalive": 60
  },
  "httpPort": 3456,
  "layout": { "gap": 8, "padding": 16 },
  "tilesDir": "tiles"
}
```

Use the config UI (`/config.html`) to edit settings without editing the file directly.

## MQTT Protocol

### Receiving tiles (broker → tileboard)

Publish to the configured topic (`tileboard/update` by default):

```json
{ "id": "sensor-1", "content": "<div>23.5°C</div>", "priority": 50, "timeout": 30 }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique tile identifier |
| `content` | string | yes | HTML fragment. Empty string `""` to delete. |
| `priority` | number | no | Higher = more important, renders on top, harder to evict. Default `0`. |
| `timeout` | number | no | Auto-remove after N seconds. `0` or absent = never. |

Content supports inline `<script>` tags. Tile scripts can access `window.mqtt` to publish/subscribe directly.

### Feedback (tileboard → broker)

After processing each tile, tileboard publishes to `tileboard/feedback/<id>`:

```json
{ "id": "sensor-1", "accepted": true, "reason": "ok" }
{ "id": "alert", "accepted": false, "reason": "viewport_full" }
{ "id": "camera", "accepted": true, "reason": "ok", "evictedTiles": ["old-sensor"] }
```

| Field | Description |
|-------|-------------|
| `accepted` | `true` if tile was placed, `false` if rejected or deleted |
| `reason` | `"ok"`, `"viewport_full"`, `"empty_content"`, `"timeout"` |
| `evictedTiles` | List of tile IDs evicted to make room (only when `accepted: true`) |

## Static Tiles

Pre-configured tiles loaded at startup from the `tiles/` directory.

```
tiles/
├── index.json          # ["clock", "hello"]
├── clock/
│   ├── tile.yaml       # id, priority, protect, timeout, width, height
│   └── tile.html       # HTML content with <style> + <script>
└── hello/
    ├── tile.yaml
    └── tile.html
```

**tile.yaml:**

```yaml
id: clock
priority: 100
protect: true       # never evicted
timeout: 0          # 0 = never expires
width: 220          # optional fixed width
height: 120         # optional fixed height
```

**tile.html:** Same HTML fragment format as MQTT content — supports `<style>`, `<script>`, anything.

`index.json` lists all tile directory names. Tiles are loaded in priority order at startup.

Static tiles participate in the same competition system as MQTT tiles. Use `protect: true` to make them immune to eviction.

## Priority & Competition

- **Z-order:** Higher priority tiles render on top
- **Layout order:** Higher priority tiles placed first in flow
- **Eviction order:** Lower priority tiles removed first when viewport overflows
- Protected tiles (`protect: true`) are never evicted, even if they overflow

## HTTP API (Electron mode only)

| Method | Route | Response |
|--------|-------|----------|
| `GET` | `/` | Config UI page |
| `GET` | `/board` | Tileboard page |
| `GET` | `/png` | `image/png` |
| `GET` | `/api/health` | `{ status, viewport, tileCount, uptime }` |
| `GET` | `/api/config` | Current config JSON |
| `POST` | `/api/config` | Save config JSON |

## Development

```
src/
├── core/                # Shared logic (web + electron)
│   ├── types.ts         # Type definitions + default config
│   ├── tile.ts          # Per-tile snabbdom instance
│   ├── tile-manager.ts  # Tile lifecycle, priority sort, competition
│   ├── layout.ts        # Flow layout engine
│   ├── mqtt.ts          # MQTT client, window.mqtt
│   ├── config-store.ts  # Config persistence abstraction
│   └── tile-loader.ts   # Static tile loading abstraction
├── tileboard/           # Tileboard page UI
│   ├── main.ts
│   └── style.css
├── config/              # Config page UI
│   ├── main.ts
│   └── style.css
└── electron/            # Electron main process
    ├── main.ts
    ├── preload.ts
    └── server.ts
```

### Build

```bash
npm run build          # web + electron
npm run build:web      # vite → dist/web/
npm run build:electron # tsc → dist/electron/
```

### Dependencies

| Package | Role |
|---------|------|
| `snabbdom` | Per-tile Virtual DOM |
| `mqtt` | MQTT client, exposed as `window.mqtt` |
| `yaml` | Parse `tile.yaml` |
| `vite` | Web bundler |
| `electron` | Desktop shell + PNG capture |
| `express` | HTTP config server + capture API |
