let tabs = []; // { id, title, content, filePath, order, dirty }
let activeId = null;
let wordWrap = true;
let statusBarVisible = true;
let darkMode = false;
let zoomLevel = 100;
let fontFamily = "'Consolas', 'Courier New', monospace";
let fontSize = 16;
let saveTimer = null;
let ratioSelection = "4:5";
let suppressRatioClear = false;
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");

const editor = document.getElementById("editor");
const tabListEl = document.getElementById("tab-list");
const statusPosition = document.getElementById("status-position");
const statusCount = document.getElementById("status-count");
const statusWrap = document.getElementById("status-wrap");
const statusZoom = document.getElementById("status-zoom");
const statusBar = document.getElementById("status-bar");
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
    active: t.id === activeId,
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
  persistIndex();
  renderTabs();
  loadActiveIntoEditor();
}

function cycleTab(direction) {
  if (tabs.length < 2) return;
  const idx = tabs.findIndex((t) => t.id === activeId);
  if (idx === -1) return;
  const nextIdx = (idx + direction + tabs.length) % tabs.length;
  switchTab(tabs[nextIdx].id);
}

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Tab") {
    event.preventDefault();
    cycleTab(event.shiftKey ? -1 : 1);
  }
});

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

// ---------- Drag-and-drop tab reordering with a separating animation ----------
// The drop rail stays locked to the sidebar tab list; the placeholder only moves
// between actual tab items so it does not keep bouncing between adjacent slots.

let dropPlaceholder = null;
let lastPlaceholderAnchor = null;
let lastPlaceholderBefore = null;

function ensurePlaceholder() {
  if (!dropPlaceholder) {
    dropPlaceholder = document.createElement("div");
    dropPlaceholder.className = "tab-drop-placeholder";
  }
  return dropPlaceholder;
}

function clearSplitClasses() {
  tabListEl
    .querySelectorAll(".drag-split-before, .drag-split-after")
    .forEach((el) => {
      el.classList.remove("drag-split-before", "drag-split-after");
      el.style.transform = "";
      el.style.marginTop = "";
      el.style.marginBottom = "";
      el.style.boxShadow = "";
    });
}

function applySplitMotion(referenceEl, before) {
  clearSplitClasses();
  if (!referenceEl) return;

  const targetClass = before ? "drag-split-before" : "drag-split-after";
  referenceEl.classList.add(targetClass);

  if (before) {
    referenceEl.style.transform = "translateY(-8px)";
    referenceEl.style.marginTop = "8px";
    referenceEl.style.marginBottom = "-4px";
    referenceEl.style.boxShadow = "0 -6px 16px rgba(13, 0, 109, 0.08)";
  } else {
    referenceEl.style.transform = "translateY(8px)";
    referenceEl.style.marginTop = "-4px";
    referenceEl.style.marginBottom = "8px";
    referenceEl.style.boxShadow = "0 6px 16px rgba(13, 0, 109, 0.08)";
  }
}

function placePlaceholder(referenceEl, before) {
  const ph = ensurePlaceholder();
  const samePosition =
    lastPlaceholderAnchor === referenceEl && lastPlaceholderBefore === before;

  if (!samePosition) {
    lastPlaceholderAnchor = referenceEl;
    lastPlaceholderBefore = before;
    clearSplitClasses();

    if (referenceEl) {
      if (before) {
        tabListEl.insertBefore(ph, referenceEl);
      } else {
        tabListEl.insertBefore(ph, referenceEl.nextSibling);
      }
      applySplitMotion(referenceEl, before);
    } else {
      if (ph.parentElement) ph.parentElement.removeChild(ph);
      tabListEl.appendChild(ph);
    }
  }
}

function removePlaceholder() {
  lastPlaceholderAnchor = null;
  lastPlaceholderBefore = null;
  clearSplitClasses();
  if (dropPlaceholder && dropPlaceholder.parentElement) {
    dropPlaceholder.parentElement.removeChild(dropPlaceholder);
  }
}

function getPlaceholderInsertIndex() {
  if (!dropPlaceholder || !dropPlaceholder.parentElement) return -1;
  const children = Array.from(tabListEl.children);
  const phIdx = children.indexOf(dropPlaceholder);
  if (phIdx === -1) return -1;
  let count = 0;
  for (let i = 0; i < phIdx; i++) {
    if (children[i].classList.contains("tab-item")) count++;
  }
  return count;
}

tabListEl.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";

  const sidebar = document.getElementById("sidebar");
  if (sidebar && !sidebar.contains(e.target)) {
    removePlaceholder();
    return;
  }

  const items = Array.from(tabListEl.querySelectorAll(".tab-item")).filter(
    (el) => !el.classList.contains("dragging"),
  );
  if (!items.length) {
    if (dropPlaceholder && !dropPlaceholder.parentElement) {
      tabListEl.appendChild(dropPlaceholder);
    }
    return;
  }

  let targetIndex = 0;
  let targetEl = null;
  let before = true;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rect = item.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) {
      targetEl = item;
      before = true;
      targetIndex = i;
      break;
    }
    targetIndex = i + 1;
    before = false;
    targetEl = item;
  }

  if (!targetEl && items.length) {
    targetIndex = items.length;
    before = false;
    targetEl = items[items.length - 1];
  }

  placePlaceholder(targetEl, before);
});

tabListEl.addEventListener("drop", (e) => {
  e.preventDefault();
  const draggedId = e.dataTransfer.getData("text/plain");
  const insertIdx = getPlaceholderInsertIndex();
  removePlaceholder();
  if (!draggedId || insertIdx === -1) return;

  const fromIdx = tabs.findIndex((t) => t.id === draggedId);
  if (fromIdx === -1) return;

  const [moved] = tabs.splice(fromIdx, 1);
  let targetIdx = insertIdx;
  if (fromIdx < insertIdx) targetIdx -= 1;
  targetIdx = Math.max(0, Math.min(targetIdx, tabs.length));
  tabs.splice(targetIdx, 0, moved);
  persistIndex();
  renderTabs();
});

window.addEventListener("dragend", () => {
  removePlaceholder();
});

window.addEventListener("drop", (e) => {
  if (!document.getElementById("sidebar").contains(e.target)) {
    removePlaceholder();
  }
});

function renderTabs() {
  tabListEl.innerHTML = "";
  tabs.forEach((tab, index) => {
    const item = document.createElement("div");
    item.className = "tab-item" + (tab.id === activeId ? " active" : "");
    item.title = tab.title;
    item.draggable = true;

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
    renameBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openRenameDialog(tab);
    });

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-action-btn";
    closeBtn.title = "Close";
    closeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>';
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    actions.appendChild(renameBtn);
    actions.appendChild(closeBtn);

    item.appendChild(shortLabel);
    item.appendChild(label);
    item.appendChild(actions);
    item.addEventListener("click", () => switchTab(tab.id));

    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", tab.id);
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      removePlaceholder();
    });

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

function applyFont() {
  editor.style.fontFamily = fontFamily;
  editor.style.fontSize = `${(fontSize * zoomLevel) / 100}px`;
}

function applyZoom() {
  editor.style.fontSize = `${(fontSize * zoomLevel) / 100}px`;
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
  applyFont();
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
    const savedActiveTab = saved.find((tab) => tab.active);
    activeId = savedActiveTab?.id || tabs[tabs.length - 1].id;
  } else {
    createTab();
  }
  renderTabs();
  loadActiveIntoEditor();
  updateStatus();
  initTheme();
}

init();
