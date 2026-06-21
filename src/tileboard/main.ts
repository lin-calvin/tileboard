import { connectMqtt, onTileMessage, disconnectMqtt } from "../core/mqtt";
import { TileManager } from "../core/tile-manager";
import { createLocalStore, createApiStore, ConfigStore } from "../core/config-store";
import { createFetchTileLoader } from "../core/tile-loader";
import { Config, MqttTileMessage } from "../core/types";

let manager: TileManager | null = null;
let configStore: ConfigStore;

const isElectron = !!(window as any).tileboard?.isElectron;
configStore = isElectron ? createApiStore() : createLocalStore();

const board = document.getElementById("board")!;

async function start(): Promise<void> {
  const cfg: Config = await configStore.load();

//  board.style.width = `${cfg.viewport.width}px`;
//  board.style.height = `${cfg.viewport.height}px`;
  board.style.gap = `${cfg.layout.gap}px`;
  board.style.padding = `${cfg.layout.padding}px`;

  manager = new TileManager(board, cfg);
  (window as any).tileManager = manager;

  const tileLoader = createFetchTileLoader();
  const staticTiles = await tileLoader.loadStaticTiles("tiles");
  console.log(`[tileboard] Loaded ${staticTiles.length} static tiles`);
  manager.loadInitial(staticTiles);

  (window as any).__tileboardReload = async () => {
    try {
      if (!manager) return;
      const tileLoader = createFetchTileLoader();
      const staticTiles = await tileLoader.loadStaticTiles(cfg.tilesDir);
      console.log(`[tileboard] Reloaded ${staticTiles.length} static tiles`);
      await manager.reloadStaticTiles(staticTiles);
    } catch (e) {
      console.error("[tileboard] Reload failed:", e);
    }
  };

  connectMqtt(cfg);

  onTileMessage((msg: MqttTileMessage) => {
    if (!manager) return;
    manager.handleTileDef({
      id: msg.id,
      content: msg.content,
      priority: msg.priority ?? 0,
      protect: false,
      timeout: msg.timeout ?? 0,
      source: "mqtt",
    });
  });
}

start().catch((err) => {
  console.error("[tileboard] Failed to start:", err);
  board.textContent = `Error: ${err.message}`;
});
