const tabsList = document.getElementById("tabs");
const tabCount = document.getElementById("tabCount");
const detailsBody = document.getElementById("detailsBody");

const closeDuplicatesButton = document.getElementById("closeDuplicates");
const sortAlphaButton = document.getElementById("sortAlpha");
const sortLastVisitedButton = document.getElementById("sortLastVisited");
const groupDomainButton = document.getElementById("groupDomain");
const collapseGroupsButton = document.getElementById("collapseGroups");
const expandGroupsButton = document.getElementById("expandGroups");

const nameGroupsToggle = document.getElementById("nameGroups");
const groupColorSelect = document.getElementById("groupColor");
const collapseAfterGroupToggle = document.getElementById("collapseAfterGroup");

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

async function fetchTabsWithMeta() {
  const [tabs, timeData] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    getTabTimes()
  ]);

  const timeByTabId = timeData?.timeByTabId || {};
  const withMeta = await Promise.all(
    tabs.map(async (tab) => {
      const lastVisited = await fetchLastVisited(tab.url);
      return {
        tab,
        lastVisited,
        timeSpent: timeByTabId[tab.id] || 0,
        hostname: getHostname(tab.url)
      };
    })
  );

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

async function moveTabsByIdOrder(tabIds) {
  for (let index = 0; index < tabIds.length; index += 1) {
    await chrome.tabs.move(tabIds[index], { index });
  }
}

function buildSortedOrderWithGroupBlocks(tabs, metaById, comparator) {
  const topLevel = tabs.filter((tab) => tab.groupId === -1);
  const groupMap = new Map();
  for (const tab of tabs) {
    if (tab.groupId === -1) continue;
    const list = groupMap.get(tab.groupId) || [];
    list.push(tab);
    groupMap.set(tab.groupId, list);
  }

  const sortedGroups = new Map();
  const groupRepresentatives = new Map();
  for (const [groupId, list] of groupMap.entries()) {
    const sorted = [...list].sort((a, b) =>
      comparator(metaById[a.id], metaById[b.id])
    );
    sortedGroups.set(groupId, sorted);
    if (sorted.length > 0) {
      groupRepresentatives.set(groupId, metaById[sorted[0].id]);
    }
  }

  const blocks = [];
  for (const tab of topLevel) {
    blocks.push({ type: "tab", id: tab.id });
  }
  for (const groupId of sortedGroups.keys()) {
    blocks.push({ type: "group", id: groupId });
  }

  blocks.sort((a, b) => {
    const metaA =
      a.type === "tab" ? metaById[a.id] : groupRepresentatives.get(a.id);
    const metaB =
      b.type === "tab" ? metaById[b.id] : groupRepresentatives.get(b.id);
    if (!metaA && !metaB) return 0;
    if (!metaA) return 1;
    if (!metaB) return -1;
    return comparator(metaA, metaB);
  });

  const desired = [];
  for (const block of blocks) {
    if (block.type === "tab") {
      desired.push(block.id);
      continue;
    }
    const groupTabs = sortedGroups.get(block.id) || [];
    for (const groupTab of groupTabs) {
      desired.push(groupTab.id);
    }
  }

  return desired;
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
    const desired = buildSortedOrderWithGroupBlocks(tabs, metaById, comparator);
    await moveTabsByIdOrder(desired);
  } else {
    await moveTabsInOrder(sorted);
  }
  await refresh();
}

async function sortByLastVisited() {
  const tabsWithMeta = await fetchTabsWithMeta();
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const metaById = new Map(tabsWithMeta.map((meta) => [meta.tab.id, meta]));
  const comparator = (a, b) => {
    const timeA = a.lastVisited || 0;
    const timeB = b.lastVisited || 0;
    return timeB - timeA;
  };
  const sorted = [...tabsWithMeta].sort((a, b) => {
    const timeA = a.lastVisited || 0;
    const timeB = b.lastVisited || 0;
    return timeB - timeA;
  });

  if (tabs.some((tab) => tab.groupId !== -1)) {
    const desired = buildSortedOrderWithGroupBlocks(tabs, metaById, comparator);
    await moveTabsByIdOrder(desired);
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
    if (useNames && currentHost) updatePayload.title = currentHost;
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

refresh();
