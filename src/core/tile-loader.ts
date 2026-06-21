import * as YAML from "yaml";
import { TileDef } from "./types";

export interface TileLoader {
  loadStaticTiles(tilesDir: string): Promise<TileDef[]>;
}

interface YamlTile {
  id: string;
  priority?: number;
  protect?: boolean;
  timeout?: number;
  width?: number;
  height?: number;
  html?: string;
}

async function parseTileYaml(yamlRaw: string, tileId: string, getHtmlFallback?: () => Promise<string>): Promise<TileDef | null> {
  try {
    const yamlData: YamlTile = YAML.parse(yamlRaw);
    let content: string;

    if (yamlData.html) {
      content = yamlData.html;
    } else if (getHtmlFallback) {
      content = await getHtmlFallback();
    } else {
      return null;
    }

    return {
      id: yamlData.id || tileId,
      content,
      priority: yamlData.priority ?? 0,
      protect: yamlData.protect ?? false,
      timeout: yamlData.timeout ?? 0,
      source: "static",
      width: yamlData.width,
      height: yamlData.height,
    };
  } catch (e) {
    console.warn(`[tiles] Failed to parse YAML for ${tileId}:`, e);
    return null;
  }
}

export function createFetchTileLoader(): TileLoader {
  return {
    async loadStaticTiles(tilesDir: string): Promise<TileDef[]> {
      const tiles: TileDef[] = [];

      try {
        const indexRes = await fetch(`${tilesDir}/index.json`);
        if (indexRes.ok) {
          const ids: string[] = await indexRes.json();
          for (const id of ids) {
            try {
              const yamlRes = await fetch(`${tilesDir}/${id}/tile.yaml`);
              if (!yamlRes.ok) continue;
              const yamlRaw = await yamlRes.text();

              const tile = await parseTileYaml(yamlRaw, id, async () => {
                const htmlRes = await fetch(`${tilesDir}/${id}/tile.html`);
                if (!htmlRes.ok) throw new Error("No HTML found");
                return htmlRes.text();
              });

              if (tile) tiles.push(tile);
            } catch (e) {
              console.warn(`[tiles] Failed to load tile ${id}:`, e);
            }
          }
          tiles.sort((a, b) => b.priority - a.priority);
          return tiles;
        }
      } catch {}

      try {
        const listRes = await fetch(`/api/tiles`);
        if (!listRes.ok) return [];
        const items: { id: string }[] = await listRes.json();

        for (const item of items) {
          try {
            const tileRes = await fetch(`/api/tiles/${item.id}`);
            if (!tileRes.ok) continue;
            const yamlRaw = await tileRes.text();
            const tile = await parseTileYaml(yamlRaw, item.id);
            if (tile) tiles.push(tile);
          } catch (e) {
            console.warn(`[tiles] Failed to load tile ${item.id}:`, e);
          }
        }

        tiles.sort((a, b) => b.priority - a.priority);
        return tiles;
      } catch {
        console.warn("[tiles] No tiles directory or API available");
        return [];
      }
    },
  };
}
