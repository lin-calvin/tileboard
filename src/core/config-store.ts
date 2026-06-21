import { Config, DEFAULT_CONFIG } from "./types";

const STORAGE_KEY = "tileboard-config";

function deepMerge(base: any, override: any): any {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const v = override[key];
    if (v && typeof v === "object" && !Array.isArray(v) && typeof base[key] === "object") {
      result[key] = deepMerge(base[key], v);
    } else {
      result[key] = v;
    }
  }
  return result;
}

export interface ConfigStore {
  load(): Promise<Config>;
  save(config: Config): Promise<void>;
}

export function createLocalStore(): ConfigStore {
  return {
    async load(): Promise<Config> {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          return deepMerge(DEFAULT_CONFIG, JSON.parse(raw)) as Config;
        }
      } catch (e) {
        console.warn("[config] Failed to load config from localStorage", e);
      }
      return { ...DEFAULT_CONFIG };
    },
    async save(config: Config): Promise<void> {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    },
  };
}

export function createApiStore(baseUrl: string = ""): ConfigStore {
  return {
    async load(): Promise<Config> {
      const res = await fetch(`${baseUrl}/api/config`);
      if (!res.ok) throw new Error(`Failed to load config: ${res.status}`);
      const data = await res.json();
      return deepMerge(DEFAULT_CONFIG, data) as Config;
    },
    async save(config: Config): Promise<void> {
      const res = await fetch(`${baseUrl}/api/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`Failed to save config: ${res.status}`);
    },
  };
}
