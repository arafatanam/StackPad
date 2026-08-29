const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  loadAllNotes: () => ipcRenderer.invoke("notes:load-all"),
  saveIndex: (data) => ipcRenderer.invoke("notes:save-index", data),
  saveDraft: (id, content) =>
    ipcRenderer.invoke("notes:save-draft", { id, content }),
  deleteNote: (id) => ipcRenderer.invoke("notes:delete-note", id),

  openFile: () => ipcRenderer.invoke("dialog:open-file"),
  saveFileAs: (defaultName, content) =>
    ipcRenderer.invoke("dialog:save-file-as", { defaultName, content }),
  saveFile: (filePath, content) =>
    ipcRenderer.invoke("file:save", { filePath, content }),
  setWindowRatio: (ratio) => ipcRenderer.invoke("window:set-ratio", ratio),
  print: () => ipcRenderer.invoke("app:print"),

  onMenuAction: (callback) =>
    ipcRenderer.on("menu-action", (event, data) => callback(data)),
});
