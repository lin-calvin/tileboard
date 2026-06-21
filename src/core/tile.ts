import { TileDef, TileRect } from "./types";

export interface TileInstance {
  id: string;
  def: TileDef;
  elm: HTMLElement;
  getRect(): TileRect;
  update(def: TileDef): void;
  destroy(): void;
}

function executeScripts(root: ShadowRoot): void {
  const scripts = root.querySelectorAll("script");
  scripts.forEach((old) => {
    const code = old.textContent || "";
    const script = document.createElement("script");
    for (let i = 0; i < old.attributes.length; i++) {
      script.setAttribute(old.attributes[i].name, old.attributes[i].value);
    }
    script.textContent = `(function(document){${code}\n})(window.__tileDoc);`;
    old.replaceWith(script);
  });
}

function createShadowDocument(shadow: ShadowRoot): Document {
  return new Proxy(document, {
    get(_target, prop) {
      if (prop === "getElementById") {
        return (id: string) => shadow.querySelector(`#${CSS.escape(id)}`);
      }
      if (prop === "querySelector") {
        return (sel: string) => shadow.querySelector(sel);
      }
      if (prop === "querySelectorAll") {
        return (sel: string) => shadow.querySelectorAll(sel);
      }
      if (prop === "getElementsByClassName") {
        return (cls: string) => shadow.querySelectorAll(`.${CSS.escape(cls)}`);
      }
      if (prop === "getElementsByTagName") {
        return (tag: string) => shadow.querySelectorAll(tag);
      }
      if (prop === "body") {
        return shadow;
      }
      if (prop === "documentElement") {
        return shadow;
      }
      const value = (document as any)[prop];
      if (typeof value === "function") return value.bind(document);
      return value;
    },
  }) as unknown as Document;
}

export function createTile(def: TileDef, container: HTMLElement): TileInstance {
  const elm = document.createElement("div");
  elm.className = "tile";
  elm.style.order = String(-def.priority);
  container.appendChild(elm);

  const shadow = elm.attachShadow({ mode: "open" });
  const tileDoc = createShadowDocument(shadow);

  function execScripts(): void {
    (window as any).__tileDoc = tileDoc;
    executeScripts(shadow);
  }

  elm.style.width = def.width ? `${def.width}px` : "";
  elm.style.height = def.height ? `${def.height}px` : "";

  shadow.innerHTML = def.content;
  execScripts();

  const instance: TileInstance = {
    id: def.id,
    def,

    get elm() { return elm; },

    getRect(): TileRect {
      const rect = elm.getBoundingClientRect();
      const parentRect = elm.parentElement!.getBoundingClientRect();
      return {
        x: rect.left - parentRect.left,
        y: rect.top - parentRect.top,
        w: rect.width,
        h: rect.height,
      };
    },

    update(newDef: TileDef): void {
      this.def = newDef;
      shadow.innerHTML = newDef.content;
      execScripts();

      elm.style.width = newDef.width ? `${newDef.width}px` : "";
      elm.style.height = newDef.height ? `${newDef.height}px` : "";
    },

    destroy(): void {
      elm.remove();
    },
  };

  return instance;
}
