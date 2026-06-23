import { Config } from "./types";

export interface PlacedTile {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  priority: number;
  protect: boolean;
}

export interface LayoutResult {
  placed: PlacedTile[];
  evicted: string[];
}

export function layout(
  tiles: { id: string; w: number; h: number; priority: number; protect: boolean }[],
  cfg: Config
): LayoutResult {
  const vw = document.documentElement.clientWidth || cfg.viewport.width;
  const vh = document.documentElement.clientHeight || cfg.viewport.height;
  const { gap, padding } = cfg.layout;

  const sorted = [...tiles].sort((a, b) => b.priority - a.priority);
  const placed: PlacedTile[] = [];
  const evicted: string[] = [];

  const occupied = new Uint8Array(vw * vh);

  function mark(x: number, y: number, w: number, h: number, val: number): void {
    const gw = w + gap;
    const gh = h + gap;
    const x1 = Math.max(0, x);
    const y1 = Math.max(0, y);
    const x2 = Math.min(vw, x + gw);
    const y2 = Math.min(vh, y + gh);
    for (let py = y1; py < y2; py++) {
      const row = py * vw;
      for (let px = x1; px < x2; px++) {
        occupied[row + px] = val;
      }
    }
  }

  function canFit(x: number, y: number, w: number, h: number): boolean {
    const gw = w + gap;
    const gh = h + gap;
    if (x < padding || y < padding) return false;
    if (x + gw > vw - padding || y + gh > vh - padding) return false;

    const x1 = Math.max(padding, x);
    const y1 = Math.max(padding, y);
    const x2 = Math.min(vw - padding, x + gw);
    const y2 = Math.min(vh - padding, y + gh);

    for (let py = y1; py < y2; py++) {
      const row = py * vw;
      for (let px = x1; px < x2; px++) {
        if (occupied[row + px]) return false;
      }
    }
    return true;
  }

  function tryPlace(tile: typeof tiles[0]): boolean {
    const { w, h } = tile;
    const step = Math.min(gap || 4, 4);

    // Strategy 1: scan grid for an empty gap that fits
    for (let y = padding; y <= vh - padding - h - gap; y += step) {
      for (let x = padding; x <= vw - padding - w - gap; x += step) {
        if (canFit(x, y, w, h)) {
          placed.push({ id: tile.id, x, y, w, h, priority: tile.priority, protect: tile.protect });
          mark(x, y, w, h, 1);
          return true;
        }
      }
    }

    // Strategy 2: try right/below existing tiles
    let bestX = Infinity;
    let bestY = Infinity;
    for (const p of placed) {
      const rx = p.x + p.w + gap;
      const ry = p.y;
      if (canFit(rx, ry, w, h) && rx < bestX) {
        bestX = rx; bestY = ry;
      }
      const bx = p.x;
      const by = p.y + p.h + gap;
      if (canFit(bx, by, w, h) && by < bestY) {
        bestX = bx; bestY = by;
      }
    }
    if (bestX !== Infinity) {
      placed.push({ id: tile.id, x: bestX, y: bestY, w, h, priority: tile.priority, protect: tile.protect });
      mark(bestX, bestY, w, h, 1);
      return true;
    }

    return false;
  }

  // Place protected tiles first (regardless of actual priority — they're forced)
  // Then try to place remaining tiles in priority order
  const normal: typeof sorted = [];

  for (const tile of sorted) {
    if (tile.protect) {
      if (!tryPlace(tile)) {
        // Protected tile can't fit — still mark as placed, overflow
        placed.push({ id: tile.id, x: padding, y: vh, w: tile.w, h: tile.h, priority: tile.priority, protect: true });
      }
    } else {
      normal.push(tile);
    }
  }

  for (const tile of normal) {
    if (!tryPlace(tile)) {
      evicted.push(tile.id);
    }
  }

  return { placed, evicted };
}
