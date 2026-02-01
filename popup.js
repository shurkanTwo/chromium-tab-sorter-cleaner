const tabsList = document.getElementById("tabs");
const tabCount = document.getElementById("tabCount");
const detailsBody = document.getElementById("detailsBody");

const closeDuplicatesButton = document.getElementById("closeDuplicates");
const sortAlphaButton = document.getElementById("sortAlpha");
const sortLastVisitedButton = document.getElementById("sortLastVisited");
const groupDomainButton = document.getElementById("groupDomain");

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

async function sortAlphabetically() {
  const tabsWithMeta = await fetchTabsWithMeta();
  const sorted = [...tabsWithMeta].sort((a, b) => {
    const titleA = (a.tab.title || a.tab.url || "").toLowerCase();
    const titleB = (b.tab.title || b.tab.url || "").toLowerCase();
    return titleA.localeCompare(titleB);
  });

  await moveTabsInOrder(sorted);
  await refresh();
}

async function sortByLastVisited() {
  const tabsWithMeta = await fetchTabsWithMeta();
  const sorted = [...tabsWithMeta].sort((a, b) => {
    const timeA = a.lastVisited || 0;
    const timeB = b.lastVisited || 0;
    return timeB - timeA;
  });

  await moveTabsInOrder(sorted);
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

refresh();
