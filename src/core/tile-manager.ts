import { TileDef, Config, FeedbackMessage } from "./types";
import { TileInstance, createTile } from "./tile";
import { layout } from "./layout";
import { publishFeedback } from "./mqtt";

export class TileManager {
  private tiles = new Map<string, TileInstance>();
  private container: HTMLElement;
  private cfg: Config;

  constructor(container: HTMLElement, cfg: Config) {
    this.container = container;
    this.cfg = cfg;
  }

  updateConfig(cfg: Config): void {
    this.cfg = cfg;
  }

  getTileCount(): number {
    return this.tiles.size;
  }

  getPlacedCount(): number {
    let count = 0;
    this.tiles.forEach((t) => {
      if (t.elm.style.display !== "none") count++;
    });
    return count;
  }

  handleTileDef(tileDef: TileDef): void {
    if (tileDef.content === "") {
      const existing = this.tiles.get(tileDef.id);
      if (existing) {
        this.destroyTile(tileDef.id);
        publishFeedback(this.cfg, tileDef.id, { id: tileDef.id, accepted: false, reason: "empty_content" });
      }
      return;
    }

    const existing = this.tiles.get(tileDef.id);
    if (existing) {
      existing.update(tileDef);
    } else {
      const tile = createTile(tileDef, this.container);
      this.tiles.set(tileDef.id, tile);
    }

    if (tileDef.timeout > 0) {
      this.setTimeout(tileDef.id, tileDef.timeout);
    }

    this.scheduleLayout(tileDef.id);
  }

  loadInitial(tileDefs: TileDef[]): void {
    for (const def of tileDefs) {
      if (this.tiles.has(def.id)) continue;
      const tile = createTile(def, this.container);
      this.tiles.set(def.id, tile);
      if (def.timeout > 0) {
        this.setTimeout(def.id, def.timeout);
      }
    }
    this.scheduleLayout();
  }

  async reloadStaticTiles(tileDefs: TileDef[]): Promise<void> {
    const staticIds = new Set<string>();
    for (const def of tileDefs) staticIds.add(def.id);

    for (const [id, tile] of this.tiles) {
      if (tile.def.source === "static" && !staticIds.has(id)) {
        this.destroyTile(id);
      }
    }

    for (const def of tileDefs) {
      const existing = this.tiles.get(def.id);
      if (existing) {
        existing.update(def);
      } else {
        const tile = createTile(def, this.container);
        this.tiles.set(def.id, tile);
      }
      if (def.timeout > 0) {
        this.setTimeout(def.id, def.timeout);
      }
    }

    this.scheduleLayout();
  }

  private pendingLayout = false;
  private sourceId: string | null = null;

  private scheduleLayout(sourceId?: string): void {
    if (sourceId) this.sourceId = sourceId;
    if (this.pendingLayout) return;
    this.pendingLayout = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.pendingLayout = false;
        this.doLayout(this.sourceId || undefined);
        this.sourceId = null;
      });
    });
  }

  private doLayout(sourceId?: string): void {
    const tileData = Array.from(this.tiles.values()).map((t) => {
      const rect = t.getRect();
      return {
        id: t.id,
        w: t.def.width || Math.max(Math.round(rect.w), 1),
        h: t.def.height || Math.max(Math.round(rect.h), 1),
        priority: t.def.priority,
        protect: t.def.protect,
      };
    });

    const result = layout(tileData, this.cfg);

    const placedIds = new Set(result.placed.map((p) => p.id));

    for (const p of result.placed) {
      const tile = this.tiles.get(p.id);
      if (!tile) continue;
      tile.elm.style.display = "";
      tile.elm.style.left = `${p.x}px`;
      tile.elm.style.top = `${p.y}px`;
      tile.elm.style.width = p.w ? `${p.w}px` : "";
      tile.elm.style.height = p.h ? `${p.h}px` : "";
    }

    for (const id of result.evicted) {
      const tile = this.tiles.get(id);
      if (!tile) continue;
      tile.elm.style.display = "none";
    }

    if (sourceId) {
      if (result.evicted.includes(sourceId)) {
        this.destroyTile(sourceId);
        publishFeedback(this.cfg, sourceId, { id: sourceId, accepted: false, reason: "viewport_full" });
      } else {
        const others = result.evicted.filter((id) => id !== sourceId);
        for (const id of others) this.destroyTile(id);
        publishFeedback(this.cfg, sourceId, {
          id: sourceId,
          accepted: true,
          reason: "ok",
          evictedTiles: others.length > 0 ? others : undefined,
        });
      }
    } else {
      for (const id of result.evicted) {
        this.destroyTile(id);
      }
    }
  }

  private destroyTile(id: string): void {
    const tile = this.tiles.get(id);
    if (!tile) return;
    tile.destroy();
    this.tiles.delete(id);
  }

  private setTimeout(tileId: string, seconds: number): void {
    const tile = this.tiles.get(tileId);
    if (!tile) return;
    if ((tile as any).timer) {
      clearTimeout((tile as any).timer);
    }
    (tile as any).timer = setTimeout(() => {
      this.destroyTile(tileId);
      publishFeedback(this.cfg, tileId, { id: tileId, accepted: false, reason: "timeout" });
      this.scheduleLayout();
    }, seconds * 1000);
  }
}
