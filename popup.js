const tabsList = document.getElementById("tabs");
const tabCount = document.getElementById("tabCount");
const detailsBody = document.getElementById("detailsBody");

const SETTINGS_KEY = "tabSorterSettings";
const UNDO_KEY = "tabSorterUndoStack";
const settings = {
  nameGroups: true,
  groupColor: "",
  collapseAfterGroup: false,
  lastVisitedOrder: "desc",
  topicSensitivity: "medium"
};

const closeDuplicatesButton = document.getElementById("closeDuplicates");
const sortAlphaButton = document.getElementById("sortAlpha");
const sortLastVisitedButton = document.getElementById("sortLastVisited");
const groupDomainButton = document.getElementById("groupDomain");
const groupTopicButton = document.getElementById("groupTopic");
const collapseGroupsButton = document.getElementById("collapseGroups");
const expandGroupsButton = document.getElementById("expandGroups");
const ungroupAllButton = document.getElementById("ungroupAll");
const undoActionButton = document.getElementById("undoAction");

const nameGroupsToggle = document.getElementById("nameGroups");
const groupColorSelect = document.getElementById("groupColor");
const collapseAfterGroupToggle = document.getElementById("collapseAfterGroup");
const lastVisitedOrderSelect = document.getElementById("lastVisitedOrder");
const topicSensitivitySelect = document.getElementById("topicSensitivity");

const MAX_UNDO = 5;
const undoStack = [];

function getUndoStorage() {
  if (chrome.storage && chrome.storage.session) return chrome.storage.session;
  return chrome.storage.local;
}

async function loadUndoStack() {
  const storage = getUndoStorage();
  const data = await storage.get([UNDO_KEY]);
  if (Array.isArray(data[UNDO_KEY])) {
    undoStack.splice(0, undoStack.length, ...data[UNDO_KEY]);
  }
  setUndoEnabled();
}

async function saveUndoStack() {
  const storage = getUndoStorage();
  await storage.set({ [UNDO_KEY]: undoStack });
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatDate(ts) {
  if (!ts) return "No history";
  const date = new Date(ts);
  return date.toLocaleString();
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return "";
  }
}

function abbreviateDomain(hostname) {
  if (!hostname) return "";
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length === 0) return "";
  const letters = parts.map((part) => part[0]).join("");
  return letters.slice(0, 6).toUpperCase();
}

function abbreviateKeyword(keyword) {
  if (!keyword) return "";
  if (keyword.length <= 12) return keyword;
  return `${keyword.slice(0, 11)}…`;
}

function tokenize(text) {
  if (!text) return [];
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const raw = cleaned.split(" ").filter(Boolean);
  const stopwords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "have", "how", "in", "is", "it", "its", "of", "on", "or",
    "that", "the", "this", "to", "was", "were", "what", "when", "where",
    "who", "why", "with", "you", "your"
  ]);
  return raw.filter((token) => token.length > 1 && !stopwords.has(token));
}

function buildVector(tokens) {
  const map = new Map();
  for (const token of tokens) {
    map.set(token, (map.get(token) || 0) + 1);
  }
  return map;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [key, value] of a.entries()) {
    normA += value * value;
    if (b.has(key)) {
      dot += value * b.get(key);
    }
  }
  for (const value of b.values()) {
    normB += value * value;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function mergeVectors(target, source) {
  for (const [key, value] of source.entries()) {
    target.set(key, (target.get(key) || 0) + value);
  }
}

function getTabTimes() {
  return chrome.runtime.sendMessage({ type: "getTabTimes" });
}

function setUndoEnabled() {
  if (!undoActionButton) return;
  undoActionButton.disabled = undoStack.length === 0;
}

async function captureState() {
  const currentWindow = await chrome.windows.getCurrent();
  const [tabs, groups] = await Promise.all([
    chrome.tabs.query({ windowId: currentWindow.id }),
    chrome.tabGroups.query({ windowId: currentWindow.id })
  ]);

  return {
    windowId: currentWindow.id,
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
  const currentWindow = await chrome.windows.getCurrent();
  const tabsNow = await chrome.tabs.query({ windowId: currentWindow.id });
  const tabsById = new Map(tabsNow.map((tab) => [tab.id, tab]));
  const desiredEntries = [];

  for (const entry of state.tabs) {
    let tab = tabsById.get(entry.id);
    if (!tab) {
      tab = await chrome.tabs.create({
        windowId: currentWindow.id,
        url: entry.url || "chrome://newtab",
        index: desiredEntries.length,
        pinned: entry.pinned,
        active: false
      });
      tabsById.set(tab.id, tab);
    } else if (tab.pinned !== entry.pinned) {
      await chrome.tabs.update(tab.id, { pinned: entry.pinned });
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
    await chrome.tabs.ungroup(idsToUngroup);
  }

  for (let index = 0; index < desiredEntries.length; index += 1) {
    await chrome.tabs.move(desiredEntries[index].tabId, { index });
  }

  const groupsByOldId = new Map();
  for (const item of desiredEntries) {
    const groupId = item.entry.groupId;
    if (groupId === -1) continue;
    const list = groupsByOldId.get(groupId) || [];
    list.push(item.tabId);
    groupsByOldId.set(groupId, list);
  }

  const groupMetaById = new Map(state.groups.map((group) => [group.id, group]));
  for (const [oldGroupId, tabIds] of groupsByOldId.entries()) {
    const newGroupId = await chrome.tabs.group({
      tabIds,
      createProperties: { windowId: currentWindow.id }
    });
    const meta = groupMetaById.get(oldGroupId);
    if (meta) {
      const updatePayload = {};
      if (meta.title) updatePayload.title = meta.title;
      if (meta.color) updatePayload.color = meta.color;
      if (typeof meta.collapsed === "boolean") {
        updatePayload.collapsed = meta.collapsed;
      }
      if (Object.keys(updatePayload).length > 0) {
        await chrome.tabGroups.update(newGroupId, updatePayload);
      }
    }
  }

  const activeEntry = desiredEntries.find((item) => item.entry.active);
  if (activeEntry) {
    await chrome.tabs.update(activeEntry.tabId, { active: true });
  }

  await refresh();
}

async function runWithUndo(action) {
  if (!action) return;
  if (!undoActionButton) {
    await action();
    return;
  }
  const state = await captureState();
  undoStack.push(state);
  if (undoStack.length > MAX_UNDO) {
    undoStack.shift();
  }
  setUndoEnabled();
  await saveUndoStack();
  await action();
}

async function undoLastAction() {
  if (undoStack.length === 0) return;
  const state = undoStack.pop();
  setUndoEnabled();
  await saveUndoStack();
  await restoreState(state);
}

async function loadSettings() {
  const data = await chrome.storage.local.get([SETTINGS_KEY]);
  if (data[SETTINGS_KEY]) {
    Object.assign(settings, data[SETTINGS_KEY]);
  }
  if (nameGroupsToggle) nameGroupsToggle.checked = settings.nameGroups;
  if (groupColorSelect) groupColorSelect.value = settings.groupColor || "";
  if (collapseAfterGroupToggle) {
    collapseAfterGroupToggle.checked = settings.collapseAfterGroup;
  }
  if (lastVisitedOrderSelect) {
    lastVisitedOrderSelect.value = settings.lastVisitedOrder || "desc";
  }
  if (topicSensitivitySelect) {
    topicSensitivitySelect.value = settings.topicSensitivity || "medium";
  }
}

function saveSettings() {
  return chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

async function fetchLastVisited(url) {
  if (!url) return null;
  const visits = await chrome.history.getVisits({ url });
  if (!visits || visits.length === 0) return null;
  const last = visits.reduce((latest, visit) => {
    return visit.visitTime > latest.visitTime ? visit : latest;
  }, visits[0]);
  return last.visitTime;
}

async function fetchLastVisitedBatch(urls) {
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

async function fetchTabsWithMeta() {
  const [tabs, timeData] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    getTabTimes()
  ]);

  const timeByTabId = timeData?.timeByTabId || {};
  const lastVisitedByUrl = await fetchLastVisitedBatch(
    tabs.map((tab) => tab.url)
  );
  const withMeta = tabs
    .filter((tab) => tab && Number.isFinite(tab.id))
    .map((tab) => ({
      tab,
      lastVisited: lastVisitedByUrl.get(tab.url) || null,
      timeSpent: timeByTabId[tab.id] || 0,
      hostname: getHostname(tab.url)
    }));

  return withMeta;
}

function renderTabs(tabsWithMeta) {
  tabsList.innerHTML = "";
  tabCount.textContent = tabsWithMeta.length.toString();

  tabsWithMeta.forEach((meta) => {
    if (!meta || !meta.tab) return;
    const li = document.createElement("li");
    li.className = "tab-item";
    li.dataset.tabId = meta.tab.id;

    const title = document.createElement("div");
    title.className = "tab-title";
    title.textContent = meta.tab.title || "(untitled)";

    const url = document.createElement("div");
    url.className = "tab-url";
    url.textContent = meta.tab.url || "";

    li.append(title, url);

    li.addEventListener("mouseenter", () => {
      detailsBody.innerHTML = `
        <div><strong>Title:</strong> ${meta.tab.title || "(untitled)"}</div>
        <div><strong>URL:</strong> ${meta.tab.url || ""}</div>
        <div><strong>Last visited:</strong> ${formatDate(meta.lastVisited)}</div>
        <div><strong>Time spent:</strong> ${formatDuration(meta.timeSpent)}</div>
        <div><span class="badge">${meta.hostname || "No domain"}</span></div>
      `;
    });

    li.addEventListener("click", () => {
      chrome.tabs.update(meta.tab.id, { active: true });
    });

    tabsList.appendChild(li);
  });
}

async function closeDuplicates() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const seen = new Map();
  const toClose = [];

  tabs.forEach((tab) => {
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

  await refresh();
}

async function moveTabsInOrder(sorted) {
  for (let index = 0; index < sorted.length; index += 1) {
    const tab = sorted[index].tab;
    await chrome.tabs.move(tab.id, { index });
  }
}

async function sortWithGroups(comparator, metaById) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const groupMap = new Map();
  const topLevel = [];

  for (const tab of tabs) {
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
      await chrome.tabs.move(tab.id, { index: startIndex + offset });
    }
  }

  const refreshed = await chrome.tabs.query({ currentWindow: true });
  const refreshedGroupMap = new Map();
  const refreshedTopLevel = [];

  for (const tab of refreshed) {
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
      await chrome.tabs.move(block.id, { index: targetIndex });
      targetIndex += 1;
      continue;
    }
    await chrome.tabGroups.move(block.id, { index: targetIndex });
    targetIndex += block.size || 0;
  }
}

async function sortAlphabetically() {
  const tabsWithMeta = await fetchTabsWithMeta();
  const tabs = await chrome.tabs.query({ currentWindow: true });
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
  await refresh();
}

async function sortByLastVisited() {
  const tabsWithMeta = await fetchTabsWithMeta();
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const metaById = new Map(tabsWithMeta.map((meta) => [meta.tab.id, meta]));
  const descending = lastVisitedOrderSelect.value !== "asc";
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
  await refresh();
}

async function groupByDomain() {
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

  const currentWindow = await chrome.windows.getCurrent();
  const useNames = nameGroupsToggle.checked;
  const color = groupColorSelect.value;
  const collapseAfter = collapseAfterGroupToggle.checked;

  let currentHost = null;
  let currentGroupTabs = [];

  async function finalizeGroup() {
    if (currentGroupTabs.length === 0) {
      currentGroupTabs = [];
      return;
    }
    const groupId = await chrome.tabs.group({
      tabIds: currentGroupTabs,
      createProperties: { windowId: currentWindow.id }
    });
    const updatePayload = {};
    if (useNames && currentHost) {
      updatePayload.title = abbreviateDomain(currentHost);
    }
    if (color) updatePayload.color = color;
    if (collapseAfter) updatePayload.collapsed = true;
    if (Object.keys(updatePayload).length > 0) {
      await chrome.tabGroups.update(groupId, updatePayload);
    }
    currentGroupTabs = [];
  }

  for (const meta of sorted) {
    const host = meta.hostname;
    if (!host) {
      await finalizeGroup();
      currentHost = null;
      continue;
    }
    if (currentHost === null) {
      currentHost = host;
    }
    if (host !== currentHost) {
      await finalizeGroup();
      currentHost = host;
    }
    currentGroupTabs.push(meta.tab.id);
  }
  await finalizeGroup();

  await refresh();
}

function titleCase(word) {
  if (!word) return "";
  return `${word[0].toUpperCase()}${word.slice(1)}`;
}

function pickTopKeywords(vectors, limit) {
  const counts = new Map();
  for (const vector of vectors) {
    for (const [key, value] of vector.entries()) {
      counts.set(key, (counts.get(key) || 0) + value);
    }
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0].length - a[0].length;
  });
  return sorted.slice(0, limit).map(([key]) => key);
}

function buildTopicLabel(vectors) {
  const keywords = pickTopKeywords(vectors, 2)
    .map((word) => titleCase(word))
    .filter(Boolean);
  if (keywords.length === 0) return "Topic";
  const joined = keywords.join(" ");
  return abbreviateKeyword(joined);
}

function getTopicThreshold() {
  const value = topicSensitivitySelect
    ? topicSensitivitySelect.value
    : settings.topicSensitivity;
  if (value === "high") return 0.35;
  if (value === "low") return 0.15;
  return 0.25;
}

async function ungroupAllTabsInternal(shouldRefresh) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const groupedTabs = tabs.filter((tab) => tab.groupId !== -1);
  if (groupedTabs.length === 0) return;
  await chrome.tabs.ungroup(groupedTabs.map((tab) => tab.id));
  if (shouldRefresh) await refresh();
}

async function groupByTopic() {
  const tabsWithMeta = await fetchTabsWithMeta();
  await ungroupAllTabsInternal(false);

  const threshold = getTopicThreshold();
  const clusters = [];

  for (const meta of tabsWithMeta) {
    const text = meta.tab.title || meta.tab.url || "";
    const vector = buildVector(tokenize(text));
    let bestCluster = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      const score = cosineSimilarity(vector, cluster.centroid);
      if (score >= threshold && score > bestScore) {
        bestScore = score;
        bestCluster = cluster;
      }
    }

    if (!bestCluster) {
      const centroid = new Map(vector);
      clusters.push({ tabs: [meta], vectors: [vector], centroid });
    } else {
      bestCluster.tabs.push(meta);
      bestCluster.vectors.push(vector);
      mergeVectors(bestCluster.centroid, vector);
    }
  }

  const currentWindow = await chrome.windows.getCurrent();
  const useNames = nameGroupsToggle.checked;
  const color = groupColorSelect.value;
  const collapseAfter = collapseAfterGroupToggle.checked;

  for (const cluster of clusters) {
    if (cluster.tabs.length < 2) continue;
    const tabIds = cluster.tabs.map((meta) => meta.tab.id);
    const groupId = await chrome.tabs.group({
      tabIds,
      createProperties: { windowId: currentWindow.id }
    });

    const updatePayload = {};
    if (useNames) {
      updatePayload.title = buildTopicLabel(cluster.vectors);
    }
    if (color) updatePayload.color = color;
    if (collapseAfter) updatePayload.collapsed = true;
    if (Object.keys(updatePayload).length > 0) {
      await chrome.tabGroups.update(groupId, updatePayload);
    }
  }

  await refresh();
}

async function setAllGroupsCollapsed(collapsed) {
  const currentWindow = await chrome.windows.getCurrent();
  const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
  await Promise.all(
    groups.map((group) => chrome.tabGroups.update(group.id, { collapsed }))
  );
  await refresh();
}

async function ungroupAllTabs() {
  await ungroupAllTabsInternal(true);
}

async function refresh() {
  const tabsWithMeta = await fetchTabsWithMeta();
  renderTabs(tabsWithMeta);
}

closeDuplicatesButton.addEventListener("click", () =>
  runWithUndo(closeDuplicates)
);
sortAlphaButton.addEventListener("click", () => runWithUndo(sortAlphabetically));
sortLastVisitedButton.addEventListener("click", () =>
  runWithUndo(sortByLastVisited)
);
groupDomainButton.addEventListener("click", () => runWithUndo(groupByDomain));
groupTopicButton.addEventListener("click", () => runWithUndo(groupByTopic));
collapseGroupsButton.addEventListener("click", () =>
  runWithUndo(() => setAllGroupsCollapsed(true))
);
expandGroupsButton.addEventListener("click", () =>
  runWithUndo(() => setAllGroupsCollapsed(false))
);
ungroupAllButton.addEventListener("click", () => runWithUndo(ungroupAllTabs));
if (undoActionButton) {
  undoActionButton.addEventListener("click", undoLastAction);
}

if (nameGroupsToggle) {
  nameGroupsToggle.addEventListener("change", () => {
    settings.nameGroups = nameGroupsToggle.checked;
    saveSettings();
  });
}
if (groupColorSelect) {
  groupColorSelect.addEventListener("change", () => {
    settings.groupColor = groupColorSelect.value;
    saveSettings();
  });
}
if (collapseAfterGroupToggle) {
  collapseAfterGroupToggle.addEventListener("change", () => {
    settings.collapseAfterGroup = collapseAfterGroupToggle.checked;
    saveSettings();
  });
}
if (lastVisitedOrderSelect) {
  lastVisitedOrderSelect.addEventListener("change", () => {
    settings.lastVisitedOrder = lastVisitedOrderSelect.value;
    saveSettings();
  });
}
if (topicSensitivitySelect) {
  topicSensitivitySelect.addEventListener("change", () => {
    settings.topicSensitivity = topicSensitivitySelect.value;
    saveSettings();
  });
}

Promise.all([loadSettings(), loadUndoStack()]).then(refresh);
