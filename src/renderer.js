let tabs = []; // { id, title, color, groupId, content, savedContent, filePath, encoding, eol, view, persistedDirty }
let groups = []; // { id, name, collapsed }
let activeId = null;
let wordWrap = true;
let statusBarVisible = true;
let zoomLevel = 100;
let fontFamily = "'Consolas', 'Courier New', monospace";
let fontSize = 14;
let ratioSelection = "4:5";
let themeMode = "system";
let saveTimer = null;
let pendingDraftTab = null;
let enteringTabId = null;
const closingTabIds = new Set();
const isWindows = window.api.platform === "win32";
const defaultEol = isWindows ? "crlf" : "lf";
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
document.body.classList.toggle("windows-titlebar", isWindows);
document.body.classList.add(`platform-${window.api.platform}`);

const editor = document.getElementById("editor");
const editorArea = document.getElementById("editor-area");
const sidebar = document.getElementById("sidebar");
const tabListEl = document.getElementById("tab-list");
const newTabBtn = document.getElementById("new-tab-btn-bottom");
const newGroupBtn = document.getElementById("new-group-btn");
const statusPosition = document.getElementById("status-position");
const statusWords = document.getElementById("status-words");
const statusCount = document.getElementById("status-count");
const statusWrap = document.getElementById("status-wrap");
const statusZoom = document.getElementById("status-zoom");
const statusEol = document.getElementById("status-eol");
const statusEncoding = document.getElementById("status-encoding");
const statusBar = document.getElementById("status-bar");
const findControls = document.getElementById("find-controls");
const topbar = document.querySelector(".topbar");
const documentTitle = document.getElementById("document-title");
const documentTitleText = document.getElementById("document-title-text");
const documentTitleDirty = document.getElementById("document-title-dirty");
const documentTitleInput = document.getElementById("document-title-input");
const documentTitleActions = document.getElementById("document-title-actions");
const dropOverlay = document.getElementById("drop-overlay");
const toast = document.getElementById("toast");
const printArea = document.getElementById("print-area");
let editingDocumentTitle = false;
let documentTitleTargetId = null;

newTabBtn.addEventListener("click", () => {
  createTab();
});

newGroupBtn.addEventListener("click", promptNewGroup);

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function samePath(a, b) {
  return isWindows ? a.toLowerCase() === b.toLowerCase() : a === b;
}

// =========================================================
// SETTINGS
// =========================================================

let settingsTimer = null;
let pendingSettings = {};

function saveSetting(partial) {
  Object.assign(pendingSettings, partial);
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(flushSettings, 250);
}

function flushSettings() {
  clearTimeout(settingsTimer);
  if (!Object.keys(pendingSettings).length) return;
  window.api.updateSettings(pendingSettings);
  pendingSettings = {};
}

// =========================================================
// TAB BADGES
// =========================================================
//
// Each tab shows a badge with its title's initials. The badge colour is
// picked once when the tab is created (whichever palette colour is used
// least) and saved with the tab, so renaming changes only the letters.

const TAB_COLORS = [
  "#3b5bdb", // blue
  "#0b7285", // teal
  "#2b8a3e", // green
  "#c2410c", // rust
  "#c92a2a", // red
  "#a61e4d", // berry
  "#6741d9", // violet
  "#495057", // slate
];

const PAGE_ICON =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg>';

const RENAME_ICON =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>';

const CHEVRON_ICON =
  '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

function pickTabColor() {
  const counts = TAB_COLORS.map(
    (_, i) => tabs.filter((t) => t.color === i).length,
  );
  const fewest = Math.min(...counts);
  const choices = counts
    .map((count, i) => (count === fewest ? i : -1))
    .filter((i) => i !== -1);

  return choices[Math.floor(Math.random() * choices.length)];
}

function isUntitled(title) {
  return title.trim().toLowerCase() === "untitled";
}

// "Meeting Notes" -> "MN", "Groceries" -> "GR", "todo-list" -> "TL".
function getInitials(title) {
  const lettersOf = (word) =>
    Array.from(word).filter((ch) => /[\p{L}\p{N}]/u.test(ch));
  const words = title
    .trim()
    .split(/[\s_.-]+/)
    .map(lettersOf)
    .filter((letters) => letters.length);

  const initials =
    words.length >= 2 ? words[0][0] + words[1][0] : (words[0] || []).slice(0, 2).join("");

  return (initials || Array.from(title.trim()).slice(0, 2).join("")).toUpperCase();
}

// =========================================================
// TAB GROUPS
// =========================================================
//
// A group is a named section of the rail. Each tab stores which group it is
// in (or null), and the tabs array is kept in display order: ungrouped tabs
// first, then each group's tabs, so Ctrl+Tab follows what the rail shows.

function saveGroups() {
  saveSetting({ groups });
}

function sortTabsByGroup() {
  const rank = (tab) => groups.findIndex((g) => g.id === tab.groupId);

  tabs.sort((a, b) => rank(a) - rank(b));
}

function promptNewGroup() {
  openNameDialog("Group name:", "", createGroup);
}

function createGroup(name) {
  if (!name.trim()) return;

  groups.push({ id: uid(), name: name.trim(), collapsed: false });

  saveGroups();
  renderTabs({ revealActive: false });
  tabListEl.lastElementChild.scrollIntoView({ block: "nearest" });
}

function renameGroup(group, name) {
  if (!name.trim()) return;

  group.name = name.trim();

  saveGroups();
  renderTabs({ revealActive: false });
}

function toggleGroup(group) {
  group.collapsed = !group.collapsed;

  saveGroups();
  renderTabs({ revealActive: false });
}

// Deleting a group never closes its tabs; they just become ungrouped.
function deleteGroup(group) {
  tabs.forEach((tab) => {
    if (tab.groupId === group.id) tab.groupId = null;
  });
  groups = groups.filter((g) => g !== group);

  sortTabsByGroup();
  saveGroups();
  persistIndex();
  renderTabs();
}

function moveGroup(group, toIndex) {
  groups = groups.filter((g) => g !== group);
  groups.splice(toIndex, 0, group);

  sortTabsByGroup();
  saveGroups();
  persistIndex();
  renderTabs({ revealActive: false });
}

// Unfolds the tab's group if needed. Returns true when the rail must redraw.
function revealTabGroup(tab) {
  const group = groups.find((g) => g.id === tab.groupId);

  if (!group || !group.collapsed) return false;

  group.collapsed = false;
  saveGroups();

  return true;
}

// Marks the header of the active tab's group, so a folded group still shows
// that the open tab lives inside it.
function updateGroupHighlight() {
  const groupId = getActiveTab()?.groupId;

  tabListEl.querySelectorAll(".group-header").forEach((header) => {
    header.classList.toggle("has-active", header.dataset.groupId === groupId);
  });
}

function createGroupHeader(group, tabCount) {
  const header = document.createElement("div");

  header.className = "group-header";
  header.classList.toggle("collapsed", group.collapsed);
  header.dataset.groupId = group.id;
  header.title = group.name;

  const chevron = document.createElement("span");
  chevron.className = "group-chevron";
  chevron.innerHTML = CHEVRON_ICON;

  const name = document.createElement("span");
  name.className = "group-name";
  name.textContent = group.name;

  const count = document.createElement("span");
  count.className = "group-count";
  count.textContent = tabCount;

  const actions = document.createElement("span");
  actions.className = "tab-actions";

  const renameBtn = document.createElement("button");
  renameBtn.className = "tab-action-btn";
  renameBtn.title = "Rename group";
  renameBtn.innerHTML = RENAME_ICON;
  renameBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openNameDialog("Group name:", group.name, (value) => renameGroup(group, value));
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "tab-action-btn";
  deleteBtn.title = "Delete group (keeps its tabs)";
  deleteBtn.innerHTML = CLOSE_ICON;
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteGroup(group);
  });

  actions.append(renameBtn, deleteBtn);
  header.append(chevron, name, count, actions);
  header.addEventListener("click", () => toggleGroup(group));
  header.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;

    pendingDragState = {
      group,
      item: header,
      startX: e.clientX,
      startY: e.clientY,
    };
  });

  return header;
}

// =========================================================
// TABS AND PERSISTENCE
// =========================================================

// A file tab is dirty when it differs from what is on disk. An untitled tab
// only lives in StackPad's drafts, so any text in it counts as unsaved.
function isDirty(tab) {
  return tab.filePath
    ? tab.content !== tab.savedContent
    : tab.content.length > 0;
}

function buildIndex() {
  return tabs.map((t, i) => ({
    id: t.id,
    title: t.title,
    color: t.color,
    group: t.groupId,
    filePath: t.filePath || null,
    encoding: t.encoding,
    eol: t.eol,
    dirty: isDirty(t),
    order: i,
    active: t.id === activeId,
  }));
}

function persistIndex() {
  const index = buildIndex();
  tabs.forEach((t, i) => {
    t.persistedDirty = index[i].dirty;
  });

  window.api.saveIndex(index);
}

function scheduleDraftSave(tab) {
  if (pendingDraftTab && pendingDraftTab !== tab) flushPendingDraft();

  pendingDraftTab = tab;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushPendingDraft, 400);
}

function flushPendingDraft() {
  clearTimeout(saveTimer);
  if (!pendingDraftTab) return;

  window.api.saveDraft(pendingDraftTab.id, pendingDraftTab.content);
  pendingDraftTab = null;
}

// Last-chance save when the window closes: the draft debounce may still be
// waiting, so write synchronously before the page goes away.
window.addEventListener("beforeunload", () => {
  const tab = getActiveTab();
  if (tab) tab.content = editor.value;

  clearTimeout(saveTimer);
  const drafts = [];
  if (pendingDraftTab) drafts.push(pendingDraftTab);
  if (tab && tab !== pendingDraftTab) drafts.push(tab);
  pendingDraftTab = null;

  clearTimeout(settingsTimer);
  window.api.flushSync({
    index: buildIndex(),
    drafts: drafts.map(({ id, content }) => ({ id, content })),
    settings: pendingSettings,
  });
});

function updateDirtyState(tab) {
  const dirty = isDirty(tab);
  const item = tabListEl.querySelector(`.tab-item[data-id="${tab.id}"]`);

  if (item) item.classList.toggle("dirty", dirty);
  if (tab.id === activeId) documentTitleDirty.hidden = !dirty;
  if (dirty !== tab.persistedDirty) persistIndex();
}

function createTab(opts = {}) {
  flushCurrentEditorContent();

  const tab = {
    id: uid(),
    title: opts.title || "Untitled",
    color: pickTabColor(),
    groupId: getActiveTab()?.groupId ?? null,
    content: opts.content || "",
    savedContent: opts.savedContent ?? null,
    filePath: opts.filePath || null,
    encoding: opts.encoding || "utf-8",
    eol: opts.eol || defaultEol,
  };

  tabs.push(tab);
  sortTabsByGroup();
  revealTabGroup(tab);
  activeId = tab.id;
  enteringTabId = tab.id;

  persistIndex();

  if (tab.content) {
    window.api.saveDraft(tab.id, tab.content);
  }

  renderTabs();
  loadActiveIntoEditor();
  onActiveTabChanged();

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

  if (revealTabGroup(getActiveTab())) {
    renderTabs();
  } else {
    // Only the highlight moves, so update classes instead of rebuilding the
    // list (which would replay every tab's entrance animation).
    tabListEl.querySelectorAll(".tab-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.id === id);
      if (item.dataset.id === id) item.scrollIntoView({ block: "nearest" });
    });
    updateGroupHighlight();
  }
  updateDocumentTitle();
  loadActiveIntoEditor();

  onActiveTabChanged();
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
  tab.view = {
    start: editor.selectionStart,
    end: editor.selectionEnd,
    scrollTop: editor.scrollTop,
  };

  if (pendingDraftTab === tab) pendingDraftTab = null;
  window.api.saveDraft(tab.id, tab.content);
}

function loadActiveIntoEditor() {
  const tab = getActiveTab();

  editor.value = tab ? tab.content : "";

  const view = tab && tab.view;
  editor.setSelectionRange(view ? view.start : 0, view ? view.end : 0);
  editor.scrollTop = view ? view.scrollTop : 0;

  countsDirty = true;
  replayAnimation(editor, "switching");
  editor.focus();

  updateStatus();
}

function replayAnimation(el, className) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

// =========================================================
// DIALOG (themed replacement for window.confirm / alert)
// =========================================================

const confirmDialog = document.getElementById("confirm-dialog");
const confirmMessage = document.getElementById("confirm-message");
const confirmActions = document.getElementById("confirm-actions");
const confirmForm = document.getElementById("confirm-form");

confirmForm.addEventListener("submit", (e) => e.preventDefault());

// buttons: [{ label, value, primary }]. Escape resolves with the last value.
function showDialog({ message, buttons }) {
  return new Promise((resolve) => {
    const cancelValue = buttons[buttons.length - 1].value;
    let settled = false;

    function finish(value) {
      if (settled) return;
      settled = true;
      confirmDialog.removeEventListener("close", onClose);
      resolve(value);
      if (confirmDialog.open) confirmDialog.close();
    }

    function onClose() {
      finish(cancelValue);
    }

    confirmMessage.textContent = message;
    confirmActions.replaceChildren();

    buttons.forEach(({ label, value, primary }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      if (primary) btn.className = "primary-btn";
      btn.addEventListener("click", () => finish(value));
      confirmActions.appendChild(btn);
    });

    confirmDialog.addEventListener("close", onClose);
    confirmDialog.showModal();
    (confirmActions.querySelector(".primary-btn") || confirmActions.lastElementChild).focus();
  });
}

function showError(message) {
  return showDialog({
    message,
    buttons: [{ label: "OK", value: "ok", primary: true }],
  });
}

let toastTimer = null;

function showToast(message) {
  toast.textContent = message;
  replayAnimation(toast, "visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1800);
}

// =========================================================
// CLOSE / RENAME TABS
// =========================================================

function animateTabOut(id) {
  const item = tabListEl.querySelector(`.tab-item[data-id="${id}"]`);

  if (!item || reducedMotion.matches) return Promise.resolve();

  item.classList.add("closing");

  return new Promise((resolve) => {
    item.addEventListener("animationend", resolve, { once: true });
    setTimeout(resolve, 260);
  });
}

async function closeTab(id) {
  const tab = tabs.find((t) => t.id === id);

  if (!tab || closingTabIds.has(id)) return;

  if (tab.id === activeId) tab.content = editor.value;

  closingTabIds.add(id);

  try {
    if (isDirty(tab)) {
      const choice = await showDialog({
        message: `Do you want to save changes to “${tab.title}”?`,
        buttons: [
          { label: "Save", value: "save", primary: true },
          { label: "Don't Save", value: "discard" },
          { label: "Cancel", value: "cancel" },
        ],
      });

      if (choice === "cancel") return;
      if (choice === "save" && !(await saveTab(tab))) return;
    }

    await animateTabOut(id);

    const idx = tabs.findIndex((t) => t.id === id);

    if (idx === -1) return;

    tabs.splice(idx, 1);

    if (pendingDraftTab === tab) {
      clearTimeout(saveTimer);
      pendingDraftTab = null;
    }

    window.api.deleteNote(id);

    if (tabs.length === 0) {
      activeId = null;
      createTab();
      return;
    }

    if (activeId === id) {
      // Stay in the same group when a neighbour allows it.
      const nextActive =
        [tabs[idx - 1], tabs[idx]].find((t) => t && t.groupId === tab.groupId) ||
        tabs[Math.max(0, idx - 1)];

      activeId = nextActive.id;
      revealTabGroup(nextActive);

      loadActiveIntoEditor();
      onActiveTabChanged();
    }

    persistIndex();
    renderTabs();
  } finally {
    closingTabIds.delete(id);
  }
}

function renameTab(id, newTitle) {
  const tab = tabs.find((t) => t.id === id);

  if (!tab) return;

  tab.title = newTitle.trim() || "Untitled";

  persistIndex();
  renderTabs();
}

function updateDocumentTitle() {
  const activeTab = getActiveTab();
  documentTitleText.textContent = activeTab ? activeTab.title : "";
  documentTitleDirty.hidden = !activeTab || !isDirty(activeTab);
  documentTitle.hidden = !activeTab;
}

function startDocumentTitleEdit() {
  const activeTab = getActiveTab();
  if (!activeTab || editingDocumentTitle || !findControls.hidden) return;

  editingDocumentTitle = true;
  documentTitleTargetId = activeTab.id;
  documentTitleInput.value = activeTab.title;
  documentTitle.classList.add("editing");
  documentTitleText.hidden = true;
  documentTitleDirty.hidden = true;
  documentTitleInput.hidden = false;
  documentTitleActions.hidden = false;
  documentTitleInput.focus();
  documentTitleInput.select();
}

function finishDocumentTitleEdit(save) {
  if (!editingDocumentTitle) return;

  const title = documentTitleInput.value;
  const targetId = documentTitleTargetId;

  editingDocumentTitle = false;
  documentTitleTargetId = null;
  documentTitle.classList.remove("editing");
  documentTitleInput.hidden = true;
  documentTitleActions.hidden = true;
  documentTitleText.hidden = false;

  if (save && targetId) {
    renameTab(targetId, title);
  } else {
    updateDocumentTitle();
  }
}

documentTitleText.addEventListener("dblclick", startDocumentTitleEdit);
document
  .getElementById("document-title-confirm")
  .addEventListener("click", () => finishDocumentTitleEdit(true));
document
  .getElementById("document-title-cancel")
  .addEventListener("click", () => finishDocumentTitleEdit(false));
documentTitleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    finishDocumentTitleEdit(true);
  } else if (event.key === "Escape") {
    event.preventDefault();
    finishDocumentTitleEdit(false);
  }
});

// =========================================================
// DRAG AND DROP TAB REORDERING
// =========================================================

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
    });
}

function placePlaceholder(referenceEl, before) {
  const ph = ensurePlaceholder();

  const samePosition =
    lastPlaceholderAnchor === referenceEl && lastPlaceholderBefore === before;

  if (samePosition) return;

  lastPlaceholderAnchor = referenceEl;
  lastPlaceholderBefore = before;

  clearSplitClasses();

  if (referenceEl) {
    tabListEl.insertBefore(ph, before ? referenceEl : referenceEl.nextSibling);
    referenceEl.classList.add(before ? "drag-split-before" : "drag-split-after");
  } else {
    tabListEl.appendChild(ph);
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

// Where the placeholder sits decides the drop: under a group header or a
// grouped tab joins that group; above every header means ungrouped.
function getDropTarget() {
  if (!dropPlaceholder || !dropPlaceholder.parentElement) return null;

  let prev = dropPlaceholder.previousElementSibling;

  while (prev && prev.matches(".dragging, .group-empty")) {
    prev = prev.previousElementSibling;
  }

  if (!prev) return { groupId: null, afterTabId: null };

  if (prev.classList.contains("group-header")) {
    return { groupId: prev.dataset.groupId, afterTabId: null };
  }

  const after = tabs.find((t) => t.id === prev.dataset.id);

  return { groupId: after.groupId, afterTabId: after.id };
}

// How many of the other groups sit above the placeholder.
function getGroupDropIndex() {
  const children = Array.from(tabListEl.children);

  return children
    .slice(0, children.indexOf(dropPlaceholder))
    .filter((el) => el.matches(".group-header:not(.dragging)")).length;
}

// A dragged group can only land between groups, never among ungrouped tabs
// or inside another group, so only the other headers are drop positions.
function updateGroupPlaceholder(clientY) {
  const headers = tabListEl.querySelectorAll(".group-header:not(.dragging)");

  for (const header of headers) {
    const rect = header.getBoundingClientRect();

    if (clientY < rect.top + rect.height / 2) {
      placePlaceholder(header, true);
      return;
    }
  }

  placePlaceholder(null, false);
}

function updatePlaceholder(clientY) {
  if (customDragState && customDragState.group) {
    updateGroupPlaceholder(clientY);
    return;
  }

  const items = Array.from(
    tabListEl.querySelectorAll(".tab-item:not(.dragging), .group-header"),
  );

  if (!items.length) {
    placePlaceholder(null, false);
    return;
  }

  let targetEl = items[items.length - 1];
  let before = false;

  for (const item of items) {
    const rect = item.getBoundingClientRect();

    if (clientY < rect.top + rect.height / 2) {
      targetEl = item;
      before = true;
      break;
    }
  }

  placePlaceholder(targetEl, before);
}

let customDragState = null;
let pendingDragState = null;

const DRAG_SCROLL_ZONE = 36; // px from the list's top or bottom edge
const DRAG_SCROLL_MAX_SPEED = 12; // px per frame, reached at the very edge

function clampToTabList(clientY) {
  const { top, bottom } = tabListEl.getBoundingClientRect();

  return Math.max(top, Math.min(clientY, bottom));
}

// Scrolls the rail while a dragged item is held near its top or bottom edge,
// faster the closer it gets. Stops by itself when the drag ends.
function autoScrollDuringDrag() {
  if (!customDragState) return;

  const { top, bottom } = tabListEl.getBoundingClientRect();
  const y = clampToTabList(customDragState.lastY);
  const depth =
    y - top < DRAG_SCROLL_ZONE
      ? y - top - DRAG_SCROLL_ZONE
      : DRAG_SCROLL_ZONE - (bottom - y) > 0
        ? DRAG_SCROLL_ZONE - (bottom - y)
        : 0;

  if (depth) {
    const before = tabListEl.scrollTop;
    const speed = (depth / DRAG_SCROLL_ZONE) * DRAG_SCROLL_MAX_SPEED;

    tabListEl.scrollTop += speed < 0 ? Math.floor(speed) : Math.ceil(speed);

    if (tabListEl.scrollTop !== before) updatePlaceholder(y);
  }

  requestAnimationFrame(autoScrollDuringDrag);
}

function startCustomDrag(state) {
  const { item, tab, group, pointerEvent } = state;
  const rect = item.getBoundingClientRect();
  const preview = item.cloneNode(true);

  item.classList.add("dragging");

  // A group travels as just its header while it is being moved.
  if (group) {
    let member = item.nextElementSibling;

    while (member && !member.classList.contains("group-header")) {
      member.hidden = true;
      member = member.nextElementSibling;
    }
  }

  document.body.classList.add("tab-dragging");
  preview.classList.add("tab-drag-preview");
  preview.classList.remove("active", "entering");
  preview.style.left = `${rect.left}px`;
  preview.style.top = `${rect.top}px`;
  preview.style.width = `${rect.width}px`;
  document.body.appendChild(preview);

  customDragState = {
    tabId: tab && tab.id,
    group,
    item,
    preview,
    grabOffsetY: pointerEvent.clientY - rect.top,
    railLeft: rect.left,
    railWidth: rect.width,
    lastY: pointerEvent.clientY,
  };

  pendingDragState = null;
  updatePlaceholder(pointerEvent.clientY);
  requestAnimationFrame(autoScrollDuringDrag);
}

function finishCustomDrag() {
  if (!customDragState) return;

  const { tabId, group, item, preview } = customDragState;
  const target = group ? getGroupDropIndex() : getDropTarget();

  item.classList.remove("dragging");
  document.body.classList.remove("tab-dragging");
  preview.remove();
  customDragState = null;
  removePlaceholder();

  if (group) {
    moveGroup(group, target);
    return;
  }

  if (!target) return;

  const fromIdx = tabs.findIndex((t) => t.id === tabId);

  if (fromIdx === -1) return;

  const [moved] = tabs.splice(fromIdx, 1);

  moved.groupId = target.groupId;

  let targetIdx = 0;

  if (target.afterTabId) {
    targetIdx = tabs.findIndex((t) => t.id === target.afterTabId) + 1;
  } else if (target.groupId) {
    targetIdx = tabs.findIndex((t) => t.groupId === target.groupId);
    if (targetIdx === -1) targetIdx = tabs.length;
  }

  tabs.splice(targetIdx, 0, moved);
  sortTabsByGroup();

  persistIndex();
  renderTabs({ revealActive: false });
}

window.addEventListener("pointermove", (e) => {
  if (pendingDragState) {
    const movedX = e.clientX - pendingDragState.startX;
    const movedY = e.clientY - pendingDragState.startY;

    if (Math.hypot(movedX, movedY) >= 6) {
      startCustomDrag({
        ...pendingDragState,
        pointerEvent: e,
      });
    }
  }

  if (!customDragState) return;

  customDragState.lastY = e.clientY;

  const { item, preview, grabOffsetY, railLeft, railWidth } = customDragState;
  const listRect = tabListEl.getBoundingClientRect();
  const previewHeight = item.getBoundingClientRect().height;
  const top = Math.max(
    listRect.top,
    Math.min(e.clientY - grabOffsetY, listRect.bottom - previewHeight),
  );

  preview.style.left = `${railLeft}px`;
  preview.style.top = `${top}px`;
  preview.style.width = `${railWidth}px`;

  updatePlaceholder(clampToTabList(e.clientY));
});

window.addEventListener("pointerup", () => {
  pendingDragState = null;
  finishCustomDrag();
});
window.addEventListener("pointercancel", () => {
  pendingDragState = null;
  finishCustomDrag();
});

// =========================================================
// RENDER TABS
// =========================================================

// A rebuild while the rail is open shouldn't replay its opening animation.
sidebar.addEventListener("pointerleave", () => {
  tabListEl.classList.remove("no-intro");
});

function renderTabs({ revealActive = true } = {}) {
  const scrollTop = tabListEl.scrollTop;

  tabListEl.replaceChildren();
  tabListEl.classList.toggle("no-intro", sidebar.matches(":hover"));

  const appendTab = (tab) => {
    const item = document.createElement("div");

    item.className = "tab-item";
    item.classList.toggle("active", tab.id === activeId);
    item.classList.toggle("dirty", isDirty(tab));
    item.classList.toggle("entering", tab.id === enteringTabId);
    item.dataset.id = tab.id;
    item.title = tab.filePath || tab.title;

    const badge = document.createElement("span");
    badge.className = "tab-badge";
    badge.style.backgroundColor = TAB_COLORS[tab.color];
    if (isUntitled(tab.title)) {
      badge.innerHTML = PAGE_ICON;
    } else {
      badge.textContent = getInitials(tab.title);
    }

    const label = document.createElement("span");
    label.className = "tab-title";
    label.textContent = tab.title;

    const actions = document.createElement("span");
    actions.className = "tab-actions";

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-action-btn";
    closeBtn.title = "Close";
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    actions.append(closeBtn);
    item.append(badge, label, actions);

    item.addEventListener("click", () => {
      switchTab(tab.id);
    });

    // Pointer capture is deliberately not used here: it retargets clicks to
    // the row, which used to swallow the double-click-to-rename gesture.
    item.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button")) return;

      pendingDragState = {
        tab,
        item,
        startX: e.clientX,
        startY: e.clientY,
      };
    });

    item.addEventListener("dblclick", (e) => {
      if (e.target.closest("button")) return;

      openRenameDialog(tab);
    });

    tabListEl.appendChild(item);
  };

  tabs.filter((tab) => !tab.groupId).forEach(appendTab);

  groups.forEach((group) => {
    const members = tabs.filter((tab) => tab.groupId === group.id);

    tabListEl.appendChild(createGroupHeader(group, members.length));

    if (group.collapsed) return;

    if (!members.length) {
      const hint = document.createElement("div");

      hint.className = "group-empty";
      hint.textContent = "Drag tabs here";
      tabListEl.appendChild(hint);
    }

    members.forEach(appendTab);
  });

  enteringTabId = null;

  updateGroupHighlight();

  tabListEl.scrollTop = scrollTop;

  if (revealActive) {
    const activeItem = tabListEl.querySelector(".tab-item.active");
    if (activeItem) activeItem.scrollIntoView({ block: "nearest" });
  }

  updateDocumentTitle();
}

// =========================================================
// RENAME
// =========================================================

const renameDialog = document.getElementById("rename-dialog");

const renameLabel = document.getElementById("rename-label");

const renameInput = document.getElementById("rename-input");

let onRenameConfirm = null;

function openNameDialog(label, value, onConfirm) {
  if (renameDialog.open) return;

  onRenameConfirm = onConfirm;

  renameLabel.textContent = label;

  renameInput.value = value;

  renameDialog.showModal();

  renameInput.select();
}

function openRenameDialog(tab) {
  openNameDialog("Tab name:", tab.title, (value) => renameTab(tab.id, value));
}

function confirmRename() {
  if (onRenameConfirm) onRenameConfirm(renameInput.value);

  renameDialog.close();
}

document.getElementById("rename-close-btn").addEventListener("click", () => {
  renameDialog.close();
});

document.getElementById("rename-form").addEventListener("submit", (e) => {
  e.preventDefault();

  confirmRename();
});

// =========================================================
// FIND / REPLACE
// =========================================================
//
// Find and Replace share one search: the same term (both "Find" inputs are
// kept in sync), the same options and the same list of matches. Navigation
// always moves relative to the editor's selection, so Find Next continues
// from wherever you clicked or from the match you just replaced.

const findForm = document.getElementById("find-form");
const findInput = document.getElementById("find-input");
const findStatus = document.getElementById("find-status");
const replaceForm = document.getElementById("replace-form");
const replaceFindInput = document.getElementById("replace-find-input");
const replaceWithInput = document.getElementById("replace-with-input");
const replaceStatus = document.getElementById("replace-status");

const findOptions = { matchCase: false, wholeWord: false };
let findMode = null; // "find" | "replace" | null (closed)
let findMatches = []; // [{ start, end }]
let currentFindMatch = -1;
let findAnchor = 0; // where incremental search starts looking from

function activeFindInput() {
  return findMode === "replace" ? replaceFindInput : findInput;
}

function activeFindStatus() {
  return findMode === "replace" ? replaceStatus : findStatus;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A regex (rather than lower-casing both strings) keeps match offsets exact
// even for characters whose lower-case form has a different length.
function getMatches(term, text = editor.value) {
  if (!term) return [];

  let source = escapeRegExp(term);

  if (findOptions.wholeWord) {
    source = `(?<![\\p{L}\\p{N}_])${source}(?![\\p{L}\\p{N}_])`;
  }

  const pattern = new RegExp(source, findOptions.matchCase ? "gu" : "giu");

  return Array.from(text.matchAll(pattern), (m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }));
}

function refreshMatches() {
  findMatches = getMatches(activeFindInput().value);
}

function updateFindStatus() {
  const status = activeFindStatus();

  if (!activeFindInput().value) {
    status.textContent = "";
  } else if (!findMatches.length) {
    status.textContent = "No matches";
  } else if (currentFindMatch === -1) {
    status.textContent = `${findMatches.length}`;
  } else {
    status.textContent = `${currentFindMatch + 1} of ${findMatches.length}`;
  }
}

// ---------------------------------------------------------
// FIND HIGHLIGHT
// ---------------------------------------------------------
//
// A match can visually wrap across two or more lines when word wrap
// splits it. The match is rendered into a hidden mirror of the editor
// (same font, padding, width, wrapping) inside a <span>, and
// span.getClientRects() returns one rect per visual line -- one
// highlight box is drawn per rect. The rects are in content
// coordinates, so they are cached and only re-measured when the
// layout changes (resize, zoom, font, wrap), not on every scroll.

let activeHighlightRange = null; // { start, end } of the currently shown match
let highlightRects = [];
const highlightPool = [];

function ensureHighlightPool(count) {
  while (highlightPool.length < count) {
    const el = document.createElement("div");

    el.className = "find-highlight";

    editorArea.appendChild(el);

    highlightPool.push(el);
  }

  highlightPool.forEach((el, i) => {
    el.style.display = i < count ? "block" : "none";
  });
}

function getMatchRects(start, end) {
  const style = getComputedStyle(editor);

  const mirror = document.createElement("div");

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.boxSizing = "border-box";
  mirror.style.width = `${editor.clientWidth}px`;
  mirror.style.height = "auto";
  mirror.style.whiteSpace = editor.classList.contains("nowrap")
    ? "pre"
    : "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflowWrap = "break-word";

  [
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "lineHeight",
    "letterSpacing",
    "wordSpacing",
    "textIndent",
    "tabSize",
  ].forEach((prop) => {
    mirror.style[prop] = style[prop];
  });

  mirror.appendChild(document.createTextNode(editor.value.slice(0, start)));

  const markSpan = document.createElement("span");
  markSpan.textContent = editor.value.slice(start, end) || "\u200b";
  mirror.appendChild(markSpan);

  mirror.appendChild(document.createTextNode(editor.value.slice(end)));

  document.body.appendChild(mirror);

  const mirrorRect = mirror.getBoundingClientRect();
  const clientRects = Array.from(markSpan.getClientRects());
  const fallbackHeight = parseFloat(style.lineHeight) || 18;
  const sourceRects = clientRects.length
    ? clientRects
    : [markSpan.getBoundingClientRect()];

  const rects = sourceRects.map((r) => ({
    top: r.top - mirrorRect.top,
    left: r.left - mirrorRect.left,
    width: Math.max(r.width, 2),
    height: r.height || fallbackHeight,
  }));

  document.body.removeChild(mirror);

  return rects;
}

function drawHighlightRects() {
  ensureHighlightPool(highlightRects.length);

  highlightRects.forEach((rect, i) => {
    const el = highlightPool[i];

    el.style.top = `${rect.top - editor.scrollTop}px`;
    el.style.left = `${rect.left - editor.scrollLeft}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
  });
}

function hideFindHighlight() {
  activeHighlightRange = null;
  highlightRects = [];

  highlightPool.forEach((el) => {
    el.style.display = "none";
  });
}

function remeasureHighlight() {
  if (!activeHighlightRange) return;

  highlightRects = getMatchRects(
    activeHighlightRange.start,
    activeHighlightRange.end,
  );
  drawHighlightRects();
}

editor.addEventListener("scroll", () => {
  if (activeHighlightRange) drawHighlightRects();
});

editor.addEventListener("transitionend", (event) => {
  if (event.propertyName === "font-size") remeasureHighlight();
});

// ---------------------------------------------------------
// REVEAL A MATCH IN THE EDITOR
// ---------------------------------------------------------

function revealMatchInEditor(start, end) {
  editor.setSelectionRange(start, end);

  activeHighlightRange = { start, end };
  highlightRects = getMatchRects(start, end);

  const first = highlightRects[0];
  const last = highlightRects[highlightRects.length - 1];
  const margin = Math.min(48, editor.clientHeight / 4);

  // Only scroll when the match is out of view, so stepping through
  // nearby matches doesn't make the page jump around.
  if (
    first.top < editor.scrollTop + margin ||
    last.top + last.height > editor.scrollTop + editor.clientHeight - margin
  ) {
    editor.scrollTop = Math.max(
      0,
      first.top - editor.clientHeight / 2 + first.height / 2,
    );
  }

  if (
    first.left < editor.scrollLeft + margin ||
    first.left + first.width > editor.scrollLeft + editor.clientWidth - margin
  ) {
    editor.scrollLeft = Math.max(0, first.left - editor.clientWidth / 2);
  }

  drawHighlightRects();
  highlightPool.slice(0, highlightRects.length).forEach((el) => {
    replayAnimation(el, "pulse");
  });
}

function revealFindMatch(matchIndex) {
  currentFindMatch = matchIndex;

  const { start, end } = findMatches[matchIndex];

  revealMatchInEditor(start, end);
  updateFindStatus();

  // Keep typing/Enter flowing into the find box after clicking ↑ / ↓.
  if (findMode && document.activeElement !== editor) {
    activeFindInput().focus();
  }
}

function noMatchFound() {
  currentFindMatch = -1;
  hideFindHighlight();
  updateFindStatus();

  const input = activeFindInput();
  if (findMode && input.value) replayAnimation(input, "shake");
}

// ---------------------------------------------------------
// NAVIGATION
// ---------------------------------------------------------

function goToMatch(direction) {
  refreshMatches();

  if (!findMatches.length) {
    noMatchFound();
    return;
  }

  let index;

  if (direction < 0) {
    const selStart = editor.selectionStart;
    index = findMatches.findLastIndex((m) => m.start < selStart);
    if (index === -1) index = findMatches.length - 1;
  } else {
    const selEnd = editor.selectionEnd;
    const selStart = editor.selectionStart;
    index = findMatches.findIndex(
      (m) => m.start >= selEnd && !(m.start === selStart && m.end === selEnd),
    );
    if (index === -1) index = 0;
  }

  revealFindMatch(index);
}

// While typing, jump to the first match at or after where the search
// started, so the results follow the term without skipping ahead.
function revealNearestMatch() {
  refreshMatches();

  if (!findMatches.length) {
    noMatchFound();
    return;
  }

  let index = findMatches.findIndex((m) => m.start >= findAnchor);
  if (index === -1) index = 0;

  revealFindMatch(index);
}

function findNext() {
  if (!activeFindInput().value) {
    openFindBar("find");
    return;
  }

  goToMatch(1);
}

function findPrevious() {
  if (!activeFindInput().value) {
    openFindBar("find");
    return;
  }

  goToMatch(-1);
}

// ---------------------------------------------------------
// OPEN / CLOSE
// ---------------------------------------------------------

function getSingleLineSelection() {
  const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd);
  return selected && !selected.includes("\n") ? selected : "";
}

function openFindBar(mode) {
  finishDocumentTitleEdit(false);

  const wasOpen = Boolean(findMode);
  const selected = wasOpen ? "" : getSingleLineSelection();

  findMode = mode;
  findControls.hidden = false;
  findForm.hidden = mode !== "find";
  replaceForm.hidden = mode !== "replace";
  topbar.classList.add("find-open");

  const input = activeFindInput();
  if (selected) setFindTerm(selected);

  if (!wasOpen) findAnchor = editor.selectionStart;

  input.focus();
  input.select();

  if (input.value && !wasOpen) {
    revealNearestMatch();
  } else {
    refreshMatches();
    currentFindMatch = activeHighlightRange
      ? findMatches.findIndex((m) => m.start === activeHighlightRange.start)
      : -1;
    updateFindStatus();
  }
}

function closeFindBar() {
  if (!findMode) return;

  findMode = null;
  findControls.hidden = true;
  topbar.classList.remove("find-open");
  currentFindMatch = -1;
  findStatus.textContent = "";
  replaceStatus.textContent = "";
  hideFindHighlight();
  editor.focus();
}

function setFindTerm(value) {
  findInput.value = value;
  replaceFindInput.value = value;
}

// Text changed underneath the search: recount, but don't move the caret.
function onEditorContentChanged() {
  hideFindHighlight();

  if (!findMode) return;

  refreshMatches();
  currentFindMatch = -1;
  updateFindStatus();
}

function onActiveTabChanged() {
  hideFindHighlight();
  currentFindMatch = -1;

  if (!findMode) return;

  findAnchor = 0;
  refreshMatches();
  updateFindStatus();
}

// ---------------------------------------------------------
// FIND INPUTS, OPTIONS AND BUTTONS
// ---------------------------------------------------------

[findInput, replaceFindInput].forEach((inputEl) => {
  inputEl.addEventListener("input", () => {
    setFindTerm(inputEl.value);

    if (inputEl.value) {
      revealNearestMatch();
    } else {
      findMatches = [];
      currentFindMatch = -1;
      hideFindHighlight();
      updateFindStatus();
    }
  });
});

document.querySelectorAll("[data-find-option]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const option = btn.dataset.findOption;
    findOptions[option] = !findOptions[option];

    document
      .querySelectorAll(`[data-find-option="${option}"]`)
      .forEach((el) => el.setAttribute("aria-pressed", String(findOptions[option])));

    findAnchor = activeHighlightRange ? activeHighlightRange.start : editor.selectionStart;

    if (activeFindInput().value) {
      revealNearestMatch();
    }

    activeFindInput().focus();
  });
});

document.getElementById("find-next-btn").addEventListener("click", () => goToMatch(1));
document.getElementById("find-prev-btn").addEventListener("click", () => goToMatch(-1));
document.getElementById("find-close-btn").addEventListener("click", closeFindBar);
document.getElementById("show-replace-btn").addEventListener("click", () => openFindBar("replace"));

document.getElementById("replace-next-btn").addEventListener("click", () => goToMatch(1));
document.getElementById("replace-prev-btn").addEventListener("click", () => goToMatch(-1));
document.getElementById("replace-one-btn").addEventListener("click", replaceOne);
document.getElementById("replace-all-btn").addEventListener("click", replaceAll);
document.getElementById("replace-close-btn").addEventListener("click", closeFindBar);

// Enter = next match, Shift+Enter = previous, Escape = close, in every
// find/replace input, so both panels behave the same way.
[findInput, replaceFindInput, replaceWithInput].forEach((inputEl) => {
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();

      if (inputEl === replaceWithInput && (event.ctrlKey || event.metaKey)) {
        replaceAll();
      } else if (inputEl === replaceWithInput && !event.shiftKey) {
        replaceOne();
      } else {
        goToMatch(event.shiftKey ? -1 : 1);
      }

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeFindBar();
    }
  });
});

findForm.addEventListener("submit", (event) => event.preventDefault());
replaceForm.addEventListener("submit", (event) => event.preventDefault());

// ---------------------------------------------------------
// REPLACE
// ---------------------------------------------------------

// Edits go through execCommand so they land on the editor's undo stack
// (Ctrl+Z works) and fire the normal "input" event (dirty dot, draft save).
function replaceEditorRange(start, end, text) {
  if (start === end && !text) return;

  const scrollTop = editor.scrollTop;
  const returnFocus = document.activeElement;

  editor.focus();
  editor.setSelectionRange(start, end);

  if (text) {
    document.execCommand("insertText", false, text);
  } else {
    document.execCommand("delete");
  }

  editor.scrollTop = scrollTop;

  if (returnFocus && returnFocus !== editor && returnFocus !== document.body) {
    returnFocus.focus();
  }
}

function replaceOne() {
  if (!replaceFindInput.value) return;

  refreshMatches();

  const { selectionStart, selectionEnd } = editor;
  const selectedIsMatch = findMatches.some(
    (m) => m.start === selectionStart && m.end === selectionEnd,
  );

  if (selectedIsMatch) {
    const replacement = replaceWithInput.value;

    replaceEditorRange(selectionStart, selectionEnd, replacement);

    const caret = selectionStart + replacement.length;
    editor.setSelectionRange(caret, caret);
  }

  goToMatch(1);
}

function replaceAll() {
  const term = replaceFindInput.value;

  if (!term) return;

  const matches = getMatches(term);

  if (!matches.length) {
    findMatches = [];
    noMatchFound();
    return;
  }

  const value = editor.value;
  const replacement = replaceWithInput.value;
  let result = "";
  let last = 0;

  matches.forEach((m) => {
    result += value.slice(last, m.start) + replacement;
    last = m.end;
  });

  result += value.slice(last);

  replaceEditorRange(0, value.length, result);

  const caret = matches[0].start;
  editor.setSelectionRange(caret, caret);

  hideFindHighlight();
  replaceStatus.textContent = `Replaced ${matches.length}`;
}

// =========================================================
// GO TO
// =========================================================

const gotoDialog = document.getElementById("goto-dialog");

const gotoInput = document.getElementById("goto-input");

function currentLineNumber() {
  return editor.value.slice(0, editor.selectionStart).split("\n").length;
}

function openGoTo() {
  gotoInput.max = editor.value.split("\n").length;
  gotoInput.value = currentLineNumber();

  gotoDialog.showModal();

  gotoInput.select();
}

function confirmGoTo() {
  const lines = editor.value.split("\n");
  const lineNum = Math.min(parseInt(gotoInput.value, 10), lines.length);

  gotoDialog.close();

  if (!lineNum || lineNum < 1) return;

  let idx = 0;

  for (let i = 0; i < lineNum - 1; i++) {
    idx += lines[i].length + 1;
  }

  // Blur + focus makes the textarea scroll the caret into view.
  editor.blur();
  editor.setSelectionRange(idx, idx);
  editor.focus();

  updateStatus();
}

document.getElementById("goto-close-btn").addEventListener("click", () => {
  gotoDialog.close();
});

document.getElementById("goto-form").addEventListener("submit", (e) => {
  e.preventDefault();

  confirmGoTo();
});

// =========================================================
// FONT AND ZOOM
// =========================================================

const fontDialog = document.getElementById("font-dialog");

const fontFamilySelect = document.getElementById("font-family-select");

const fontSizeInput = document.getElementById("font-size-input");

function openFontDialog() {
  fontFamilySelect.value = fontFamily;

  fontSizeInput.value = fontSize;

  fontDialog.showModal();
}

function confirmFontDialog() {
  fontFamily = fontFamilySelect.value;

  fontSize = Math.min(72, Math.max(8, parseInt(fontSizeInput.value, 10) || 14));

  applyFont();
  saveSetting({ fontFamily, fontSize });

  fontDialog.close();
}

document.getElementById("font-close-btn").addEventListener("click", () => {
  fontDialog.close();
});

document.getElementById("font-form").addEventListener("submit", (e) => {
  e.preventDefault();

  confirmFontDialog();
});

function applyFont() {
  editor.style.fontFamily = fontFamily;

  editor.style.fontSize = `${(fontSize * zoomLevel) / 100}px`;

  remeasureHighlight();
}

function applyZoom() {
  editor.style.fontSize = `${(fontSize * zoomLevel) / 100}px`;

  saveSetting({ zoom: zoomLevel });
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

window.addEventListener(
  "wheel",
  (event) => {
    if (!event.ctrlKey && !event.metaKey) return;

    event.preventDefault();
    if (event.deltaY < 0) {
      zoomIn();
    } else if (event.deltaY > 0) {
      zoomOut();
    }
  },
  { passive: false },
);

// =========================================================
// WORD WRAP / STATUS BAR
// =========================================================

function setWordWrap(value) {
  wordWrap = value;

  editor.classList.toggle("nowrap", !wordWrap);
  saveSetting({ wordWrap });
  syncAppMenuChecks();
  remeasureHighlight();

  updateStatus();
}

function setStatusBarVisible(value) {
  statusBarVisible = value;

  statusBar.classList.toggle("hidden", !statusBarVisible);
  document.body.classList.toggle("status-bar-hidden", !statusBarVisible);
  saveSetting({ statusBar: statusBarVisible });
  syncAppMenuChecks();
  remeasureHighlight();
}

function syncAppMenuChecks() {
  const checkedActions = new Set([
    ...(wordWrap ? ["word-wrap"] : []),
    ...(statusBarVisible ? ["status-bar"] : []),
    `theme-${themeMode}`,
  ]);

  document.querySelectorAll(".app-menu-popup [data-action]").forEach((item) => {
    const check = item.querySelector(".menu-check");
    if (check) {
      check.textContent = checkedActions.has(item.dataset.action) ? "✓" : "";
    }
  });
}

// =========================================================
// STATUS
// =========================================================

const ENCODING_LABELS = {
  "utf-8": "UTF-8",
  "utf-8-bom": "UTF-8 with BOM",
  "utf-16le": "UTF-16 LE",
  "utf-16be": "UTF-16 BE",
  "windows-1252": "ANSI",
};

let countsDirty = true;
let cachedWords = 0;

function updateStatus() {
  const value = editor.value;
  const position = editor.selectionStart || 0;
  // lastIndexOf treats a negative start as 0, so position 0 is special-cased.
  const lineStart = position === 0 ? 0 : value.lastIndexOf("\n", position - 1) + 1;
  let line = 1;

  for (let i = value.indexOf("\n"); i !== -1 && i < position; i = value.indexOf("\n", i + 1)) {
    line++;
  }

  statusPosition.textContent = `Ln ${line}, Col ${position - lineStart + 1}`;

  if (countsDirty) {
    cachedWords = (value.match(/\S+/g) || []).length;
    countsDirty = false;
  }

  const charCount = value.length;

  statusWords.textContent = `${cachedWords.toLocaleString()} ${
    cachedWords === 1 ? "word" : "words"
  }`;
  statusCount.textContent = `${charCount.toLocaleString()} ${
    charCount === 1 ? "character" : "characters"
  }`;
  statusWrap.textContent = wordWrap ? "Word Wrap" : "No Wrap";
  statusZoom.textContent = `${zoomLevel}%`;

  const tab = getActiveTab();
  const eol = tab ? tab.eol : defaultEol;
  statusEol.textContent = eol === "lf" ? "LF" : "CRLF";
  statusEol.title = eol === "lf" ? "Unix line endings (LF)" : "Windows line endings (CRLF)";
  statusEncoding.textContent = ENCODING_LABELS[tab ? tab.encoding : "utf-8"] || "UTF-8";
}

editor.addEventListener("input", () => {
  const tab = getActiveTab();

  if (!tab) return;

  tab.content = editor.value;
  countsDirty = true;

  scheduleDraftSave(tab);
  updateStatus();
  updateDirtyState(tab);
  onEditorContentChanged();
});

editor.addEventListener("click", updateStatus);
editor.addEventListener("keyup", updateStatus);
editor.addEventListener("select", updateStatus);

// clientWidth/clientHeight exclude the scrollbars, so anything past them is
// a scrollbar. Skipped while a button is held so dragging the thumb keeps
// its cursor even if the pointer drifts off it.
editor.addEventListener("pointermove", (event) => {
  if (event.buttons) return;

  const rect = editor.getBoundingClientRect();

  editor.classList.toggle(
    "over-scrollbar",
    event.clientX - rect.left >= editor.clientLeft + editor.clientWidth ||
      event.clientY - rect.top >= editor.clientTop + editor.clientHeight,
  );
});

editor.addEventListener("pointerleave", () => {
  editor.classList.remove("over-scrollbar");
});

// Clicking or typing in the editor takes over from the find highlight, and
// becomes the new starting point for the next search.
editor.addEventListener("pointerdown", () => {
  if (!editor.classList.contains("over-scrollbar")) hideFindHighlight();
});
editor.addEventListener("pointerup", () => {
  findAnchor = editor.selectionStart;
});

editor.addEventListener("keydown", (event) => {
  if (!["Shift", "Control", "Alt", "Meta"].includes(event.key)) {
    hideFindHighlight();
  }

  if (event.key === "Escape" && findMode) {
    event.preventDefault();
    closeFindBar();
    return;
  }

  if (event.key !== "Tab" || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  event.preventDefault();

  document.execCommand("insertText", false, "\t");
});

// =========================================================
// RATIO
// =========================================================

function syncScreenMenu() {
  document.querySelectorAll("#app-menu-bar [data-ratio]").forEach((option) => {
    const check = option.querySelector(".menu-check");
    if (check) check.textContent = option.dataset.ratio === ratioSelection ? "✓" : "";
  });
}

function setRatio(ratio) {
  ratioSelection = ratio;

  syncScreenMenu();

  window.api.setWindowRatio(ratio);
}

window.api.onRatioChanged((ratio) => {
  ratioSelection = ratio;
  syncScreenMenu();
});

// =========================================================
// FILE OPEN / SAVE
// =========================================================

async function openFileResults(results) {
  const errors = [];

  for (const result of results || []) {
    if (result.error) {
      errors.push(`${result.filePath}\n${result.error}`);
      continue;
    }

    const existing = tabs.find(
      (t) => t.filePath && samePath(t.filePath, result.filePath),
    );

    if (existing) {
      switchTab(existing.id);
      continue;
    }

    const fileFields = {
      title: result.name,
      content: result.content,
      savedContent: result.content,
      filePath: result.filePath,
      encoding: result.encoding,
      eol: result.eol,
    };

    // Like Notepad, an untouched blank tab is reused instead of left behind.
    const active = getActiveTab();
    if (active && !active.filePath && !editor.value && isUntitled(active.title)) {
      Object.assign(active, fileFields, { view: null });
      persistIndex();
      window.api.saveDraft(active.id, active.content);
      renderTabs();
      loadActiveIntoEditor();
      onActiveTabChanged();
    } else {
      createTab(fileFields);
    }
  }

  if (errors.length) {
    await showError(`Couldn't open:\n\n${errors.join("\n\n")}`);
  }
}

async function doOpen() {
  openFileResults(await window.api.openFile());
}

// Returns true once the tab's content is safely written to a file.
async function saveTab(tab, forceSaveAs = false) {
  if (tab.id === activeId) tab.content = editor.value;

  const content = tab.content;
  const request = { content, encoding: tab.encoding, eol: tab.eol };
  const saveAs = forceSaveAs || !tab.filePath;

  const result = saveAs
    ? await window.api.saveFileAs({
        ...request,
        defaultName: tab.title,
        defaultPath: tab.filePath,
      })
    : await window.api.saveFile({ ...request, filePath: tab.filePath });

  if (!result) return false;

  if (result.error) {
    await showError(`Couldn't save to ${result.filePath}\n\n${result.error}`);
    return false;
  }

  tab.filePath = result.filePath;
  tab.encoding = result.encoding;
  tab.savedContent = content;
  if (saveAs) tab.title = result.name;

  window.api.saveDraft(tab.id, content);
  persistIndex();
  renderTabs();
  updateStatus();
  showToast(`Saved ${result.filePath.split(/[\\/]/).pop()}`);

  return true;
}

function doSave() {
  const tab = getActiveTab();
  if (tab) saveTab(tab);
}

function doSaveAs() {
  const tab = getActiveTab();
  if (tab) saveTab(tab, true);
}

window.api.onOpenFiles((files) => openFileResults(files));

// Dropping files anywhere on the window opens them as tabs.
let dragDepth = 0;

function hasFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

document.addEventListener(
  "dragenter",
  (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth++;
    dropOverlay.classList.add("visible");
  },
  true,
);

document.addEventListener(
  "dragover",
  (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  },
  true,
);

document.addEventListener(
  "dragleave",
  (event) => {
    if (!hasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropOverlay.classList.remove("visible");
  },
  true,
);

document.addEventListener(
  "drop",
  async (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth = 0;
    dropOverlay.classList.remove("visible");

    const paths = Array.from(event.dataTransfer.files)
      .map((file) => window.api.getPathForFile(file))
      .filter(Boolean);

    if (paths.length) openFileResults(await window.api.openPaths(paths));
  },
  true,
);

// =========================================================
// PRINT
// =========================================================

// The editor is a scrolling textarea, so printing the page would only show
// the visible lines. A print-only copy of the full text is printed instead.
function printActiveTab() {
  printArea.textContent = editor.value;
  printArea.style.fontFamily = fontFamily;
  printArea.style.fontSize = `${fontSize}px`;

  window.api.print();
}

// =========================================================
// TIME / DATE
// =========================================================

function insertTimeDate() {
  const now = new Date();

  const text = now.toLocaleTimeString() + " " + now.toLocaleDateString();

  editor.focus();

  document.execCommand("insertText", false, text);
}

// =========================================================
// THEME
// =========================================================

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

  window.api.setTitleBarTheme(shouldUseDark);
  saveSetting({ theme: themeMode });
  syncAppMenuChecks();
}

// =========================================================
// WINDOW RESIZE
// =========================================================

window.addEventListener("resize", remeasureHighlight);

// =========================================================
// MENU ACTIONS
// =========================================================

const appMenuBar = document.getElementById("app-menu-bar");

// The in-app menu takes focus when clicked, so edit commands are sent back
// to whichever text field was focused before (editor or a find box).
let lastFocusedField = editor;

document.addEventListener("focusin", (event) => {
  if (event.target.matches("textarea, input[type='text']")) {
    lastFocusedField = event.target;
  }
});

function closeAppMenus() {
  appMenuBar.querySelectorAll(".app-menu").forEach((menu) => {
    menu.classList.remove("open");
    menu.querySelector(".app-menu-trigger").setAttribute("aria-expanded", "false");
  });
}

appMenuBar.querySelectorAll(".app-menu-trigger").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const currentMenu = trigger.closest(".app-menu");
    const shouldOpen = !currentMenu.classList.contains("open");

    closeAppMenus();

    currentMenu.classList.toggle("open", shouldOpen);
    trigger.setAttribute("aria-expanded", String(shouldOpen));
  });

  // Once one menu is open, hovering the others switches to them.
  trigger.addEventListener("pointerenter", () => {
    const currentMenu = trigger.closest(".app-menu");
    const anotherOpen = appMenuBar.querySelector(".app-menu.open");

    if (anotherOpen && anotherOpen !== currentMenu) {
      closeAppMenus();
      currentMenu.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
    }
  });
});

appMenuBar.addEventListener("click", (event) => {
  const item = event.target.closest("button[data-action], button[data-ratio]");
  if (!item) return;

  if (item.hasAttribute("data-ratio")) {
    setRatio(item.dataset.ratio);
  } else {
    const { action } = item.dataset;
    if (
      ["undo", "redo", "cut", "copy", "paste", "delete", "select-all"].includes(
        action,
      )
    ) {
      const field =
        lastFocusedField && lastFocusedField.offsetParent !== null
          ? lastFocusedField
          : editor;
      field.focus();
      window.api.editAction(action);
    } else {
      let payload;
      if (action === "word-wrap") payload = !wordWrap;
      if (action === "status-bar") payload = !statusBarVisible;
      window.api.triggerMenuAction(action, payload);
    }
  }

  closeAppMenus();
});

document.addEventListener("click", (event) => {
  if (appMenuBar.contains(event.target)) return;
  closeAppMenus();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeAppMenus();
});

window.api.onMenuAction(({ action, payload }) => {
  switch (action) {
    case "new-tab":
      createTab();
      break;

    case "new-group":
      promptNewGroup();
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
      printActiveTab();
      break;

    case "time-date":
      insertTimeDate();
      break;

    case "find":
      openFindBar("find");
      break;

    case "find-next":
      findNext();
      break;

    case "find-previous":
      findPrevious();
      break;

    case "replace":
      openFindBar("replace");
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

    case "theme-light":
      setTheme("light");
      break;

    case "theme-dark":
      setTheme("dark");
      break;

    case "theme-system":
      setTheme("system");
      break;

    default:
      break;
  }
});

// =========================================================
// EDITOR KEYBOARD SHORTCUTS
// =========================================================

editor.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();

    openFindBar("find");

    return;
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

// =========================================================
// INITIALIZATION
// =========================================================

function applySettings(settings) {
  fontFamily = settings.fontFamily || fontFamily;
  fontSize = settings.fontSize || fontSize;
  zoomLevel = settings.zoom || zoomLevel;
  ratioSelection = settings.ratio || ratioSelection;
  groups = Array.isArray(settings.groups)
    ? settings.groups.filter((g) => g && g.id && g.name)
    : [];

  setTheme(settings.theme);
  setWordWrap(settings.wordWrap !== false);
  setStatusBarVisible(settings.statusBar !== false);
  applyFont();
  syncScreenMenu();

  // Applying saved values shouldn't write them straight back.
  clearTimeout(settingsTimer);
  pendingSettings = {};
}

async function init() {
  const [settings, saved] = await Promise.all([
    window.api.getSettings(),
    window.api.loadAllNotes(),
  ]);

  applySettings(settings || {});

  if (saved && saved.length > 0) {
    tabs = saved
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((t) => ({
        id: t.id,
        title: t.title || "Untitled",
        color: Number.isInteger(t.color) && TAB_COLORS[t.color] ? t.color : null,
        groupId: groups.some((g) => g.id === t.group) ? t.group : null,
        content: t.content || "",
        savedContent: t.savedContent ?? null,
        filePath: t.filePath || null,
        encoding: t.encoding || "utf-8",
        eol: t.eol || defaultEol,
        persistedDirty: t.dirty,
      }));

    sortTabsByGroup();

    // Tabs saved before badges existed get a colour now, saved right away.
    const uncolored = tabs.filter((tab) => tab.color === null);
    uncolored.forEach((tab) => {
      tab.color = pickTabColor();
    });

    const savedActiveTab = saved.find((tab) => tab.active);

    activeId = savedActiveTab?.id || tabs[tabs.length - 1].id;

    if (uncolored.length) persistIndex();
    renderTabs();
    loadActiveIntoEditor();
  } else {
    createTab();
  }

  await openFileResults(await window.api.takePendingFiles());

  window.api.appReady();

  // Transitions are switched on only after the window has painted, so the
  // saved theme and layout appear instantly instead of animating in. (A
  // timer rather than requestAnimationFrame, which is paused while hidden.)
  setTimeout(() => document.body.classList.add("ready"), 300);
}

init();
