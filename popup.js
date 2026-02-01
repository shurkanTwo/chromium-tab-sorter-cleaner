const tabsList = document.getElementById("tabs");
const tabCount = document.getElementById("tabCount");
const detailsBody = document.getElementById("detailsBody");

const closeDuplicatesButton = document.getElementById("closeDuplicates");
const sortAlphaButton = document.getElementById("sortAlpha");
const sortLastVisitedButton = document.getElementById("sortLastVisited");
const groupDomainButton = document.getElementById("groupDomain");
const collapseGroupsButton = document.getElementById("collapseGroups");
const expandGroupsButton = document.getElementById("expandGroups");
const ungroupAllButton = document.getElementById("ungroupAll");

const nameGroupsToggle = document.getElementById("nameGroups");
const groupColorSelect = document.getElementById("groupColor");
const collapseAfterGroupToggle = document.getElementById("collapseAfterGroup");
const lastVisitedOrderSelect = document.getElementById("lastVisitedOrder");

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

function getTabTimes() {
  return chrome.runtime.sendMessage({ type: "getTabTimes" });
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
  const withMeta = tabs.map((tab) => ({
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

async function setAllGroupsCollapsed(collapsed) {
  const currentWindow = await chrome.windows.getCurrent();
  const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
  await Promise.all(
    groups.map((group) => chrome.tabGroups.update(group.id, { collapsed }))
  );
  await refresh();
}

async function ungroupAllTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const groupedTabs = tabs.filter((tab) => tab.groupId !== -1);
  if (groupedTabs.length === 0) return;
  await chrome.tabs.ungroup(groupedTabs.map((tab) => tab.id));
  await refresh();
}

async function refresh() {
  const tabsWithMeta = await fetchTabsWithMeta();
  renderTabs(tabsWithMeta);
}

closeDuplicatesButton.addEventListener("click", closeDuplicates);
sortAlphaButton.addEventListener("click", sortAlphabetically);
sortLastVisitedButton.addEventListener("click", sortByLastVisited);
groupDomainButton.addEventListener("click", groupByDomain);
collapseGroupsButton.addEventListener("click", () => setAllGroupsCollapsed(true));
expandGroupsButton.addEventListener("click", () => setAllGroupsCollapsed(false));
ungroupAllButton.addEventListener("click", ungroupAllTabs);

refresh();
