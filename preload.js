const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("api", {
  platform: process.platform,
  triggerMenuAction: (action, payload) =>
    ipcRenderer.send("menu:action", { action, payload }),
  editAction: (action) => ipcRenderer.send("edit:action", action),
  setTitleBarTheme: (dark) => ipcRenderer.send("window:titlebar-theme", dark),
  appReady: () => ipcRenderer.send("app:ready"),

  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (partial) => ipcRenderer.send("settings:update", partial),

  loadAllNotes: () => ipcRenderer.invoke("notes:load-all"),
  saveIndex: (data) => ipcRenderer.invoke("notes:save-index", data),
  saveDraft: (id, content) =>
    ipcRenderer.invoke("notes:save-draft", { id, content }),
  flushSync: (data) => ipcRenderer.sendSync("notes:flush-sync", data),
  deleteNote: (id) => ipcRenderer.invoke("notes:delete-note", id),

  openFile: () => ipcRenderer.invoke("dialog:open-file"),
  openPaths: (paths) => ipcRenderer.invoke("files:open-paths", paths),
  takePendingFiles: () => ipcRenderer.invoke("files:take-pending"),
  getPathForFile: (file) =>
    webUtils ? webUtils.getPathForFile(file) : file.path,
  saveFileAs: (data) => ipcRenderer.invoke("dialog:save-file-as", data),
  saveFile: (data) => ipcRenderer.invoke("file:save", data),
  setWindowRatio: (ratio) => ipcRenderer.invoke("window:set-ratio", ratio),
  print: () => ipcRenderer.invoke("app:print"),
  checkFiles: (entries) => ipcRenderer.invoke("files:check", entries),

  openLink: (name) => ipcRenderer.send("app:open-link", name),
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdateDownloaded: (callback) =>
    ipcRenderer.on("update-downloaded", (event, info) => callback(info)),
  onUpdateAvailable: (callback) =>
    ipcRenderer.on("update-available", (event, info) => callback(info)),
  onWindowFocused: (callback) => ipcRenderer.on("window-focused", () => callback()),

  onMenuAction: (callback) =>
    ipcRenderer.on("menu-action", (event, data) => callback(data)),
  onOpenFiles: (callback) =>
    ipcRenderer.on("open-files", (event, files) => callback(files)),
  onRatioChanged: (callback) =>
    ipcRenderer.on("ratio-changed", (event, ratio) => callback(ratio)),
});
