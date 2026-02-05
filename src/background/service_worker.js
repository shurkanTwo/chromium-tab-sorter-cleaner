const TRACKER_STORAGE_KEY = "tabTimeTracker";

let state = {
  activeTabId: null,
  activeWindowId: null,
  lastActivatedAt: null,
  timeByTabId: {}
};

function nowMs() {
  return Date.now();
}

function loadState() {
  return chrome.storage.local.get([TRACKER_STORAGE_KEY]).then((data) => {
    if (data[TRACKER_STORAGE_KEY]) {
      state = { ...state, ...data[TRACKER_STORAGE_KEY] };
    }
  });
}

let loadStatePromise = null;

function ensureStateLoaded() {
  if (!loadStatePromise) {
    loadStatePromise = loadState();
  }
  return loadStatePromise;
}

function persistState() {
  return chrome.storage.local.set({
    [TRACKER_STORAGE_KEY]: state
  });
}

function commitActiveTime() {
  if (state.activeTabId == null || state.lastActivatedAt == null) return;
  const delta = nowMs() - state.lastActivatedAt;
  if (!Number.isFinite(delta) || delta <= 0) return;
  const current = state.timeByTabId[state.activeTabId] || 0;
  state.timeByTabId[state.activeTabId] = current + delta;
}

async function handleActivated(activeInfo) {
  commitActiveTime();
  state.activeTabId = activeInfo.tabId;
  state.activeWindowId = activeInfo.windowId;
  state.lastActivatedAt = nowMs();
  await persistState();
}

async function handleWindowFocus(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    commitActiveTime();
    state.activeTabId = null;
    state.activeWindowId = null;
    state.lastActivatedAt = null;
    await persistState();
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (!tab) return;
  commitActiveTime();
  state.activeTabId = tab.id;
  state.activeWindowId = windowId;
  state.lastActivatedAt = nowMs();
  await persistState();
}

async function handleRemoved(tabId) {
  commitActiveTime();
  delete state.timeByTabId[tabId];
  if (state.activeTabId === tabId) {
    state.activeTabId = null;
    state.activeWindowId = null;
    state.lastActivatedAt = null;
  }
  await persistState();
}

chrome.runtime.onInstalled.addListener(() => {
  ensureStateLoaded();
});

chrome.runtime.onStartup.addListener(() => {
  ensureStateLoaded();
});

async function openActionWindow(sourceTab) {
  const targetWindowId = sourceTab?.windowId ?? null;
  const url = chrome.runtime.getURL(
    targetWindowId != null
      ? `src/ui/action_window.html?target=${targetWindowId}`
      : "src/ui/action_window.html"
  );
  const windows = await chrome.windows.getAll({ populate: true });
  const existing = windows.find((win) =>
    win.tabs?.some((tab) => tab.url?.startsWith(chrome.runtime.getURL("src/ui/action_window.html")))
  );
  if (existing) {
    const tab = existing.tabs.find((t) =>
      t.url?.startsWith(chrome.runtime.getURL("src/ui/action_window.html"))
    );
    if (tab && tab.url !== url) {
      await chrome.tabs.update(tab.id, { url });
    }
    await chrome.windows.update(existing.id, { focused: true });
    return;
  }
  const width = 840;
  const height = 720;
  const lastFocused = await chrome.windows.getLastFocused();
  const left =
    Number.isFinite(lastFocused.left) && Number.isFinite(lastFocused.width)
      ? Math.round(lastFocused.left + (lastFocused.width - width) / 2)
      : undefined;
  const top =
    Number.isFinite(lastFocused.top) && Number.isFinite(lastFocused.height)
      ? Math.round(lastFocused.top + (lastFocused.height - height) / 2)
      : undefined;
  await chrome.windows.create({
    url,
    type: "popup",
    width,
    height,
    left,
    top
  });
}

chrome.action.onClicked.addListener((tab) => {
  openActionWindow(tab);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "_execute_action") {
    openActionWindow();
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  handleActivated(activeInfo);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  handleWindowFocus(windowId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  handleRemoved(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "getTabTimes") {
    commitActiveTime();
    persistState().then(() => {
      sendResponse({ timeByTabId: state.timeByTabId });
    });
    return true;
  }
  return undefined;
});

ensureStateLoaded();
