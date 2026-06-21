import { TileDef, Config, FeedbackMessage } from "./types";
import { TileInstance, createTile } from "./tile";
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
        publishFeedback(this.cfg, tileDef.id, {
          id: tileDef.id,
          accepted: false,
          reason: "empty_content",
        });
      }
      return;
    }

    const existing = this.tiles.get(tileDef.id);
    if (existing) {
      existing.update(tileDef);
      existing.elm.style.order = String(-tileDef.priority);
    } else {
      const tile = createTile(tileDef, this.container);
      this.tiles.set(tileDef.id, tile);
    }

    if (tileDef.timeout > 0) {
      this.setTimeout(tileDef.id, tileDef.timeout);
    }

    this.scheduleEviction(tileDef.id);
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
    this.scheduleEviction();
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
        existing.elm.style.order = String(-def.priority);
      } else {
        const tile = createTile(def, this.container);
        this.tiles.set(def.id, tile);
      }
      if (def.timeout > 0) {
        this.setTimeout(def.id, def.timeout);
      }
    }

    this.scheduleEviction();
  }

  private pendingEviction = false;
  private sourceId: string | null = null;

  private scheduleEviction(sourceId?: string): void {
    if (sourceId) this.sourceId = sourceId;
    if (this.pendingEviction) return;
    this.pendingEviction = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.pendingEviction = false;
        this.doEviction(this.sourceId || undefined);
        this.sourceId = null;
      });
    });
  }

  private doEviction(sourceId?: string): void {
    const sortedTiles = this.getSortedTiles();
    const evictedIds: string[] = [];

    while (this.isOverflowing()) {
      const victim = this.findEvictionCandidate(sortedTiles);
      if (!victim) break;
      victim.elm.style.display = "none";
      evictedIds.push(victim.id);
    }

    if (sourceId) {
      if (evictedIds.includes(sourceId)) {
        this.destroyTile(sourceId);
        publishFeedback(this.cfg, sourceId, {
          id: sourceId,
          accepted: false,
          reason: "viewport_full",
        });
      } else {
        const others = evictedIds.filter((id) => id !== sourceId);
        for (const id of others) this.destroyTile(id);
        publishFeedback(this.cfg, sourceId, {
          id: sourceId,
          accepted: true,
          reason: "ok",
          evictedTiles: others.length > 0 ? others : undefined,
        });
      }
    }
  }

  private isOverflowing(): boolean {
    return false;
    // return this.container.scrollHeight > this.container.clientHeight ||
    //        this.container.scrollWidth > this.container.clientWidth;
  }

  private getSortedTiles(): TileInstance[] {
    const arr = Array.from(this.tiles.values());
    arr.sort((a, b) => a.def.priority - b.def.priority);
    return arr;
  }

  private findEvictionCandidate(
    sortedByPriorityAsc: TileInstance[],
  ): TileInstance | null {
    for (const tile of sortedByPriorityAsc) {
      if (!tile.def.protect && tile.elm.style.display !== "none") {
        return tile;
      }
    }
    return null;
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
      publishFeedback(this.cfg, tileId, {
        id: tileId,
        accepted: false,
        reason: "timeout",
      });
      this.scheduleEviction();
    }, seconds * 1000);
  }
}
