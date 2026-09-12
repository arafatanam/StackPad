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

  if (tab.content) {
    window.api.saveDraft(tab.id, tab.content);
  }

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

  resetFindState();
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

// CONFIRM DIALOG (themed replacement for window.confirm)

const confirmDialog = document.getElementById("confirm-dialog");
const confirmMessage = document.getElementById("confirm-message");
const confirmYesBtn = document.getElementById("confirm-yes-btn");
const confirmNoBtn = document.getElementById("confirm-no-btn");
const confirmForm = document.getElementById("confirm-form");

function showConfirmDialog(message) {
  return new Promise((resolve) => {
    confirmMessage.textContent = message;

    let settled = false;

    function cleanup() {
      confirmYesBtn.removeEventListener("click", onYes);
      confirmNoBtn.removeEventListener("click", onNo);
      confirmDialog.removeEventListener("close", onClose);
      confirmForm.removeEventListener("submit", onSubmit);
    }

    function finish(result) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    function onYes() {
      finish(true);
      confirmDialog.close();
    }

    function onNo() {
      finish(false);
      confirmDialog.close();
    }

    function onClose() {
      finish(false);
    }

    function onSubmit(e) {
      e.preventDefault();
      onNo();
    }

    confirmYesBtn.addEventListener("click", onYes);
    confirmNoBtn.addEventListener("click", onNo);
    confirmDialog.addEventListener("close", onClose);
    confirmForm.addEventListener("submit", onSubmit);

    confirmDialog.showModal();
    confirmNoBtn.focus();
  });
}

async function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);

  if (idx === -1) return;

  const tab = tabs[idx];

  const hasWrittenContent =
    tab && tab.content && tab.content.trim().length > 0 && tab.dirty !== false;

  if (hasWrittenContent) {
    const shouldClose = await showConfirmDialog(
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

  resetFindState();
}

function renameTab(id, newTitle) {
  const tab = tabs.find((t) => t.id === id);

  if (!tab) return;

  tab.title = newTitle.trim() || "Untitled";

  persistIndex();
  renderTabs();
}

// DRAG AND DROP TAB REORDERING

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
      if (ph.parentElement) {
        ph.parentElement.removeChild(ph);
      }

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
  if (!dropPlaceholder || !dropPlaceholder.parentElement) {
    return -1;
  }

  const children = Array.from(tabListEl.children);

  const phIdx = children.indexOf(dropPlaceholder);

  if (phIdx === -1) return -1;

  let count = 0;

  for (let i = 0; i < phIdx; i++) {
    if (children[i].classList.contains("tab-item")) {
      count++;
    }
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

  if (!draggedId || insertIdx === -1) {
    return;
  }

  const fromIdx = tabs.findIndex((t) => t.id === draggedId);

  if (fromIdx === -1) return;

  const [moved] = tabs.splice(fromIdx, 1);

  let targetIdx = insertIdx;

  if (fromIdx < insertIdx) {
    targetIdx -= 1;
  }

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

// RENDER TABS

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

    item.addEventListener("click", () => {
      switchTab(tab.id);
    });

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

// RENAME

const renameDialog = document.getElementById("rename-dialog");

const renameInput = document.getElementById("rename-input");

let renameTargetId = null;

function openRenameDialog(tab) {
  renameTargetId = tab.id;

  renameInput.value = tab.title;

  renameDialog.showModal();

  renameInput.select();
}

function confirmRename() {
  if (renameTargetId) {
    renameTab(renameTargetId, renameInput.value);
  }

  renameDialog.close();
}

document
  .getElementById("rename-ok-btn")
  .addEventListener("click", confirmRename);

document.getElementById("rename-close-btn").addEventListener("click", () => {
  renameDialog.close();
});

document.getElementById("rename-form").addEventListener("submit", (e) => {
  e.preventDefault();

  confirmRename();
});

// FIND

const findDialog = document.getElementById("find-dialog");

const findForm = document.getElementById("find-form");

const findInput = document.getElementById("find-input");

const findStatus = document.getElementById("find-status");

const findNextBtn = document.getElementById("find-next-btn");

const findPrevBtn = document.getElementById("find-prev-btn");

const findCloseBtn = document.getElementById("find-close-btn");

// -------
// FIND STATE
// -------

let findMatches = [];
let currentFindMatch = -1;
let lastFindTerm = "";

// -------
// EXACT SEARCH
// -------

function getMatchIndices(term) {
  if (!term) return [];

  const value = editor.value.toLocaleLowerCase();

  const search = term.toLocaleLowerCase();

  const matches = [];

  let index = 0;

  while (index <= value.length - search.length) {
    const found = value.indexOf(search, index);

    if (found === -1) {
      break;
    }

    matches.push(found);

    index = found + search.length;
  }

  return matches;
}

// -------
// FIND HIGHLIGHT
// -------
//
// A match can visually wrap across two or more lines when word wrap
// splits it (e.g. searching "this and that" where "this and" ends
// one line and "that" starts the next). A single bounding box around
// the whole match would cover both lines' full combined height,
// which reads as one oversized, wrongly-spaced highlight.
//
// The fix: render the match into a hidden mirror of the editor (same
// font, padding, width, wrapping), wrap it in a <span>, then call
// span.getClientRects(). For text that wraps, this returns ONE rect
// PER VISUAL LINE the span occupies -- exactly the fragments we want
// to highlight. We then draw one highlight <div> per rect, pulled
// from a small reusable pool so we're not constantly creating and
// destroying DOM nodes as matches change.
//

let activeHighlightRange = null; // { start, end } of the currently shown match

const editorArea = document.getElementById("editor-area");

let highlightPool = [];

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

  // getClientRects() returns one DOMRect per visual line fragment of
  // the span -- this is the key to fixing multi-line matches.
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

function drawHighlightRects(rects) {
  ensureHighlightPool(rects.length);

  rects.forEach((rect, i) => {
    const el = highlightPool[i];

    el.style.top = `${rect.top - editor.scrollTop}px`;
    el.style.left = `${rect.left - editor.scrollLeft}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
    el.style.display = "block";
  });
}

function hideFindHighlight() {
  activeHighlightRange = null;

  highlightPool.forEach((el) => {
    el.style.display = "none";
  });
}

// Keep the highlight(s) aligned if the person manually scrolls the editor.
editor.addEventListener("scroll", () => {
  if (!activeHighlightRange) return;

  const rects = getMatchRects(
    activeHighlightRange.start,
    activeHighlightRange.end,
  );

  drawHighlightRects(rects);
});

// -------
// RESET FIND
// -------

function resetFindState() {
  findMatches = [];
  currentFindMatch = -1;
  lastFindTerm = "";

  if (findStatus) {
    findStatus.textContent = "";
  }

  hideFindHighlight();
}

// -------
// UPDATE FIND STATUS
// -------

function updateFindStatus() {
  const term = findInput.value;

  if (!term) {
    findStatus.textContent = "";

    return;
  }

  if (findMatches.length === 0) {
    findStatus.textContent = "No matches";

    return;
  }

  if (currentFindMatch === -1) {
    findStatus.textContent = `${findMatches.length} match${
      findMatches.length === 1 ? "" : "es"
    }`;

    return;
  }

  findStatus.textContent = `${currentFindMatch + 1} of ${findMatches.length}`;
}

// -------
// REFRESH FIND RESULTS
// -------

function refreshFindMatches(resetPosition = true) {
  const term = findInput.value;

  if (!term) {
    resetFindState();
    return;
  }

  const termChanged = term !== lastFindTerm;

  if (termChanged || resetPosition) {
    currentFindMatch = -1;
    hideFindHighlight();
  }

  lastFindTerm = term;

  findMatches = getMatchIndices(term);

  if (findMatches.length === 0) {
    currentFindMatch = -1;
    hideFindHighlight();
  }

  updateFindStatus();
}

// -------
// OPEN FIND / OPEN REPLACE
// -------

function openFind() {
  if (replaceDialog.open) {
    replaceDialog.close();
  }

  if (!findDialog.open) {
    findDialog.show();
  }

  if (editor.selectionStart !== editor.selectionEnd && !findInput.value) {
    findInput.value = editor.value
      .slice(editor.selectionStart, editor.selectionEnd)
      .trim();
  }

  refreshFindMatches(true);

  findInput.focus();

  findInput.select();
}

// -------
// REVEAL A MATCH IN THE EDITOR
// -------

function revealMatchInEditor(start, end, returnFocusEl) {
  editor.setSelectionRange(start, end);

  const rects = getMatchRects(start, end);

  const firstRect = rects[0];

  // Scroll deterministically -- this does not depend on the editor
  // being focused, so it works reliably every time.
  const scrollTarget =
    firstRect.top - editor.clientHeight / 2 + firstRect.height / 2;

  editor.scrollTop = Math.max(0, scrollTarget);

  // Draw a highlight box for every visual line the match spans.
  activeHighlightRange = { start, end };

  drawHighlightRects(rects);

  if (returnFocusEl) {
    returnFocusEl.focus();
  }
}

function revealFindMatch(matchIndex) {
  if (matchIndex < 0 || matchIndex >= findMatches.length) {
    return;
  }

  const term = findInput.value;

  const start = findMatches[matchIndex];

  const end = start + term.length;

  currentFindMatch = matchIndex;

  revealMatchInEditor(start, end, findInput);

  updateFindStatus();
}

// -------
// FIND NEXT
// -------

function findNext() {
  const term = findInput.value;

  if (!term) {
    refreshFindMatches(true);
    return;
  }

  findMatches = getMatchIndices(term);

  lastFindTerm = term;

  if (findMatches.length === 0) {
    currentFindMatch = -1;

    hideFindHighlight();

    updateFindStatus();

    return;
  }

  let nextIndex;

  if (currentFindMatch === -1) {
    nextIndex = 0;
  } else {
    nextIndex = currentFindMatch + 1;

    if (nextIndex >= findMatches.length) {
      nextIndex = 0;
    }
  }

  revealFindMatch(nextIndex);
}

// -------
// FIND PREVIOUS
// -------

function findPrevious() {
  const term = findInput.value;

  if (!term) {
    refreshFindMatches(true);
    return;
  }

  findMatches = getMatchIndices(term);

  lastFindTerm = term;

  if (findMatches.length === 0) {
    currentFindMatch = -1;

    hideFindHighlight();

    updateFindStatus();

    return;
  }

  let previousIndex;

  if (currentFindMatch === -1) {
    previousIndex = findMatches.length - 1;
  } else {
    previousIndex = currentFindMatch - 1;

    if (previousIndex < 0) {
      previousIndex = findMatches.length - 1;
    }
  }

  revealFindMatch(previousIndex);
}

// -------
// FIND INPUT
// -------

findInput.addEventListener("input", () => {
  refreshFindMatches(true);
});

// -------
// FIND BUTTONS
// -------

findNextBtn.addEventListener("click", () => {
  findNext();
});

findPrevBtn.addEventListener("click", () => {
  findPrevious();
});

findCloseBtn.addEventListener("click", () => {
  findDialog.close();

  resetFindState();
});

// -------
// FIND KEYBOARD
// -------

findInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();

    if (event.shiftKey) {
      findPrevious();
    } else {
      findNext();
    }

    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();

    findDialog.close();

    resetFindState();
  }
});

// -------
// FIND FORM
// -------

findForm.addEventListener("submit", (event) => {
  event.preventDefault();

  findNext();
});

// REPLACE

const replaceDialog = document.getElementById("replace-dialog");

const replaceFindInput = document.getElementById("replace-find-input");

const replaceWithInput = document.getElementById("replace-with-input");

const replaceStatus = document.getElementById("replace-status");

function openReplace() {
  if (findDialog.open) {
    findDialog.close();
    resetFindState();
  }

  if (!replaceDialog.open) {
    replaceDialog.show();
  }

  replaceFindInput.focus();
}

function replaceFindNext() {
  const term = replaceFindInput.value;

  if (!term) {
    replaceStatus.textContent = "";

    hideFindHighlight();

    return;
  }

  const matches = getMatchIndices(term);

  if (matches.length === 0) {
    replaceStatus.textContent = `Cannot find "${term}"`;

    hideFindHighlight();

    return;
  }

  const start = editor.selectionEnd || 0;

  let nextIdx = matches.find((i) => i >= start);

  if (nextIdx === undefined) {
    nextIdx = matches[0];
  }

  const matchNumber = matches.indexOf(nextIdx) + 1;

  revealMatchInEditor(nextIdx, nextIdx + term.length, replaceFindInput);

  replaceStatus.textContent = `Match ${matchNumber} of ${matches.length}`;
}

function replaceOne() {
  const term = replaceFindInput.value;

  const withText = replaceWithInput.value;

  if (!term) return;

  const selected = editor.value.slice(
    editor.selectionStart,
    editor.selectionEnd,
  );

  if (selected.toLowerCase() === term.toLowerCase()) {
    const before = editor.value.slice(0, editor.selectionStart);

    const after = editor.value.slice(editor.selectionEnd);

    editor.value = before + withText + after;

    const tab = getActiveTab();

    if (tab) {
      tab.content = editor.value;

      scheduleDraftSave(tab);
    }

    revealMatchInEditor(
      before.length,
      before.length + withText.length,
      replaceFindInput,
    );
  }

  replaceFindNext();
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAll() {
  const term = replaceFindInput.value;

  const withText = replaceWithInput.value;

  if (!term) return;

  const pattern = new RegExp(escapeRegExp(term), "gi");

  const count = (editor.value.match(pattern) || []).length;

  editor.value = editor.value.replace(pattern, withText);

  const tab = getActiveTab();

  if (tab) {
    tab.content = editor.value;

    scheduleDraftSave(tab);
  }

  updateStatus();

  hideFindHighlight();

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

document.getElementById("replace-close-btn").addEventListener("click", () => {
  replaceDialog.close();

  hideFindHighlight();
});

document.getElementById("replace-form").addEventListener("submit", (e) => {
  e.preventDefault();

  replaceFindNext();
});

// Mirror Find's keyboard behavior (Enter = next match, Escape =
// close) on both Replace inputs, so the two panels feel identical
// to use, not just identical to look at.
[replaceFindInput, replaceWithInput].forEach((inputEl) => {
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();

      replaceFindNext();

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();

      replaceDialog.close();

      hideFindHighlight();
    }
  });
});

// GO TO

const gotoDialog = document.getElementById("goto-dialog");

const gotoInput = document.getElementById("goto-input");

function openGoTo() {
  gotoDialog.showModal();

  gotoInput.focus();
}

function confirmGoTo() {
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
}

document.getElementById("goto-ok-btn").addEventListener("click", confirmGoTo);

document.getElementById("goto-close-btn").addEventListener("click", () => {
  gotoDialog.close();
});

document.getElementById("goto-form").addEventListener("submit", (e) => {
  e.preventDefault();

  confirmGoTo();
});

// FONT

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

  fontSize = parseInt(fontSizeInput.value, 10) || 14;

  applyFont();

  fontDialog.close();
}

document
  .getElementById("font-ok-btn")
  .addEventListener("click", confirmFontDialog);

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

// WORD WRAP / STATUS BAR

function setWordWrap(value) {
  wordWrap = value;

  editor.classList.toggle("nowrap", !wordWrap);

  updateStatus();
}

function setStatusBarVisible(value) {
  statusBarVisible = value;

  statusBar.classList.toggle("hidden", !statusBarVisible);
}

// STATUS

function updateStatus() {
  const position = editor.selectionStart || 0;

  const textBefore = editor.value.slice(0, position);

  const lines = textBefore.split("\n");

  const line = lines.length;

  const column = lines[lines.length - 1].length + 1;

  statusPosition.textContent = `Ln ${line}, Col ${column}`;

  const charCount = editor.value.length;

  statusCount.textContent = `${charCount} ${
    charCount === 1 ? "character" : "characters"
  }`;

  statusWrap.textContent = wordWrap ? "Word Wrap" : "No Wrap";

  statusZoom.textContent = `${zoomLevel}%`;
}

editor.addEventListener("input", () => {
  const tab = getActiveTab();

  if (!tab) return;

  tab.content = editor.value;

  tab.dirty = true;

  scheduleDraftSave(tab);

  updateStatus();

  if (findDialog.open && findInput.value) {
    refreshFindMatches(true);
  } else {
    hideFindHighlight();
  }

  renderTabs();
});

editor.addEventListener("click", updateStatus);

editor.addEventListener("keyup", updateStatus);

// RATIO

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

function setupCustomDropdown(trigger, menu, onSelect) {
  if (!trigger || !menu) return;

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();

    const parent = trigger.closest(".custom-select");

    const isOpen = parent.classList.contains("open");

    closeCustomDropdowns();

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

      const valueEl = trigger.querySelector(".select-value");

      if (valueEl) {
        valueEl.textContent = option.textContent.trim();
      }

      onSelect(option.dataset.value);
    });
  });
}

function closeCustomDropdowns() {
  document.querySelectorAll(".custom-select.open").forEach((element) => {
    element.classList.remove("open");

    const trigger = element.querySelector(".select-trigger");

    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
    }
  });
}

document.addEventListener("click", () => {
  closeCustomDropdowns();
});

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

// FILE OPEN / SAVE

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

// TIME / DATE

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

  if (tab) {
    tab.content = editor.value;

    scheduleDraftSave(tab);
  }

  updateStatus();
}

// RESPONSIVE / THEME

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

// WINDOW RESIZE

window.addEventListener("resize", () => {
  updateResponsiveMode();

  if (!suppressRatioClear) {
    clearRatioSelection();
  }
});

// MENU ACTIONS

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

// EDITOR KEYBOARD SHORTCUTS

editor.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();

    openFind();

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

// INITIALIZATION

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
        title: t.title || "Untitled",
        content: t.content || "",
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
