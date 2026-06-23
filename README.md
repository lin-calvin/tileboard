# 🧩 Tileboard

![](docs/show.jpeg)

**Build your own live dashboard via html, and display it on any devices that can display a png image**

Tileboard is a lightweight, MQTT‑driven dashboard where every tile is a tiny web page.
---

## ✨ Features

- **Dynamic tiles** – add, update, or remove tiles via MQTT messages
- **Live preview** – built‑in Monaco editor with instant preview
- **Priority & eviction** – set priority and auto‑timeout to manage screen space
- **Static tiles** – load YAML files on startup for permanent tiles
- **Kindle support** – turn your e‑reader into a low‑power display
- **Shows anywhere** -- any devices that shows png files can turn into a multi-functional dashboard

---

## 🚀 Quick Start

1. **Download** the AppImage and run:
   
   `./Tileboard.AppImage --headless`

2. **Open** your browser at `http://SERVER_IP:3456/`

3. **Start building** – use the Tile Studio to create your first tile.

4. **Connecting** – Configure your display to show the dashboard

---

## ⚙️ Configuration

On first run, Tileboard creates `~/.config/tileboard/config.json`. You can tweak these settings:

| Option                   | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `viewport.width/height`  | Board resolution in pixels                      |
| `mqtt.url`               | MQTT broker URL (e.g., `mqtt://localhost:1883`) |
| `mqtt.topic`             | Topic to listen for tile updates                |
| `mqtt.username/password` | Optional credentials                            |
| `headless`               | Run without UI (set to `true` for servers)      |
| `scale`                  | Render scale factor                             |
| `httpPort`               | Port for the web interface                      |

Environment variables override the config:  
`TILEBOARD_MQTT_URL`, `TILEBOARD_MQTT_USERNAME`, `TILEBOARD_MQTT_PASSWORD`, `TILEBOARD_HEADLESS=true`, `TILEBOARD_HTTP_PORT`.

---

## 📡 Dynamic Tiles via MQTT

Publish a JSON message to the configured MQTT topic (default `tileboard/update`):

{ "id": "sensor-1", "content": "<div>23.5°C</div>", "priority": 50 }

| Field      | Description                                                                        |
| ---------- | ---------------------------------------------------------------------------------- |
| `id`       | Unique tile identifier                                                             |
| `content`  | HTML string (can include `<style>` and `<script>`). Empty string removes the tile. |
| `priority` | Higher values place the tile first and evict it last. Default `0`.                 |
| `timeout`  | Auto‑remove after N seconds. Omit to keep it indefinitely.                         |

**Important:** scripts inside the tile run in a Shadow DOM proxy – `document.getElementById()` only searches within that tile.

Tileboard replies on `tileboard/feedback/<id>` with:

{ "id": "sensor-1", "accepted": true, "reason": "ok" }
{ "id": "sensor-1", "accepted": false, "reason": "viewport_full" }

---

## 🖥️ Tile Studio

Visit `http://localhost:3456` – you'll find a full‑featured Monaco editor.

- **Left panel** – lists all active tiles; click one to edit
- **Right panel** – HTML editor with live preview (update as you type)
- **Ctrl+S** – saves the tile as a YAML file in `~/.config/tileboard/tiles/` and reloads the board
- **Export ZIP** – downloads all tiles as a compressed archive

---

## 📂 Static Tiles (Startup)

Place YAML files in `~/.config/tileboard/tiles/*.yaml` – they load automatically at startup.  
Format is the same as MQTT messages, but with an extra `protect` flag:

id: clock
priority: 100
protect: true       # never evicted
html: |
  <style>.c{font-size:42px}</style>
  <div class="c" id="t"></div>
  <script>setInterval(function(){document.getElementById("t").textContent=new Date().toLocaleTimeString()},1000)</script>

---

## 📖 Kindle Integration

Turn your Kindle into an always‑on dashboard – see [kindle/README.md](kindle/README.md) for step‑by‑step instructions.

---

## 🔧 Advanced Tips

- **Scaling** – adjust `scale` in config to fit high‑DPI screens
- **Headless operation** – perfect for Raspberry Pi, just set `"headless": true`
- **Security** – use MQTT with TLS or username/password; the HTTP server is minimal – consider putting it behind a reverse proxy if exposed to the internet

---

## 🤝 Contributing

Issues and pull requests are welcome!  
Feel free to open a discussion if you have ideas for new features.

---

## 📄 License

MIT – use it anywhere, modify it freely.
