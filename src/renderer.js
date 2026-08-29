let tabs = []; // { id, title, content, filePath, order, dirty }
let activeId = null;
let wordWrap = true;
let statusBarVisible = true;
let darkMode = false;
let zoomLevel = 100;
let fontFamily = "'Consolas', 'Courier New', monospace";
let fontSize = 16;
let textStyle = "body";
let saveTimer = null;
let ratioSelection = "4:5";
let suppressRatioClear = false;
const textStyleScale = { body: 1, h2: 1.35, h1: 1.75 };
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");

const editor = document.getElementById("editor");
const tabListEl = document.getElementById("tab-list");
const statusPosition = document.getElementById("status-position");
const statusCount = document.getElementById("status-count");
const statusWrap = document.getElementById("status-wrap");
const statusZoom = document.getElementById("status-zoom");
const statusBar = document.getElementById("status-bar");
const formatSelect = document.getElementById("format-select");
const ratioSelect = document.getElementById("ratio-select");

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function persistIndex() {
  const index = tabs.map((t, i) => ({
    id: t.id,
    title: t.title,
    filePath: t.filePath || null,
    order: i,
    lastModified: Date.now(),
  }));
  window.api.saveIndex(index);
}

function scheduleDraftSave(tab) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.api.saveDraft(tab.id, tab.content);
  }, 400);
}

function createTab(opts = {}) {
  const tab = {
    id: uid(),
    title: opts.title || "Untitled",
    content: opts.content || "",
    filePath: opts.filePath || null,
    dirty: false,
  };
  tabs.push(tab);
  activeId = tab.id;
  persistIndex();
  if (tab.content) window.api.saveDraft(tab.id, tab.content);
  renderTabs();
  loadActiveIntoEditor();
  return tab;
}

function getActiveTab() {
  return tabs.find((t) => t.id === activeId);
}

function switchTab(id) {
  if (id === activeId) return;
  flushCurrentEditorContent();
  activeId = id;
  renderTabs();
  loadActiveIntoEditor();
}

function flushCurrentEditorContent() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.content = editor.value;
  window.api.saveDraft(tab.id, tab.content);
}

function loadActiveIntoEditor() {
  const tab = getActiveTab();
  editor.value = tab ? tab.content : "";
  editor.focus();
  updateStatus();
}

function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;

  const tab = tabs[idx];
  const hasWrittenContent =
    tab && tab.content && tab.content.trim().length > 0 && tab.dirty !== false;

  if (hasWrittenContent) {
    const shouldClose = window.confirm(
      "This tab has unsaved content. Do you want to exit?",
    );
    if (!shouldClose) return;
  }

  tabs.splice(idx, 1);
  window.api.deleteNote(id);

  if (tabs.length === 0) {
    createTab();
  } else if (activeId === id) {
    activeId = tabs[Math.max(0, idx - 1)].id;
    loadActiveIntoEditor();
  }
  persistIndex();
  renderTabs();
}

function renameTab(id, newTitle) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return;
  tab.title = newTitle.trim() || "Untitled";
  persistIndex();
  renderTabs();
}

function renderTabs() {
  tabListEl.innerHTML = "";
  tabs.forEach((tab, index) => {
    const item = document.createElement("div");
    item.className = "tab-item" + (tab.id === activeId ? " active" : "");
    item.title = tab.title;

    const dot = document.createElement("span");
    dot.className = "tab-dot";

    const shortLabel = document.createElement("span");
    shortLabel.className = "tab-short";
    shortLabel.textContent = String(index + 1);

    const label = document.createElement("span");
    label.className = "tab-title";
    label.textContent = tab.title;

    const actions = document.createElement("span");
    actions.className = "tab-actions";

    const renameBtn = document.createElement("button");
    renameBtn.className = "tab-action-btn";
    renameBtn.title = "Rename";
    renameBtn.textContent = "✎";
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openRenameDialog(tab);
    });

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-action-btn";
    closeBtn.title = "Close";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    actions.appendChild(renameBtn);
    actions.appendChild(closeBtn);

    item.appendChild(dot);
    item.appendChild(shortLabel);
    item.appendChild(label);
    item.appendChild(actions);
    item.addEventListener("click", () => switchTab(tab.id));
    tabListEl.appendChild(item);
  });
}

const renameDialog = document.getElementById("rename-dialog");
const renameInput = document.getElementById("rename-input");
let renameTargetId = null;

function openRenameDialog(tab) {
  renameTargetId = tab.id;
  renameInput.value = tab.title;
  renameDialog.showModal();
  renameInput.select();
}

document.getElementById("rename-ok-btn").addEventListener("click", () => {
  if (renameTargetId) renameTab(renameTargetId, renameInput.value);
  renameDialog.close();
});
document
  .getElementById("rename-close-btn")
  .addEventListener("click", () => renameDialog.close());

editor.addEventListener("input", () => {
  const tab = getActiveTab();
  if (!tab) return;
  tab.content = editor.value;
  tab.dirty = tab.content.trim().length > 0;
  scheduleDraftSave(tab);
  updateStatus();
});

editor.addEventListener("keyup", updateStatus);
editor.addEventListener("click", updateStatus);

function updateStatus() {
  const value = editor.value;
  const pos = editor.selectionStart;
  const upToCursor = value.slice(0, pos);
  const line = upToCursor.split("\n").length;
  const col = pos - upToCursor.lastIndexOf("\n");
  statusPosition.textContent = `Ln ${line}, Col ${col}`;
  statusCount.textContent = `${value.length} characters`;
  statusWrap.textContent = wordWrap ? "Word Wrap: On" : "Word Wrap: Off";
  statusZoom.textContent = `${zoomLevel}%`;
}

document
  .getElementById("new-tab-btn")
  .addEventListener("click", () => createTab());

document.querySelectorAll(".format-btn").forEach((button) => {
  button.addEventListener("click", () =>
    applyTextStyle(button.dataset.textStyle),
  );
});

function closeCustomDropdowns(except = null) {
  document.querySelectorAll(".custom-select").forEach((select) => {
    if (select === except) return;
    select.classList.remove("open");
    const trigger = select.querySelector(".select-trigger");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  });
}

function setupCustomDropdown(trigger, menu, onSelect) {
  const valueEl = trigger.querySelector(".select-value");

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const parent = trigger.closest(".custom-select");
    const isOpen = parent.classList.contains("open");
    closeCustomDropdowns(isOpen ? null : parent);
    parent.classList.toggle("open", !isOpen);
    trigger.setAttribute("aria-expanded", String(!isOpen));
  });

  menu.querySelectorAll(".select-option").forEach((option) => {
    option.addEventListener("click", (event) => {
      event.stopPropagation();
      const parent = trigger.closest(".custom-select");
      parent.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      menu.querySelectorAll(".select-option").forEach((item) => {
        item.classList.toggle("selected", item === option);
      });
      if (valueEl) valueEl.textContent = option.textContent.trim();
      onSelect(option.dataset.value);
    });
  });
}

document.addEventListener("click", () => closeCustomDropdowns());

setupCustomDropdown(
  formatSelect,
  formatSelect.closest(".custom-select").querySelector(".select-menu"),
  (value) => {
    applyTextStyle(value);
  },
);

setupCustomDropdown(
  ratioSelect,
  ratioSelect.closest(".custom-select").querySelector(".select-menu"),
  (value) => {
    if (value === "custom") {
      ratioSelection = null;
      ratioSelect.querySelector(".select-value").textContent = "Custom";
      return;
    }
    setRatio(value);
  },
);

async function doOpen() {
  const result = await window.api.openFile();
  if (!result) return;
  flushCurrentEditorContent();
  createTab({
    title: result.name,
    content: result.content,
    filePath: result.filePath,
  });
}

async function doSave() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.content = editor.value;
  if (tab.filePath) {
    await window.api.saveFile(tab.filePath, tab.content);
    window.api.saveDraft(tab.id, tab.content);
  } else {
    await doSaveAs();
  }
}

async function doSaveAs() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.content = editor.value;
  const result = await window.api.saveFileAs(tab.title, tab.content);
  if (!result) return;
  tab.filePath = result.filePath;
  tab.title = result.name;
  window.api.saveDraft(tab.id, tab.content);
  persistIndex();
  renderTabs();
}

const findDialog = document.getElementById("find-dialog");
const findInput = document.getElementById("find-input");
const findStatus = document.getElementById("find-status");
let lastFindIndex = 0;

function openFind() {
  findDialog.showModal();
  findInput.focus();
  findInput.select();
}

function findNext() {
  const term = findInput.value;
  if (!term) return;
  const value = editor.value;
  let start = editor.selectionEnd || 0;
  let idx = value.indexOf(term, start);
  if (idx === -1) idx = value.indexOf(term, 0);
  if (idx === -1) {
    findStatus.textContent = `Cannot find "${term}"`;
    return;
  }
  editor.focus();
  editor.setSelectionRange(idx, idx + term.length);
  findStatus.textContent = "";
  lastFindIndex = idx;
}

document.getElementById("find-next-btn").addEventListener("click", findNext);
document
  .getElementById("find-close-btn")
  .addEventListener("click", () => findDialog.close());

const replaceDialog = document.getElementById("replace-dialog");
const replaceFindInput = document.getElementById("replace-find-input");
const replaceWithInput = document.getElementById("replace-with-input");
const replaceStatus = document.getElementById("replace-status");

function openReplace() {
  replaceDialog.showModal();
  replaceFindInput.focus();
}

function replaceFindNext() {
  const term = replaceFindInput.value;
  if (!term) return;
  const value = editor.value;
  let start = editor.selectionEnd || 0;
  let idx = value.indexOf(term, start);
  if (idx === -1) idx = value.indexOf(term, 0);
  if (idx === -1) {
    replaceStatus.textContent = `Cannot find "${term}"`;
    return;
  }
  editor.focus();
  editor.setSelectionRange(idx, idx + term.length);
  replaceStatus.textContent = "";
}

function replaceOne() {
  const term = replaceFindInput.value;
  const withText = replaceWithInput.value;
  if (!term) return;
  if (editor.value.slice(editor.selectionStart, editor.selectionEnd) === term) {
    const before = editor.value.slice(0, editor.selectionStart);
    const after = editor.value.slice(editor.selectionEnd);
    editor.value = before + withText + after;
    const tab = getActiveTab();
    tab.content = editor.value;
    scheduleDraftSave(tab);
    editor.setSelectionRange(before.length, before.length + withText.length);
  }
  replaceFindNext();
}

function replaceAll() {
  const term = replaceFindInput.value;
  const withText = replaceWithInput.value;
  if (!term) return;
  const count = editor.value.split(term).length - 1;
  editor.value = editor.value.split(term).join(withText);
  const tab = getActiveTab();
  tab.content = editor.value;
  scheduleDraftSave(tab);
  updateStatus();
  replaceStatus.textContent = `Replaced ${count} occurrence(s)`;
}

document
  .getElementById("replace-next-btn")
  .addEventListener("click", replaceFindNext);
document
  .getElementById("replace-one-btn")
  .addEventListener("click", replaceOne);
document
  .getElementById("replace-all-btn")
  .addEventListener("click", replaceAll);
document
  .getElementById("replace-close-btn")
  .addEventListener("click", () => replaceDialog.close());

const gotoDialog = document.getElementById("goto-dialog");
const gotoInput = document.getElementById("goto-input");

function openGoTo() {
  gotoDialog.showModal();
  gotoInput.focus();
}

document.getElementById("goto-ok-btn").addEventListener("click", () => {
  const lineNum = parseInt(gotoInput.value, 10);
  if (!lineNum || lineNum < 1) {
    gotoDialog.close();
    return;
  }
  const lines = editor.value.split("\n");
  let idx = 0;
  for (let i = 0; i < Math.min(lineNum - 1, lines.length); i++) {
    idx += lines[i].length + 1;
  }
  editor.focus();
  editor.setSelectionRange(idx, idx);
  updateStatus();
  gotoDialog.close();
});
document
  .getElementById("goto-close-btn")
  .addEventListener("click", () => gotoDialog.close());

const fontDialog = document.getElementById("font-dialog");
const fontFamilySelect = document.getElementById("font-family-select");
const fontSizeInput = document.getElementById("font-size-input");

function openFontDialog() {
  fontFamilySelect.value = fontFamily;
  fontSizeInput.value = fontSize;
  fontDialog.showModal();
}

document.getElementById("font-ok-btn").addEventListener("click", () => {
  fontFamily = fontFamilySelect.value;
  fontSize = parseInt(fontSizeInput.value, 10) || 14;
  applyFont();
  fontDialog.close();
});
document
  .getElementById("font-close-btn")
  .addEventListener("click", () => fontDialog.close());

function syncStyleControls() {
  document.querySelectorAll(".format-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.textStyle === textStyle);
  });
  if (formatSelect) {
    const label =
      textStyle === "h1" ? "H1" : textStyle === "h2" ? "H2" : "Body";
    formatSelect.querySelector(".select-value").textContent = label;
    formatSelect
      .closest(".custom-select")
      .querySelectorAll(".select-option")
      .forEach((option) => {
        option.classList.toggle("selected", option.dataset.value === textStyle);
      });
  }
}

function applyTextStyle(style) {
  textStyle = textStyleScale[style] ? style : "body";
  const scale = textStyleScale[textStyle];
  editor.style.fontSize = `${(fontSize * scale * zoomLevel) / 100}px`;
  syncStyleControls();
}

function applyFont() {
  editor.style.fontFamily = fontFamily;
  applyTextStyle(textStyle);
}

function applyZoom() {
  applyTextStyle(textStyle);
  updateStatus();
}

function zoomIn() {
  zoomLevel = Math.min(500, zoomLevel + 10);
  applyZoom();
}

function zoomOut() {
  zoomLevel = Math.max(20, zoomLevel - 10);
  applyZoom();
}

function zoomReset() {
  zoomLevel = 100;
  applyZoom();
}

function setWordWrap(value) {
  wordWrap = value;
  editor.classList.toggle("nowrap", !wordWrap);
  updateStatus();
}

function setStatusBarVisible(value) {
  statusBarVisible = value;
  statusBar.classList.toggle("hidden", !statusBarVisible);
}

function syncRatioControls(value = ratioSelection) {
  const menu = ratioSelect
    .closest(".custom-select")
    .querySelector(".select-menu");
  const label =
    value && (value === "4:5" || value === "16:9") ? value : "Custom";
  ratioSelect.querySelector(".select-value").textContent = label;
  menu.querySelectorAll(".select-option").forEach((option) => {
    option.classList.toggle(
      "selected",
      option.dataset.value === value ||
        (value && option.dataset.value === value) ||
        (!value && option.dataset.value === "custom"),
    );
  });
}

function setRatio(ratio) {
  ratioSelection = ratio;
  suppressRatioClear = true;
  syncRatioControls(ratio);
  window.setTimeout(() => {
    suppressRatioClear = false;
  }, 150);
  window.api.setWindowRatio(ratio);
}

function clearRatioSelection() {
  if (ratioSelection && !suppressRatioClear) {
    ratioSelection = null;
    syncRatioControls();
  }
}

function updateResponsiveMode() {
  const compact = window.innerWidth < window.innerHeight * 1.25;
  document.body.classList.toggle("compact-mode", compact);
}

let themeMode = "system";

themeMedia.addEventListener("change", () => {
  if (themeMode === "system") {
    setTheme("system");
  }
});

function setTheme(mode) {
  themeMode =
    mode === "light" || mode === "dark" || mode === "system" ? mode : "system";
  const shouldUseDark =
    themeMode === "dark" || (themeMode === "system" && themeMedia.matches);
  document.body.classList.toggle("dark", shouldUseDark);
  darkMode = shouldUseDark;
}

function setDarkMode(value) {
  setTheme(value ? "dark" : "light");
}

function insertTimeDate() {
  const now = new Date();
  const text = now.toLocaleTimeString() + " " + now.toLocaleDateString();
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;
  editor.value = value.slice(0, start) + text + value.slice(end);
  editor.focus();
  editor.setSelectionRange(start + text.length, start + text.length);
  const tab = getActiveTab();
  tab.content = editor.value;
  scheduleDraftSave(tab);
  updateStatus();
}

window.addEventListener("resize", () => {
  updateResponsiveMode();
  if (!suppressRatioClear) {
    clearRatioSelection();
  }
});

window.api.onMenuAction(({ action, payload }) => {
  switch (action) {
    case "new-tab":
      createTab();
      break;
    case "open":
      doOpen();
      break;
    case "save":
      doSave();
      break;
    case "save-as":
      doSaveAs();
      break;
    case "close-tab":
      closeTab(activeId);
      break;
    case "print":
      window.api.print();
      break;
    case "undo":
      document.execCommand("undo");
      break;
    case "redo":
      document.execCommand("redo");
      break;
    case "cut":
      document.execCommand("cut");
      break;
    case "copy":
      document.execCommand("copy");
      break;
    case "paste":
      document.execCommand("paste");
      break;
    case "delete":
      document.execCommand("delete");
      break;
    case "select-all":
      editor.focus();
      editor.select();
      break;
    case "time-date":
      insertTimeDate();
      break;
    case "find":
      openFind();
      break;
    case "find-next":
      findNext();
      break;
    case "replace":
      openReplace();
      break;
    case "go-to":
      openGoTo();
      break;
    case "word-wrap":
      setWordWrap(payload);
      break;
    case "font":
      openFontDialog();
      break;
    case "zoom-in":
      zoomIn();
      break;
    case "zoom-out":
      zoomOut();
      break;
    case "zoom-reset":
      zoomReset();
      break;
    case "status-bar":
      setStatusBarVisible(payload);
      break;
    case "dark-mode":
      setDarkMode(payload);
      break;
    case "theme-light":
      setTheme("light");
      break;
    case "theme-dark":
      setTheme("dark");
      break;
    case "theme-system":
      setTheme("system");
      break;
    case "text-body":
      applyTextStyle("body");
      break;
    case "text-h2":
      applyTextStyle("h2");
      break;
    case "text-h1":
      applyTextStyle("h1");
      break;
    case "ratio-4-5":
      setRatio("4:5");
      break;
    case "ratio-16-9":
      setRatio("16:9");
      break;
    default:
      break;
  }
});

editor.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();
    openFind();
  }

  const isZoomIn =
    (event.ctrlKey || event.metaKey) &&
    (event.key === "+" || event.key === "=" || event.code === "NumpadAdd");
  const isZoomOut =
    (event.ctrlKey || event.metaKey) &&
    (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract");
  const isZoomReset =
    (event.ctrlKey || event.metaKey) &&
    (event.key === "0" || event.code === "Numpad0");

  if (isZoomIn) {
    event.preventDefault();
    zoomIn();
  } else if (isZoomOut) {
    event.preventDefault();
    zoomOut();
  } else if (isZoomReset) {
    event.preventDefault();
    zoomReset();
  }
});

function initTheme() {
  setTheme("system");
  applyTextStyle("body");
  syncStyleControls();
  setRatio("4:5");
  updateResponsiveMode();
}

async function init() {
  const saved = await window.api.loadAllNotes();
  if (saved && saved.length > 0) {
    tabs = saved
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((t) => ({
        id: t.id,
        title: t.title,
        content: t.content,
        filePath: t.filePath || null,
      }));
    activeId = tabs[0].id;
  } else {
    createTab();
  }
  renderTabs();
  loadActiveIntoEditor();
  updateStatus();
  initTheme();
}

init();
