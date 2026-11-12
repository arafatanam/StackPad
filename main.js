const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  dialog,
  screen,
  nativeTheme,
  nativeImage,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");
const textfile = require("./lib/textfile");
const updater = require("./lib/updater");
const pkg = require("./package.json");

const isWindows = process.platform === "win32";

// Every web address the app can open. The page asks for a link by name, so
// it can never be used to open an arbitrary URL.
const WEBSITE = pkg.homepage.replace(/\/?$/, "/");
const REPO = "https://github.com/arafatanam/StackPad";
const LINKS = {
  website: WEBSITE,
  shortcuts: `${WEBSITE}#shortcuts`,
  changelog: `${REPO}/blob/main/CHANGELOG.md`,
  privacy: `${WEBSITE}privacy.html`,
  source: REPO,
  license: `${REPO}/blob/main/LICENSE`,
  download: `${WEBSITE}#download`,
};

function osLabel() {
  if (isWindows) {
    // Windows 11 still reports itself as 10.0; build 22000+ is Windows 11.
    const build = Number(require("os").release().split(".")[2]) || 0;
    return build >= 22000 ? "Windows 11" : "Windows 10";
  }
  if (process.platform === "linux") return "Linux";
  return process.platform;
}

function issueLink() {
  const params = new URLSearchParams({
    template: "bug_report.yml",
    version: app.getVersion(),
    os: `${osLabel()} (${process.arch})`,
  });
  return `${REPO}/issues/new?${params}`;
}

function openLink(name) {
  const url = name === "report-issue" ? issueLink() : LINKS[name];
  if (url) shell.openExternal(url);
}

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
  autoUpdate: true,
};

// ---- Storage helpers ----

// Write to a temp file and rename it over the target, so a crash mid-write
// can never leave a half-written index, draft or settings file behind.
function writeFileAtomic(filePath, data) {
  try {
    textfile.writeFileAtomic(filePath, data);
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

// ---- Text files ----

const defaultEol = () => textfile.defaultEol();
const { readTextFile, writeTextFile, fileStamp, sameStamp } = textfile;

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

function sendToWindow(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
}

function sendMenuAction(action, payload) {
  sendToWindow("menu-action", { action, payload });
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
    {
      label: "Help",
      submenu: [
        { label: "StackPad Website", click: () => openLink("website") },
        { label: "Keyboard Shortcuts", click: () => openLink("shortcuts") },
        { label: "Release Notes", click: () => openLink("changelog") },
        { label: "Report a Problem...", click: () => openLink("report-issue") },
        { type: "separator" },
        {
          label: "Check for Updates...",
          click: () => sendMenuAction("check-updates"),
        },
        {
          id: "auto-update",
          label: "Check for Updates Automatically",
          type: "checkbox",
          checked: settings.autoUpdate !== false,
          click: (item) => sendMenuAction("auto-update", item.checked),
        },
        { type: "separator" },
        { label: "About StackPad", click: () => sendMenuAction("about") },
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
    // Linux window managers need a PNG; Windows uses the multi-size ICO.
    icon: path.join(__dirname, "build", isWindows ? "icon.ico" : "icon.png"),
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

  // Lets the page check open files for outside changes when the user
  // comes back to StackPad.
  mainWindow.on("focus", () => sendToWindow("window-focused"));

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

  updater.init({
    sendToWindow,
    autoCheckEnabled: () => settings.autoUpdate !== false,
  });

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
  } else if (["word-wrap", "status-bar", "auto-update"].includes(action)) {
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
  const allowed = [
    "theme",
    "fontFamily",
    "fontSize",
    "zoom",
    "wordWrap",
    "statusBar",
    "groups",
    "autoUpdate",
  ];
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
      stamp: file ? file.stamp : null,
      // Unsaved changes, and the file was edited elsewhere while StackPad
      // was closed: the page asks which version to keep.
      changedWhileClosed: Boolean(
        useDraft && file && entry.stamp && !sameStamp(entry.stamp, file.stamp),
      ),
      missing: Boolean(entry.filePath && !file),
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
        ...writeTextFile(result.filePath, content, encoding, eol),
      };
    } catch (e) {
      return { filePath: result.filePath, error: e.message };
    }
  },
);

ipcMain.handle("file:save", (event, { filePath, content, encoding, eol }) => {
  try {
    return { filePath, ...writeTextFile(filePath, content, encoding, eol) };
  } catch (e) {
    return { filePath, error: e.message };
  }
});

ipcMain.handle("window:set-ratio", (event, ratio) => setRatio(ratio));

ipcMain.handle("app:print", () => {
  if (mainWindow) mainWindow.webContents.print({ silent: false });
  return true;
});

// ---- IPC: outside changes to open files ----

// entries: [{ id, filePath, stamp }]. Only files whose stamp moved are read
// again; the page decides what to do with each change.
ipcMain.handle("files:check", (event, entries) =>
  (Array.isArray(entries) ? entries : [])
    .filter((e) => e && typeof e.filePath === "string" && e.filePath)
    .map(({ id, filePath, stamp }) => {
      const current = fileStamp(filePath);
      if (!current) return { id, status: stamp === "missing" ? "unchanged" : "missing" };
      if (sameStamp(current, stamp)) return { id, status: "unchanged" };
      if (current.size > MAX_FILE_BYTES) return { id, status: "unchanged" };
      try {
        return { id, status: "changed", file: readTextFile(filePath) };
      } catch (e) {
        return { id, status: "unchanged" };
      }
    }),
);

// ---- IPC: help, about and updates ----

ipcMain.on("app:open-link", (_event, name) => openLink(name));

ipcMain.handle("app:info", () => {
  let icon = null;
  try {
    icon = nativeImage
      .createFromPath(path.join(__dirname, "build", "icon.png"))
      .resize({ width: 128, height: 128, quality: "best" })
      .toDataURL();
  } catch (e) {
    // The dialog works without the logo.
  }
  return {
    name: "StackPad",
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    os: `${osLabel()} (${process.arch})`,
    copyright: pkg.build?.copyright || "",
    updateMode: updater.updateMode(),
    icon,
  };
});

ipcMain.handle("update:check", () => updater.checkNow());
ipcMain.handle("update:install", () => updater.installNow());
