const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  dialog,
  screen,
} = require("electron");
const path = require("path");
const fs = require("fs");

const userDataPath = () => app.getPath("userData");
const draftsDir = () => path.join(userDataPath(), "drafts");
const indexFile = () => path.join(userDataPath(), "notes-index.json");

function ensureDraftsDir() {
  if (!fs.existsSync(draftsDir())) {
    fs.mkdirSync(draftsDir(), { recursive: true });
  }
}

function readIndex() {
  try {
    const raw = fs.readFileSync(indexFile(), "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeIndex(data) {
  fs.writeFileSync(indexFile(), JSON.stringify(data, null, 2), "utf-8");
}

function readDraft(id) {
  const p = path.join(draftsDir(), `${id}.txt`);
  try {
    return fs.readFileSync(p, "utf-8");
  } catch (e) {
    return null;
  }
}

function writeDraft(id, content) {
  ensureDraftsDir();
  fs.writeFileSync(path.join(draftsDir(), `${id}.txt`), content, "utf-8");
}

function deleteDraft(id) {
  const p = path.join(draftsDir(), `${id}.txt`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

let mainWindow;

if (process.platform === "win32") {
  app.setAppUserModelId("com.stackpad.app");
}

function sendMenuAction(action, payload) {
  if (mainWindow)
    mainWindow.webContents.send("menu-action", { action, payload });
}

function buildMenu() {
  const isMac = process.platform === "darwin";

  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Tab",
          accelerator: "CmdOrCtrl+N",
          click: () => sendMenuAction("new-tab"),
        },
        {
          label: "Open...",
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuAction("open"),
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenuAction("save"),
        },
        {
          label: "Save As...",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendMenuAction("save-as"),
        },
        { type: "separator" },
        {
          label: "Print...",
          accelerator: "CmdOrCtrl+P",
          click: () => sendMenuAction("print"),
        },
        { type: "separator" },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => sendMenuAction("close-tab"),
        },
        isMac
          ? { role: "close" }
          : { label: "Exit", accelerator: "Alt+F4", click: () => app.quit() },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "delete" },
        { type: "separator" },
        {
          label: "Find...",
          accelerator: "CmdOrCtrl+F",
          click: () => sendMenuAction("find"),
        },
        {
          label: "Find Next",
          accelerator: "F3",
          click: () => sendMenuAction("find-next"),
        },
        {
          label: "Replace...",
          accelerator: "CmdOrCtrl+H",
          click: () => sendMenuAction("replace"),
        },
        {
          label: "Go To...",
          accelerator: "CmdOrCtrl+G",
          click: () => sendMenuAction("go-to"),
        },
        { type: "separator" },
        { role: "selectAll" },
        {
          label: "Time/Date",
          accelerator: "F5",
          click: () => sendMenuAction("time-date"),
        },
      ],
    },
    {
      label: "Format",
      submenu: [
        {
          label: "Word Wrap",
          type: "checkbox",
          checked: true,
          click: (item) => sendMenuAction("word-wrap", item.checked),
        },
        { type: "separator" },
        { label: "Font...", click: () => sendMenuAction("font") },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Zoom",
          submenu: [
            {
              label: "Zoom In",
              accelerator: "CmdOrCtrl+Plus",
              click: () => sendMenuAction("zoom-in"),
            },
            {
              label: "Zoom Out",
              accelerator: "CmdOrCtrl+-",
              click: () => sendMenuAction("zoom-out"),
            },
            {
              label: "Restore Default Zoom",
              accelerator: "CmdOrCtrl+0",
              click: () => sendMenuAction("zoom-reset"),
            },
          ],
        },
        {
          label: "Status Bar",
          type: "checkbox",
          checked: true,
          click: (item) => sendMenuAction("status-bar", item.checked),
        },
        { type: "separator" },
        {
          label: "Theme",
          submenu: [
            { label: "Light", click: () => sendMenuAction("theme-light") },
            { label: "Dark", click: () => sendMenuAction("theme-dark") },
            {
              label: "Use System Settings",
              click: () => sendMenuAction("theme-system"),
            },
          ],
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1100, Math.max(720, Math.round(screenWidth * 0.75))),
    height: Math.min(720, Math.max(520, Math.round(screenHeight * 0.75))),
    minWidth: 360,
    minHeight: 260,
    title: "StackPad",
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
  buildMenu();
}

app.whenReady().then(() => {
  ensureDraftsDir();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---- IPC: persistence ----

ipcMain.handle("notes:load-all", () => {
  const index = readIndex();
  return index.map((entry) => {
    const draft = readDraft(entry.id);
    let content = draft;
    if (content === null && entry.filePath) {
      try {
        content = fs.readFileSync(entry.filePath, "utf-8");
      } catch (e) {
        content = "";
      }
    }
    if (content === null) content = "";
    return { ...entry, content };
  });
});

ipcMain.handle("notes:save-index", (event, data) => {
  writeIndex(data);
  return true;
});

ipcMain.handle("notes:save-draft", (event, { id, content }) => {
  writeDraft(id, content);
  return true;
});

ipcMain.handle("notes:delete-note", (event, id) => {
  deleteDraft(id);
  return true;
});

// ---- IPC: real file dialogs ----

ipcMain.handle("dialog:open-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Text Documents", extensions: ["txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, "utf-8");
  return {
    filePath,
    content,
    name: path.basename(filePath, path.extname(filePath)),
  };
});

ipcMain.handle(
  "dialog:save-file-as",
  async (event, { defaultName, content }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${defaultName || "Untitled"}.txt`,
      filters: [
        { name: "Text Documents", extensions: ["txt"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, content, "utf-8");
    return {
      filePath: result.filePath,
      name: path.basename(result.filePath, path.extname(result.filePath)),
    };
  },
);

ipcMain.handle("file:save", (event, { filePath, content }) => {
  fs.writeFileSync(filePath, content, "utf-8");
  return true;
});

ipcMain.handle("window:set-ratio", (event, ratio) => {
  if (!mainWindow) return false;

  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;
  const ratioPercent = ratio === "4:5" ? 0.8 : 0.75;
  const maxWidth = Math.max(360, Math.round(screenWidth * ratioPercent));
  const maxHeight = Math.max(260, Math.round(screenHeight * ratioPercent));

  let nextWidth = maxWidth;
  let nextHeight = Math.round(nextWidth / (ratio === "4:5" ? 4 / 5 : 16 / 9));

  if (nextHeight > maxHeight) {
    nextHeight = maxHeight;
    nextWidth = Math.round(nextHeight * (ratio === "4:5" ? 4 / 5 : 16 / 9));
  }

  const finalWidth = Math.min(nextWidth, screenWidth - 40);
  const finalHeight = Math.min(nextHeight, screenHeight - 40);

  mainWindow.setSize(finalWidth, finalHeight, true);
  mainWindow.center();
  return true;
});

ipcMain.handle("app:print", () => {
  if (mainWindow) mainWindow.webContents.print({ silent: false });
  return true;
});
