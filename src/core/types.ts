export interface TileDef {
  id: string;
  content: string;
  priority: number;
  protect: boolean;
  timeout: number;
  source: "static" | "mqtt";
  width?: number;
  height?: number;
}

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileState {
  def: TileDef;
  placed: boolean;
  rect: TileRect | null;
}

export interface Config {
  viewport: { width: number; height: number };
  mqtt: {
    url: string;
    topic: string;
    feedbackPrefix: string;
    clientId: string;
    clean: boolean;
    keepalive: number;
    username?: string;
    password?: string;
  };
  headless: boolean;
  httpPort: number;
  layout: { gap: number; padding: number };
  tilesDir: string;
  scale: number;
}

export interface MqttTileMessage {
  id: string;
  content: string;
  priority?: number;
  timeout?: number;
}

export interface FeedbackMessage {
  id: string;
  accepted: boolean;
  reason: string;
  evictedTiles?: string[];
}

export interface TileUpdatePayload {
  id: string;
  html: string;
  priority: number;
  protect: boolean;
  timeout: number;
  width?: number;
  height?: number;
}

export interface TileListItem {
  id: string;
  priority: number;
  protect: boolean;
  timeout: number;
  width?: number;
  height?: number;
}

export const DEFAULT_CONFIG: Config = {
  viewport: { width: 1920, height: 1080 },
  mqtt: {
    url: "mqtt://localhost:1883",
    topic: "tileboard/update",
    feedbackPrefix: "tileboard/feedback",
    clientId: "tileboard-" + Math.random().toString(16).slice(2, 10),
    clean: true,
    keepalive: 60,
    username: undefined,
    password: undefined,
  },
  headless: false,
  httpPort: 3456,
  layout: { gap: 8, padding: 16 },
  tilesDir: "tiles",
  scale: 1,
};
