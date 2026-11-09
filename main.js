const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  dialog,
  screen,
  nativeTheme,
} = require("electron");
const path = require("path");
const fs = require("fs");

const userDataPath = () => app.getPath("userData");
const draftsDir = () => path.join(userDataPath(), "drafts");
const indexFile = () => path.join(userDataPath(), "notes-index.json");
const settingsFile = () => path.join(userDataPath(), "settings.json");

const RATIOS = { "4:5": 4 / 5, "16:9": 16 / 9 };
const DEFAULT_SETTINGS = {
  theme: "system",
  fontFamily: "'Consolas', 'Courier New', monospace",
  fontSize: 14,
  zoom: 100,
  wordWrap: true,
  statusBar: true,
  ratio: "4:5",
  bounds: null,
  maximized: false,
  groups: [],
};

// ---- Storage helpers ----

// Write to a temp file and rename it over the target, so a crash mid-write
// can never leave a half-written index, draft or settings file behind.
function writeFileAtomic(filePath, data) {
  const tmp = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmp, data, "utf-8");
    fs.renameSync(tmp, filePath);
  } catch (e) {
    fs.writeFileSync(filePath, data, "utf-8");
  }
}

function ensureDraftsDir() {
  if (!fs.existsSync(draftsDir())) {
    fs.mkdirSync(draftsDir(), { recursive: true });
  }
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    return fallback;
  }
}

function readIndex() {
  const index = readJson(indexFile(), []);
  return Array.isArray(index) ? index : [];
}

function writeIndex(data) {
  writeFileAtomic(indexFile(), JSON.stringify(data, null, 2));
}

function draftPath(id) {
  if (typeof id !== "string" || !/^[\w-]+$/.test(id)) return null;
  return path.join(draftsDir(), `${id}.txt`);
}

function readDraft(id) {
  const p = draftPath(id);
  if (!p) return null;
  try {
    return fs.readFileSync(p, "utf-8");
  } catch (e) {
    return null;
  }
}

function writeDraft(id, content) {
  const p = draftPath(id);
  if (!p) return;
  ensureDraftsDir();
  writeFileAtomic(p, content);
}

function deleteDraft(id) {
  const p = draftPath(id);
  if (p && fs.existsSync(p)) fs.unlinkSync(p);
}

let settings = { ...DEFAULT_SETTINGS };

function loadSettings() {
  settings = { ...DEFAULT_SETTINGS, ...readJson(settingsFile(), {}) };
}

function saveSettings() {
  try {
    writeFileAtomic(settingsFile(), JSON.stringify(settings, null, 2));
  } catch (e) {
    // Settings are a convenience; never block the app over them.
  }
}

// ---- Text files: encoding and line endings ----
//
// The editor always works with "\n" line endings and plain JS strings. Each
// file remembers the encoding and line-ending style it was opened with, and
// is written back the same way, so saving never silently converts it.

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
let cp1252Reverse = null;

function getCp1252Reverse() {
  if (!cp1252Reverse) {
    cp1252Reverse = new Map();
    const decoder = new TextDecoder("windows-1252");
    for (let byte = 0x80; byte <= 0x9f; byte++) {
      cp1252Reverse.set(decoder.decode(Buffer.from([byte])), byte);
    }
  }
  return cp1252Reverse;
}

function decodeText(buffer) {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.toString("utf8", 3), encoding: "utf-8-bom" };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: buffer.toString("utf16le", 2), encoding: "utf-16le" };
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return {
      text: new TextDecoder("utf-16be").decode(buffer.subarray(2)),
      encoding: "utf-16be",
    };
  }
  try {
    return { text: utf8Decoder.decode(buffer), encoding: "utf-8" };
  } catch (e) {
    return {
      text: new TextDecoder("windows-1252").decode(buffer),
      encoding: "windows-1252",
    };
  }
}

function encodeCp1252(text) {
  const reverse = getCp1252Reverse();
  const bytes = Buffer.alloc(text.length);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = ch.charCodeAt(0);
    if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) {
      bytes[i] = code;
    } else if (reverse.has(ch)) {
      bytes[i] = reverse.get(ch);
    } else {
      return null; // character not representable in ANSI
    }
  }
  return bytes;
}

function encodeText(text, encoding) {
  switch (encoding) {
    case "utf-8-bom":
      return {
        buffer: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, "utf8")]),
        encoding,
      };
    case "utf-16le":
      return {
        buffer: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]),
        encoding,
      };
    case "utf-16be": {
      const body = Buffer.from(text, "utf16le");
      body.swap16();
      return { buffer: Buffer.concat([Buffer.from([0xfe, 0xff]), body]), encoding };
    }
    case "windows-1252": {
      const bytes = encodeCp1252(text);
      // Text typed since opening may not fit ANSI (e.g. emoji); upgrade to UTF-8
      // rather than losing characters.
      if (bytes) return { buffer: bytes, encoding };
      return { buffer: Buffer.from(text, "utf8"), encoding: "utf-8" };
    }
    default:
      return { buffer: Buffer.from(text, "utf8"), encoding: "utf-8" };
  }
}

const defaultEol = () => (process.platform === "win32" ? "crlf" : "lf");

function readTextFile(filePath) {
  const { text, encoding } = decodeText(fs.readFileSync(filePath));
  const eol = text.includes("\r\n") ? "crlf" : text.includes("\n") ? "lf" : defaultEol();
  return { content: text.replace(/\r\n?/g, "\n"), encoding, eol };
}

function writeTextFile(filePath, content, encoding, eol) {
  const text = eol === "lf" ? content : content.replace(/\n/g, "\r\n");
  const encoded = encodeText(text, encoding);
  fs.writeFileSync(filePath, encoded.buffer);
  return encoded.encoding;
}

// A textarea becomes unusable long before this, and it keeps a stray
// multi-gigabyte file from freezing the app.
const MAX_FILE_BYTES = 50 * 1024 * 1024;

function openTextFile(filePath) {
  try {
    if (fs.statSync(filePath).size > MAX_FILE_BYTES) {
      return { filePath, error: "The file is too large to open (over 50 MB)." };
    }
    const file = readTextFile(filePath);
    return {
      filePath,
      name: path.basename(filePath, path.extname(filePath)),
      ...file,
    };
  } catch (e) {
    return { filePath, error: e.message };
  }
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (e) {
    return false;
  }
}

function filesFromArgv(argv, cwd = process.cwd()) {
  return argv
    .slice(1)
    .filter((arg) => arg && !arg.startsWith("-"))
    .map((arg) => path.resolve(cwd, arg))
    .filter(isFile);
}

// ---- Single instance ----
//
// Opening a file with StackPad while it is already running hands the file to
// the existing window instead of starting a second copy of the app.

const isPrimaryInstance = app.requestSingleInstanceLock();

if (!isPrimaryInstance) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv, cwd) => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();

    const paths = filesFromArgv(argv, cwd);
    if (!paths.length) return;

    // Still starting up: the page collects these with files:take-pending.
    if (!rendererReady) {
      pendingFiles.push(...paths);
      return;
    }
    mainWindow.webContents.send("open-files", paths.map(openTextFile));
  });
}

let pendingFiles = filesFromArgv(process.argv);
let mainWindow;
let appMenu;
let applyingRatio = false;
let rendererReady = false;

if (process.platform === "win32") {
  app.setAppUserModelId("com.stackpad.app");
}

function sendMenuAction(action, payload) {
  if (mainWindow)
    mainWindow.webContents.send("menu-action", { action, payload });
}

function selectTheme(menu, selectedId, action) {
  ["theme-light", "theme-dark", "theme-system"].forEach((id) => {
    const item = menu.getMenuItemById(id);
    item.checked = id === selectedId;
  });

  sendMenuAction(action);
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
          label: "New Group",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => sendMenuAction("new-group"),
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
          label: "Find Previous",
          accelerator: "Shift+F3",
          click: () => sendMenuAction("find-previous"),
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
      label: "Screen",
      submenu: [
        {
          id: "ratio-4:5",
          label: "4:5",
          type: "radio",
          checked: settings.ratio === "4:5",
          click: () => setRatio("4:5"),
        },
        {
          id: "ratio-16:9",
          label: "16:9",
          type: "radio",
          checked: settings.ratio === "16:9",
          click: () => setRatio("16:9"),
        },
        {
          id: "ratio-freeform",
          label: "Freeform",
          type: "radio",
          checked: settings.ratio === "freeform",
          click: () => setRatio("freeform"),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          id: "word-wrap",
          label: "Word Wrap",
          type: "checkbox",
          checked: settings.wordWrap,
          click: (item) => sendMenuAction("word-wrap", item.checked),
        },
        { label: "Font...", click: () => sendMenuAction("font") },
        { type: "separator" },
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
          id: "status-bar",
          label: "Status Bar",
          type: "checkbox",
          checked: settings.statusBar,
          click: (item) => sendMenuAction("status-bar", item.checked),
        },
        { type: "separator" },
        {
          label: "Theme",
          submenu: [
            {
              id: "theme-light",
              label: "Light",
              type: "checkbox",
              checked: settings.theme === "light",
              click: () => selectTheme(appMenu, "theme-light", "theme-light"),
            },
            {
              id: "theme-dark",
              label: "Dark",
              type: "checkbox",
              checked: settings.theme === "dark",
              click: () => selectTheme(appMenu, "theme-dark", "theme-dark"),
            },
            {
              id: "theme-system",
              label: "Use System Settings",
              type: "checkbox",
              checked: settings.theme === "system",
              click: () => selectTheme(appMenu, "theme-system", "theme-system"),
            },
          ],
        },
      ],
    },
  ];

  appMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(appMenu);
}

// ---- Window sizing ----

function getRatioSize(ratio, display) {
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;
  const aspect = RATIOS[ratio];
  const ratioPercent = ratio === "4:5" ? 0.8 : 0.75;
  const maxWidth = Math.max(360, Math.round(screenWidth * ratioPercent));
  const maxHeight = Math.max(260, Math.round(screenHeight * ratioPercent));

  let width = maxWidth;
  let height = Math.round(width / aspect);

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspect);
  }

  return {
    width: Math.min(width, screenWidth - 40),
    height: Math.min(height, screenHeight - 40),
  };
}

function boundsAreVisible(bounds) {
  if (!bounds) return false;
  const { workArea } = screen.getDisplayMatching(bounds);
  return (
    bounds.x < workArea.x + workArea.width - 80 &&
    bounds.x + bounds.width > workArea.x + 80 &&
    bounds.y >= workArea.y - 10 &&
    bounds.y < workArea.y + workArea.height - 80
  );
}

function getInitialBounds() {
  if (settings.ratio === "freeform" && boundsAreVisible(settings.bounds)) {
    return settings.bounds;
  }

  const display = screen.getPrimaryDisplay();

  if (RATIOS[settings.ratio]) {
    return getRatioSize(settings.ratio, display);
  }

  const { width: screenWidth, height: screenHeight } = display.workAreaSize;
  return {
    width: Math.min(1100, Math.max(720, Math.round(screenWidth * 0.75))),
    height: Math.min(720, Math.max(520, Math.round(screenHeight * 0.75))),
  };
}

function markRatio(ratio) {
  settings.ratio = ratio;
  saveSettings();

  const item = appMenu && appMenu.getMenuItemById(`ratio-${ratio}`);
  if (item) item.checked = true;

  if (mainWindow) mainWindow.webContents.send("ratio-changed", ratio);
}

function setRatio(ratio) {
  if (!mainWindow) return false;
  if (ratio === "freeform") {
    markRatio("freeform");
    return true;
  }
  if (!RATIOS[ratio]) return false;

  markRatio(ratio);

  const display = screen.getDisplayMatching(mainWindow.getBounds());
  const { width, height } = getRatioSize(ratio, display);

  const applyRatio = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    applyingRatio = true;
    mainWindow.setSize(width, height, true);
    mainWindow.center();
    setTimeout(() => {
      applyingRatio = false;
    }, 300);
  };

  if (mainWindow.isMaximized()) {
    applyingRatio = true;
    mainWindow.once("unmaximize", applyRatio);
    mainWindow.unmaximize();
  } else {
    applyRatio();
  }

  return true;
}

function isDarkTheme() {
  return (
    settings.theme === "dark" ||
    (settings.theme === "system" && nativeTheme.shouldUseDarkColors)
  );
}

function titleBarColors(dark) {
  return {
    color: dark ? "#18213f" : "#1e3a8a",
    symbolColor: dark ? "#e8e8e8" : "#ffffff",
    height: 32,
  };
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return;
  if (settings.ratio === "freeform" && settings.maximized) mainWindow.maximize();
  mainWindow.show();
}

function createWindow() {
  const dark = isDarkTheme();

  mainWindow = new BrowserWindow({
    ...getInitialBounds(),
    minWidth: 360,
    minHeight: 260,
    show: false,
    backgroundColor: dark ? "#1f1f1f" : "#ffffff",
    title: "StackPad",
    icon: path.join(__dirname, "build", "icon.ico"),
    ...(process.platform === "win32"
      ? {
          titleBarStyle: "hidden",
          titleBarOverlay: titleBarColors(dark),
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // The page asks to be shown once its notes are loaded ("app:ready"), so
  // the window never flashes blank. This is only a safety net.
  mainWindow.once("ready-to-show", () => setTimeout(showMainWindow, 1500));

  // Never let a dropped file or stray link replace the app's own page.
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // A user-driven resize turns a ratio preset into Freeform.
  const onUserResize = () => {
    if (!applyingRatio && settings.ratio !== "freeform") markRatio("freeform");
  };
  mainWindow.on("resized", onUserResize);
  mainWindow.on("maximize", onUserResize);

  mainWindow.on("close", () => {
    settings.maximized = mainWindow.isMaximized();
    if (settings.ratio === "freeform") settings.bounds = mainWindow.getNormalBounds();
    saveSettings();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
  buildMenu();
  mainWindow.setAutoHideMenuBar(true);
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  if (!isPrimaryInstance) return;

  ensureDraftsDir();
  loadSettings();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("app:ready", () => {
  rendererReady = true;
  showMainWindow();
});

ipcMain.on("menu:action", (_event, data) => {
  const { action, payload } = data || {};
  if (action === "exit") {
    app.quit();
    return;
  }

  if (["theme-light", "theme-dark", "theme-system"].includes(action)) {
    ["theme-light", "theme-dark", "theme-system"].forEach((id) => {
      appMenu.getMenuItemById(id).checked = id === action;
    });
  } else if (action === "word-wrap" || action === "status-bar") {
    appMenu.getMenuItemById(action).checked = Boolean(payload);
  }

  sendMenuAction(action, payload);
});

const EDIT_ACTIONS = {
  undo: "undo",
  redo: "redo",
  cut: "cut",
  copy: "copy",
  paste: "paste",
  delete: "delete",
  "select-all": "selectAll",
};

ipcMain.on("edit:action", (event, action) => {
  const method = EDIT_ACTIONS[action];
  if (method) event.sender[method]();
});

ipcMain.on("window:titlebar-theme", (_event, dark) => {
  if (process.platform !== "win32" || !mainWindow) return;

  mainWindow.setTitleBarOverlay(titleBarColors(dark));
});

// ---- IPC: settings ----

ipcMain.handle("settings:get", () => settings);

function updateSettings(partial) {
  if (!partial || typeof partial !== "object") return;
  const allowed = ["theme", "fontFamily", "fontSize", "zoom", "wordWrap", "statusBar", "groups"];
  allowed.forEach((key) => {
    if (key in partial) settings[key] = partial[key];
  });
  saveSettings();
}

ipcMain.on("settings:update", (_event, partial) => updateSettings(partial));

// ---- IPC: persistence ----

ipcMain.handle("notes:load-all", () => {
  const index = readIndex();
  return index.map((entry) => {
    const draft = readDraft(entry.id);
    let file = null;

    if (entry.filePath) {
      try {
        file = readTextFile(entry.filePath);
      } catch (e) {
        file = null;
      }
    }

    // A clean file tab reloads from disk so outside edits show up; a tab
    // with unsaved changes (or older entries without the flag) uses its draft.
    const useDraft = entry.dirty !== false || !file;
    const content = useDraft ? (draft ?? file?.content ?? "") : file.content;

    return {
      ...entry,
      content,
      savedContent: file ? file.content : null,
      encoding: file?.encoding || entry.encoding || "utf-8",
      eol: entry.eol || file?.eol || defaultEol(),
    };
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

// Called synchronously while the window unloads, so the last keystrokes
// (still waiting on the draft-save debounce) reach the disk before quitting.
ipcMain.on("notes:flush-sync", (event, { index, drafts, settings: partial } = {}) => {
  try {
    updateSettings(partial);
    (drafts || []).forEach(({ id, content }) => writeDraft(id, content));
    if (Array.isArray(index)) writeIndex(index);
  } catch (e) {
    // Nothing useful to do this late in shutdown.
  }
  event.returnValue = true;
});

ipcMain.handle("notes:delete-note", (event, id) => {
  deleteDraft(id);
  return true;
});

// ---- IPC: real files ----

const TEXT_FILTERS = [
  { name: "Text Documents", extensions: ["txt"] },
  { name: "All Files", extensions: ["*"] },
];

ipcMain.handle("dialog:open-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: TEXT_FILTERS,
  });
  if (result.canceled || result.filePaths.length === 0) return [];
  return result.filePaths.map(openTextFile);
});

ipcMain.handle("files:open-paths", (event, paths) =>
  (Array.isArray(paths) ? paths : [])
    .filter((p) => typeof p === "string" && p)
    .map((p) => (isFile(p) ? openTextFile(p) : { filePath: p, error: "Not a file." })),
);

ipcMain.handle("files:take-pending", () => {
  const files = pendingFiles.map(openTextFile);
  pendingFiles = [];
  return files;
});

ipcMain.handle(
  "dialog:save-file-as",
  async (event, { defaultName, defaultPath, content, encoding, eol }) => {
    const safeName = (defaultName || "Untitled").replace(/[\\/:*?"<>|]/g, "-");
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultPath || `${safeName}.txt`,
      filters: TEXT_FILTERS,
    });
    if (result.canceled || !result.filePath) return null;
    try {
      return {
        filePath: result.filePath,
        name: path.basename(result.filePath, path.extname(result.filePath)),
        encoding: writeTextFile(result.filePath, content, encoding, eol),
      };
    } catch (e) {
      return { filePath: result.filePath, error: e.message };
    }
  },
);

ipcMain.handle("file:save", (event, { filePath, content, encoding, eol }) => {
  try {
    return { filePath, encoding: writeTextFile(filePath, content, encoding, eol) };
  } catch (e) {
    return { filePath, error: e.message };
  }
});

ipcMain.handle("window:set-ratio", (event, ratio) => setRatio(ratio));

ipcMain.handle("app:print", () => {
  if (mainWindow) mainWindow.webContents.print({ silent: false });
  return true;
});
