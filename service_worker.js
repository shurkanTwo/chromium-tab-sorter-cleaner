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
  loadState();
});

chrome.runtime.onStartup.addListener(() => {
  loadState();
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

loadState();
