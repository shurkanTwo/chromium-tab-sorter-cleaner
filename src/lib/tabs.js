import { MAX_UNDO, UNDO_KEY, settings } from "./config.js";
import {
  elements,
  formatCount,
  formatDuration,
  renderTabs,
  reportError,
  setStatus,
  setUndoEnabled,
  setTargetWindowLabel
} from "./ui.js";
import { sleep } from "./utils.js";

const targetWindowIdParam = Number.parseInt(
  new URLSearchParams(window.location.search).get("target") || "",
  10
);
const hasTargetWindowId = Number.isFinite(targetWindowIdParam);
const undoStack = [];
let domainGroupingRunCount = 0;

function getUndoStorage() {
  if (chrome.storage && chrome.storage.session) return chrome.storage.session;
  return chrome.storage.local;
}

export async function getTargetWindowId() {
  if (hasTargetWindowId) return targetWindowIdParam;
  const current = await chrome.windows.getCurrent();
  return current.id;
}

export async function updateTargetWindowLabel() {
  const targetId = await getTargetWindowId();
  setTargetWindowLabel(targetId);
}

export async function focusTargetWindow() {
  try {
    const targetId = await getTargetWindowId();
    const currentWindow = await chrome.windows.getCurrent();
    await chrome.windows.update(targetId, { focused: true });
    await sleep(50);
    await chrome.windows.update(currentWindow.id, { focused: true });
  } catch (error) {
    reportError("focusTargetWindow", error);
  }
}

export async function getActiveTabId() {
  const windowId = await getTargetWindowId();
  const [tab] = await chrome.tabs.query({ windowId, active: true });
  return tab?.id ?? null;
}

export function isValidTabMeta(meta) {
  return Boolean(meta && meta.tab && Number.isFinite(meta.tab.id));
}

function isMissingTabError(error) {
  const message = (error?.message || String(error || "")).toLowerCase();
  return message.includes("no tab with id") || message.includes("unknown tab id");
}

export async function runIgnoringMissingTab(promise, context) {
  try {
    return await promise;
  } catch (error) {
    if (isMissingTabError(error)) return null;
    reportError(context, error);
    return null;
  }
}

export async function loadUndoStack() {
  const storage = getUndoStorage();
  const data = await storage.get([UNDO_KEY]);
  if (Array.isArray(data[UNDO_KEY])) {
    undoStack.splice(0, undoStack.length, ...data[UNDO_KEY]);
  }
  setUndoEnabled(undoStack.length > 0);
}

async function saveUndoStack() {
  const storage = getUndoStorage();
  await storage.set({ [UNDO_KEY]: undoStack });
}

async function fetchLastVisitedByUrl(urls) {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const results = new Map();
  const entries = await Promise.all(
    unique.map(async (url) => {
      const visits = await chrome.history.getVisits({ url });
      if (!visits || visits.length === 0) return [url, null];
      const last = visits.reduce((latest, visit) => {
        return visit.visitTime > latest.visitTime ? visit : latest;
      }, visits[0]);
      return [url, last.visitTime];
    })
  );
  for (const [url, lastVisited] of entries) {
    results.set(url, lastVisited);
  }
  return results;
}

export async function fetchLastVisitedBatch(tabs) {
  const byTabId = new Map();
  const fallbackUrls = [];
  const fallbackTabIdsByUrl = new Map();

  for (const tab of tabs) {
    if (!tab || !Number.isFinite(tab.id)) continue;
    const lastAccessed = Number(tab.lastAccessed);
    if (Number.isFinite(lastAccessed) && lastAccessed > 0) {
      byTabId.set(tab.id, lastAccessed);
      continue;
    }
    if (!tab.url) continue;
    fallbackUrls.push(tab.url);
    const list = fallbackTabIdsByUrl.get(tab.url) || [];
    list.push(tab.id);
    fallbackTabIdsByUrl.set(tab.url, list);
  }

  if (fallbackUrls.length > 0) {
    const byUrl = await fetchLastVisitedByUrl(fallbackUrls);
    for (const [url, tabIds] of fallbackTabIdsByUrl.entries()) {
      const fallbackTs = byUrl.get(url) || null;
      for (const tabId of tabIds) {
        byTabId.set(tabId, fallbackTs);
      }
    }
  }

  return byTabId;
}

export function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return "";
  }
}

export async function fetchTabsWithMeta() {
  const windowId = await getTargetWindowId();
  const [tabs, timeData] = await Promise.all([
    chrome.tabs.query({ windowId }),
    getTabTimes()
  ]);

  const timeByTabId = timeData?.timeByTabId || {};
  const lastVisitedByTabId = await fetchLastVisitedBatch(tabs);
  const includePinnedTabs = settings.includePinnedTabs === true;
  const withMeta = tabs
    .filter(
      (tab) =>
        tab &&
        Number.isFinite(tab.id) &&
        (includePinnedTabs || !tab.pinned)
    )
    .map((tab) => ({
      tab,
      lastVisited: lastVisitedByTabId.get(tab.id) || null,
      timeSpent: timeByTabId[tab.id] || 0,
      hostname: getHostname(tab.url)
    }));

  return withMeta;
}

export async function refresh() {
  const tabsWithMeta = await fetchTabsWithMeta();
  renderTabs(tabsWithMeta, (tabId) =>
    runIgnoringMissingTab(chrome.tabs.update(tabId, { active: true }), "tabs.update")
  );
}

function setUndoStackEnabled() {
  setUndoEnabled(undoStack.length > 0);
}

async function captureState() {
  const windowId = await getTargetWindowId();
  const [tabs, groups] = await Promise.all([
    chrome.tabs.query({ windowId }),
    chrome.tabGroups.query({ windowId })
  ]);

  return {
    windowId,
    capturedAt: Date.now(),
    tabs: tabs.map((tab) => ({
      id: tab.id,
      index: tab.index,
      groupId: tab.groupId,
      url: tab.url || "",
      title: tab.title || "",
      pinned: tab.pinned,
      active: tab.active
    })),
    groups: groups.map((group) => ({
      id: group.id,
      title: group.title || "",
      color: group.color || "",
      collapsed: group.collapsed
    }))
  };
}

async function restoreState(state) {
  if (!state) return;
  const windowId = await getTargetWindowId();
  const tabsNow = await chrome.tabs.query({ windowId });
  const tabsById = new Map(tabsNow.map((tab) => [tab.id, tab]));
  const desiredEntries = [];

  for (const entry of state.tabs) {
    let tab = tabsById.get(entry.id);
    if (!tab) {
      tab = await chrome.tabs.create({
        windowId,
        url: entry.url || "chrome://newtab",
        index: desiredEntries.length,
        pinned: entry.pinned,
        active: false
      });
      tabsById.set(tab.id, tab);
    } else if (tab.pinned !== entry.pinned) {
      await runIgnoringMissingTab(
        chrome.tabs.update(tab.id, { pinned: entry.pinned }),
        "tabs.update"
      );
    }
    desiredEntries.push({ entry, tabId: tab.id });
  }

  const idsToUngroup = desiredEntries
    .map((item) => item.tabId)
    .filter((id) => {
      const tab = tabsById.get(id);
      return tab && tab.groupId !== -1;
    });
  if (idsToUngroup.length > 0) {
    await runIgnoringMissingTab(chrome.tabs.ungroup(idsToUngroup), "tabs.ungroup");
  }

  for (let index = 0; index < desiredEntries.length; index += 1) {
    await runIgnoringMissingTab(
      chrome.tabs.move(desiredEntries[index].tabId, { index }),
      "tabs.move"
    );
  }

  const groupsByOldId = new Map();
  for (const item of desiredEntries) {
    const groupId = item.entry.groupId;
    if (groupId === -1) continue;
    const plan = groupsByOldId.get(groupId) || {
      tabIds: [],
      startIndex: item.entry.index
    };
    plan.tabIds.push(item.tabId);
    if (item.entry.index < plan.startIndex) {
      plan.startIndex = item.entry.index;
    }
    groupsByOldId.set(groupId, plan);
  }

  const groupMetaById = new Map(state.groups.map((group) => [group.id, group]));
  const groupPlans = Array.from(groupsByOldId.entries())
    .map(([oldGroupId, plan]) => ({
      oldGroupId,
      tabIds: plan.tabIds,
      startIndex: plan.startIndex
    }))
    .sort((a, b) => a.startIndex - b.startIndex);

  for (let i = groupPlans.length - 1; i >= 0; i -= 1) {
    const { oldGroupId, tabIds, startIndex } = groupPlans[i];
    const newGroupId = await runIgnoringMissingTab(
      chrome.tabs.group({
        tabIds,
        createProperties: { windowId }
      }),
      "tabs.group"
    );
    if (newGroupId == null) continue;
    try {
      await chrome.tabGroups.move(newGroupId, { index: startIndex });
    } catch (error) {
      reportError("tabGroups.move", error);
    }
    const meta = groupMetaById.get(oldGroupId);
    if (meta) {
      const updatePayload = {};
      if (meta.title) updatePayload.title = meta.title;
      if (meta.color) updatePayload.color = meta.color;
      if (typeof meta.collapsed === "boolean") {
        updatePayload.collapsed = meta.collapsed;
      }
      if (Object.keys(updatePayload).length > 0) {
        await runIgnoringMissingTab(
          chrome.tabGroups.update(newGroupId, updatePayload),
          "tabGroups.update"
        );
      }
    }
  }

  const activeEntry = desiredEntries.find((item) => item.entry.active);
  if (activeEntry) {
    await runIgnoringMissingTab(
      chrome.tabs.update(activeEntry.tabId, { active: true }),
      "tabs.update"
    );
  }

  await refresh();
}

export async function runWithUndo(action) {
  if (!action) return;
  try {
    if (!elements.undoActionButton) {
      await action();
      return;
    }
    const state = await captureState();
    undoStack.push(state);
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }
    setUndoStackEnabled();
    await saveUndoStack();
    await action();
  } catch (error) {
    reportError(action?.name || "action", error);
  }
}

export async function undoLastAction() {
  if (undoStack.length === 0) return;
  const state = undoStack.pop();
  setUndoStackEnabled();
  await saveUndoStack();
  await restoreState(state);
}

function getTabTimes() {
  return chrome.runtime.sendMessage({ type: "getTabTimes" });
}

export async function closeDuplicates() {
  const windowId = await getTargetWindowId();
  const tabs = await chrome.tabs.query({ windowId });
  const includePinnedTabs = settings.includePinnedTabs === true;
  const candidates = tabs.filter(
    (tab) => tab && (includePinnedTabs || !tab.pinned)
  );
  const seen = new Map();
  const toClose = [];

  candidates.forEach((tab) => {
    const url = tab.url;
    if (!url) return;
    if (seen.has(url)) {
      toClose.push(tab.id);
    } else {
      seen.set(url, tab.id);
    }
  });

  if (toClose.length > 0) {
    await chrome.tabs.remove(toClose);
  }

  if (toClose.length > 0) {
    setStatus(
      `Closed ${formatCount(toClose.length, "duplicate", "duplicates")} out of ${formatCount(
        candidates.length,
        "tab",
        "tabs"
      )}.`
    );
  } else {
    setStatus(
      `No duplicate tabs found in ${formatCount(candidates.length, "tab", "tabs")}.`
    );
  }
  await refresh();
}

export async function moveTabsInOrder(sorted) {
  const includePinnedTabs = settings.includePinnedTabs === true;
  const pinned = includePinnedTabs
    ? sorted.filter((meta) => meta?.tab?.pinned)
    : [];
  const unpinned = sorted.filter((meta) => meta?.tab && !meta.tab.pinned);

  for (let index = 0; index < pinned.length; index += 1) {
    const tab = pinned[index].tab;
    await runIgnoringMissingTab(chrome.tabs.move(tab.id, { index }), "tabs.move");
  }

  const pinnedCount = includePinnedTabs ? pinned.length : 0;
  for (let index = 0; index < unpinned.length; index += 1) {
    const tab = unpinned[index].tab;
    await runIgnoringMissingTab(
      chrome.tabs.move(tab.id, { index: pinnedCount + index }),
      "tabs.move"
    );
  }
}

export async function sortWithGroups(comparator, metaById) {
  const windowId = await getTargetWindowId();
  const tabs = await chrome.tabs.query({ windowId });
  const includePinnedTabs = settings.includePinnedTabs === true;
  const pinnedCount = tabs.filter((tab) => tab.pinned).length;
  const candidates = tabs.filter((tab) => !tab.pinned);

  if (includePinnedTabs) {
    const pinnedTabs = tabs.filter((tab) => tab.pinned);
    const fallbackMeta = (tab) => ({ tab, lastVisited: 0, timeSpent: 0, hostname: "" });
    const pinnedSorted = [...pinnedTabs].sort((a, b) =>
      comparator(metaById.get(a.id) || fallbackMeta(a), metaById.get(b.id) || fallbackMeta(b))
    );
    for (let index = 0; index < pinnedSorted.length; index += 1) {
      await runIgnoringMissingTab(
        chrome.tabs.move(pinnedSorted[index].id, { index }),
        "tabs.move"
      );
    }
  }
  const groupMap = new Map();
  const topLevel = [];

  for (const tab of candidates) {
    if (tab.groupId === -1) {
      topLevel.push(tab);
      continue;
    }
    const list = groupMap.get(tab.groupId) || [];
    list.push(tab);
    groupMap.set(tab.groupId, list);
  }

  const groupEntries = Array.from(groupMap.entries()).map(([groupId, list]) => {
    const sortedTabs = [...list].sort((a, b) =>
      comparator(metaById.get(a.id), metaById.get(b.id))
    );
    return { groupId, sortedTabs };
  });

  groupEntries.sort((a, b) => {
    const indexA = Math.min(...a.sortedTabs.map((tab) => tab.index));
    const indexB = Math.min(...b.sortedTabs.map((tab) => tab.index));
    return indexA - indexB;
  });

  for (const entry of groupEntries) {
    const startIndex = Math.min(...entry.sortedTabs.map((tab) => tab.index));
    for (let offset = 0; offset < entry.sortedTabs.length; offset += 1) {
      const tab = entry.sortedTabs[offset];
      await runIgnoringMissingTab(
        chrome.tabs.move(tab.id, { index: startIndex + offset }),
        "tabs.move"
      );
    }
  }

  const refreshed = await chrome.tabs.query({ windowId });
  const refreshedGroupMap = new Map();
  const refreshedTopLevel = [];

  for (const tab of refreshed) {
    if (tab.pinned) continue;
    if (tab.groupId === -1) {
      refreshedTopLevel.push(tab);
      continue;
    }
    const list = refreshedGroupMap.get(tab.groupId) || [];
    list.push(tab);
    refreshedGroupMap.set(tab.groupId, list);
  }

  const blocks = [];
  for (const tab of refreshedTopLevel) {
    blocks.push({ type: "tab", id: tab.id });
  }
  for (const [groupId, list] of refreshedGroupMap.entries()) {
    const sortedTabs = [...list].sort((a, b) =>
      comparator(metaById.get(a.id), metaById.get(b.id))
    );
    blocks.push({
      type: "group",
      id: groupId,
      size: sortedTabs.length,
      representative: metaById.get(sortedTabs[0]?.id) || null
    });
  }

  blocks.sort((a, b) => {
    const metaA = a.type === "tab" ? metaById.get(a.id) : a.representative;
    const metaB = b.type === "tab" ? metaById.get(b.id) : b.representative;
    if (!metaA && !metaB) return 0;
    if (!metaA) return 1;
    if (!metaB) return -1;
    return comparator(metaA, metaB);
  });

  let targetIndex = 0;
  for (const block of blocks) {
    if (block.type === "tab") {
      await runIgnoringMissingTab(
        chrome.tabs.move(block.id, { index: pinnedCount + targetIndex }),
        "tabs.move"
      );
      targetIndex += 1;
      continue;
    }
    await chrome.tabGroups.move(block.id, { index: pinnedCount + targetIndex });
    targetIndex += block.size || 0;
  }
}

export async function sortAlphabetically() {
  const tabsWithMeta = await fetchTabsWithMeta();
  const windowId = await getTargetWindowId();
  const tabs = await chrome.tabs.query({ windowId });
  const metaById = new Map(tabsWithMeta.map((meta) => [meta.tab.id, meta]));
  const comparator = (a, b) => {
    const titleA = (a.tab.title || a.tab.url || "").toLowerCase();
    const titleB = (b.tab.title || b.tab.url || "").toLowerCase();
    return titleA.localeCompare(titleB);
  };
  const sorted = [...tabsWithMeta].sort((a, b) => {
    const titleA = (a.tab.title || a.tab.url || "").toLowerCase();
    const titleB = (b.tab.title || b.tab.url || "").toLowerCase();
    return titleA.localeCompare(titleB);
  });

  if (tabs.some((tab) => tab.groupId !== -1)) {
    await sortWithGroups(comparator, metaById);
  } else {
    await moveTabsInOrder(sorted);
  }
  setStatus(`Sorted ${formatCount(tabsWithMeta.length, "tab", "tabs")} A-Z by title.`);
  await refresh();
}

export async function sortByLastVisited() {
  const tabsWithMeta = await fetchTabsWithMeta();
  const windowId = await getTargetWindowId();
  const tabs = await chrome.tabs.query({ windowId });
  const metaById = new Map(tabsWithMeta.map((meta) => [meta.tab.id, meta]));
  const descending =
    elements.lastVisitedOrderSelect?.value !== "asc";
  const comparator = (a, b) => {
    const timeA = a.lastVisited || 0;
    const timeB = b.lastVisited || 0;
    return descending ? timeB - timeA : timeA - timeB;
  };
  const sorted = [...tabsWithMeta].sort(comparator);

  if (tabs.some((tab) => tab.groupId !== -1)) {
    await sortWithGroups(comparator, metaById);
  } else {
    await moveTabsInOrder(sorted);
  }
  setStatus(
    `Sorted ${formatCount(
      tabsWithMeta.length,
      "tab",
      "tabs"
    )} by last visited (${descending ? "newest first" : "oldest first"}).`
  );
  await refresh();
}

function abbreviateDomain(hostname) {
  if (!hostname) return "";
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length === 0) return "";
  const letters = parts.map((part) => part[0]).join("");
  return letters.slice(0, 6).toUpperCase();
}

export async function groupByDomain() {
  const startedAt = Date.now();
  const runNumber = domainGroupingRunCount + 1;
  const tabsWithMeta = await fetchTabsWithMeta();
  const sorted = [...tabsWithMeta].sort((a, b) => {
    const hostA = a.hostname.toLowerCase();
    const hostB = b.hostname.toLowerCase();
    if (hostA === hostB) {
      const titleA = (a.tab.title || a.tab.url || "").toLowerCase();
      const titleB = (b.tab.title || b.tab.url || "").toLowerCase();
      return titleA.localeCompare(titleB);
    }
    return hostA.localeCompare(hostB);
  });

  await moveTabsInOrder(sorted);

  const windowId = await getTargetWindowId();
  const useNames = elements.nameGroupsToggle?.checked ?? false;
  const color = elements.groupColorSelect?.value || "";
  const collapseAfter = elements.collapseAfterGroupToggle?.checked ?? false;

  let currentHost = null;
  let currentGroupTabs = [];
  const plannedGroups = [];
  let groupsCreated = 0;
  let groupedTabs = 0;

  function finalizeGroup() {
    if (currentGroupTabs.length === 0) {
      currentGroupTabs = [];
      return;
    }
    plannedGroups.push({
      host: currentHost,
      tabIds: [...currentGroupTabs]
    });
    currentGroupTabs = [];
  }

  async function createGroup(plan) {
    const groupId = await runIgnoringMissingTab(
      chrome.tabs.group({
        tabIds: plan.tabIds,
        createProperties: { windowId }
      }),
      "tabs.group"
    );
    if (groupId == null) {
      return;
    }
    groupsCreated += 1;
    groupedTabs += plan.tabIds.length;
    const updatePayload = {};
    if (useNames && plan.host) {
      updatePayload.title = abbreviateDomain(plan.host);
    }
    if (color) updatePayload.color = color;
    if (collapseAfter) updatePayload.collapsed = true;
    if (Object.keys(updatePayload).length > 0) {
      await runIgnoringMissingTab(
        chrome.tabGroups.update(groupId, updatePayload),
        "tabGroups.update"
      );
    }
  }

  for (const meta of sorted) {
    const host = meta.hostname;
    if (!host) {
      finalizeGroup();
      currentHost = null;
      continue;
    }
    if (currentHost === null) {
      currentHost = host;
    }
    if (host !== currentHost) {
      finalizeGroup();
      currentHost = host;
    }
    currentGroupTabs.push(meta.tab.id);
  }
  finalizeGroup();

  for (let index = plannedGroups.length - 1; index >= 0; index -= 1) {
    await createGroup(plannedGroups[index]);
  }

  if (groupsCreated > 0) {
    setStatus(
      `Grouped ${formatCount(groupedTabs, "tab", "tabs")} into ${formatCount(
        groupsCreated,
        "group",
        "groups"
      )} by domain. Run #${runNumber}. Duration: ${formatDuration(Date.now() - startedAt)}.`
    );
  } else {
    setStatus(
      `No domain groups created from ${formatCount(sorted.length, "tab", "tabs")}. Run #${runNumber}. Duration: ${formatDuration(Date.now() - startedAt)}.`
    );
  }
  domainGroupingRunCount = runNumber;
  await refresh();
}

export async function setAllGroupsCollapsed(collapsed) {
  const windowId = await getTargetWindowId();
  const groups = await chrome.tabGroups.query({ windowId });
  await Promise.all(
    groups.map((group) => chrome.tabGroups.update(group.id, { collapsed }))
  );
  if (groups.length > 0) {
    setStatus(
      `${collapsed ? "Collapsed" : "Expanded"} ${formatCount(
        groups.length,
        "group",
        "groups"
      )}.`
    );
  } else {
    setStatus("No tab groups to update.");
  }
  await refresh();
}

export async function ungroupAllTabsInternal(shouldRefresh) {
  const windowId = await getTargetWindowId();
  const tabs = await chrome.tabs.query({ windowId });
  const includePinnedTabs = settings.includePinnedTabs === true;
  const groupedTabs = tabs.filter(
    (tab) => tab.groupId !== -1 && (includePinnedTabs || !tab.pinned)
  );
  if (groupedTabs.length === 0) return 0;
  await runIgnoringMissingTab(
    chrome.tabs.ungroup(groupedTabs.map((tab) => tab.id)),
    "tabs.ungroup"
  );
  if (shouldRefresh) await refresh();
  return groupedTabs.length;
}

export async function ungroupAllTabs() {
  const ungrouped = await ungroupAllTabsInternal(true);
  if (ungrouped > 0) {
    setStatus(`Ungrouped ${formatCount(ungrouped, "tab", "tabs")}.`);
  } else {
    setStatus("No grouped tabs to ungroup.");
  }
}
