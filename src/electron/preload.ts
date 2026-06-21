import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("tileboard", {
  isElectron: true,
});
