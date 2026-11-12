// Automatic updates from the project's GitHub releases.
//
// Windows (installer) and Linux AppImage builds download updates in the
// background and install them the next time StackPad closes, or straight
// away if the user picks "Restart now". The .deb build and the Microsoft
// Store build can't replace themselves, so they only report that a new
// version exists (the Store updates its own apps).

const { app } = require("electron");

const CHECK_DELAY_MS = 15 * 1000; // let the window settle first
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let autoUpdater = null;
let send = () => {};
let isEnabled = () => true;
let timer = null;
let state = { status: "idle" }; // idle | checking | downloading | downloaded | error
let manualCheck = null; // resolver for a check the user asked for

function updateMode() {
  if (!app.isPackaged) return "dev";
  if (process.windowsStore) return "store";
  if (process.platform === "win32") return "auto";
  if (process.platform === "linux") return process.env.APPIMAGE ? "auto" : "notify";
  return "notify";
}

function settle(result) {
  if (!manualCheck) return;
  const resolve = manualCheck;
  manualCheck = null;
  resolve(result);
}

function init({ sendToWindow, autoCheckEnabled }) {
  send = sendToWindow;
  isEnabled = autoCheckEnabled;

  const mode = updateMode();
  if (mode === "dev" || mode === "store") return;

  ({ autoUpdater } = require("electron-updater"));
  autoUpdater.autoDownload = mode === "auto";
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = null;

  autoUpdater.on("checking-for-update", () => {
    state = { status: "checking" };
  });

  autoUpdater.on("update-not-available", () => {
    state = { status: "idle" };
    settle({ status: "up-to-date", version: app.getVersion() });
  });

  autoUpdater.on("update-available", (info) => {
    if (mode === "auto") {
      state = { status: "downloading", version: info.version };
      settle({ status: "downloading", version: info.version });
    } else {
      state = { status: "idle", version: info.version };
      send("update-available", { version: info.version });
      settle({ status: "available", version: info.version });
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    state = { status: "downloaded", version: info.version };
    send("update-downloaded", { version: info.version });
  });

  autoUpdater.on("error", (error) => {
    state = { status: "error" };
    settle({ status: "error", message: friendlyError(error) });
  });

  setTimeout(() => {
    if (isEnabled()) check();
  }, CHECK_DELAY_MS);

  timer = setInterval(() => {
    if (isEnabled() && state.status !== "downloaded") check();
  }, CHECK_INTERVAL_MS);
  timer.unref?.();
}

function friendlyError(error) {
  const text = String((error && error.message) || error || "");
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ERR_INTERNET|net::/i.test(text)) {
    return "StackPad couldn't reach the update server. Check your internet connection and try again.";
  }
  if (/404/.test(text)) {
    return "No published release was found yet.";
  }
  return "Something went wrong while checking for updates.";
}

function check() {
  if (!autoUpdater) return;
  autoUpdater.checkForUpdates().catch(() => {
    // Reported through the "error" event.
  });
}

// For Help → Check for Updates. Always resolves with something to show.
function checkNow() {
  const mode = updateMode();
  if (mode === "dev") {
    return Promise.resolve({ status: "unsupported", reason: "dev" });
  }
  if (mode === "store") {
    return Promise.resolve({ status: "unsupported", reason: "store" });
  }
  if (state.status === "downloaded") {
    return Promise.resolve({ status: "downloaded", version: state.version });
  }
  if (state.status === "downloading") {
    return Promise.resolve({ status: "downloading", version: state.version });
  }

  return new Promise((resolve) => {
    if (manualCheck) manualCheck = resolve;
    else {
      manualCheck = resolve;
      check();
    }
    // Never leave the user waiting on a dialog forever.
    setTimeout(
      () => settle({ status: "error", message: friendlyError("ETIMEDOUT") }),
      30 * 1000,
    );
  });
}

function installNow() {
  if (!autoUpdater || state.status !== "downloaded") return false;
  // Silent install, then start StackPad again.
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
  return true;
}

module.exports = { init, checkNow, installNow, updateMode };
