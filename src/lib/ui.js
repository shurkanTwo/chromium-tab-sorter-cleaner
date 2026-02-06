export const elements = {
  tabsList: document.getElementById("tabs"),
  tabCount: document.getElementById("tabCount"),
  detailsBody: document.getElementById("detailsBody"),
  statusMessage: document.getElementById("statusMessage"),
  statusProgressBar: document.getElementById("statusProgressBar"),
  statusDurationValue: document.getElementById("statusDurationValue"),
  targetWindowLabel: document.getElementById("targetWindowLabel"),
  closeDuplicatesButton: document.getElementById("closeDuplicates"),
  sortAlphaButton: document.getElementById("sortAlpha"),
  sortLastVisitedButton: document.getElementById("sortLastVisited"),
  groupDomainButton: document.getElementById("groupDomain"),
  groupTopicButton: document.getElementById("groupTopic"),
  stopActionButton: document.getElementById("stopAction"),
  collapseGroupsButton: document.getElementById("collapseGroups"),
  expandGroupsButton: document.getElementById("expandGroups"),
  ungroupAllButton: document.getElementById("ungroupAll"),
  undoActionButton: document.getElementById("undoAction"),
  copyDebugReportLink: document.getElementById("copyDebugReportLink"),
  nameGroupsToggle: document.getElementById("nameGroups"),
  groupColorSelect: document.getElementById("groupColor"),
  collapseAfterGroupToggle: document.getElementById("collapseAfterGroup"),
  includePinnedTabsToggle: document.getElementById("includePinnedTabs"),
  lastVisitedOrderSelect: document.getElementById("lastVisitedOrder"),
  topicSensitivitySelect: document.getElementById("topicSensitivity"),
  activateTabsForContentToggle: document.getElementById("activateTabsForContent"),
  resetSettingsButton: document.getElementById("resetSettings")
};

export function setStatus(message) {
  if (!elements.statusMessage) return;
  elements.statusMessage.textContent = message || "";
}

export function setProgress(percent) {
  if (!elements.statusProgressBar) return;
  const safeValue = Number.isFinite(percent) ? percent : 0;
  const clamped = Math.min(100, Math.max(0, safeValue));
  elements.statusProgressBar.style.width = `${clamped}%`;
}

export function setStatusDurationSeconds(seconds) {
  if (!elements.statusDurationValue) return;
  const safeValue = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  elements.statusDurationValue.textContent = `${safeValue}s`;
}

export function reportError(context, error) {
  const message = error?.message ? error.message : String(error || "Unknown error");
  setStatus(`Error in ${context}: ${message}`);
}

export function formatCount(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms)) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatDate(ts) {
  if (!ts) return "No history";
  const date = new Date(ts);
  return date.toLocaleString();
}

export function renderTabs(tabsWithMeta, onTabClick) {
  if (elements.tabsList) elements.tabsList.innerHTML = "";
  if (elements.tabCount) elements.tabCount.textContent = tabsWithMeta.length.toString();

  function renderDetailLine(label, value) {
    const row = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = `${label}:`;
    row.appendChild(strong);
    row.append(` ${value}`);
    return row;
  }

  function renderDetails(meta) {
    if (!elements.detailsBody) return;
    elements.detailsBody.replaceChildren(
      renderDetailLine("Title", meta.tab.title || "(untitled)"),
      renderDetailLine("URL", meta.tab.url || ""),
      renderDetailLine("Last visited", formatDate(meta.lastVisited)),
      renderDetailLine("Time spent", formatDuration(meta.timeSpent)),
      (() => {
        const row = document.createElement("div");
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = meta.hostname || "No domain";
        row.appendChild(badge);
        return row;
      })()
    );
  }

  tabsWithMeta.forEach((meta) => {
    if (!meta || !meta.tab || !elements.tabsList) return;
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
      renderDetails(meta);
    });

    if (typeof onTabClick === "function") {
      li.addEventListener("click", () => onTabClick(meta.tab.id));
    }

    elements.tabsList.appendChild(li);
  });
}

export function setUndoEnabled(enabled) {
  if (!elements.undoActionButton) return;
  elements.undoActionButton.disabled = !enabled;
}

export function setTopicGroupingRunning(running) {
  if (elements.stopActionButton) {
    elements.stopActionButton.disabled = !running;
  }
  if (elements.groupTopicButton) {
    elements.groupTopicButton.disabled = Boolean(running);
  }
}

export function setTargetWindowLabel(targetId) {
  if (!elements.targetWindowLabel) return;
  elements.targetWindowLabel.textContent = `Target window: ${targetId}`;
}
