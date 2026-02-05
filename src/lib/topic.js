import {
  addBigrams,
  buildDebugKeywords,
  buildIdfMap,
  buildTitleVector,
  buildTopicLabel,
  buildVector,
  clusterTabs,
  getTitleOnlyTokens,
  getTitleTokens,
  limitVector,
  mergeVectors,
  normalizeVector,
  tokenize
} from "./clustering.js";
import { CONFIG, settings } from "./config.js";
import { ensureContentAccess, fetchTabContents } from "./content.js";
import {
  fetchTabsWithMeta,
  getTargetWindowId,
  isValidTabMeta,
  refresh,
  runIgnoringMissingTab,
  ungroupAllTabsInternal
} from "./tabs.js";
import {
  elements,
  formatCount,
  reportError,
  setProgress,
  setStatusDurationSeconds,
  setStatus
} from "./ui.js";
import { createAbortError, getToggleValue, isAbortError } from "./utils.js";

let latestDebugReport = null;
let activeTopicRun = null;
let topicGroupingRunCount = 0;

export function hasActiveTopicGrouping() {
  return activeTopicRun != null;
}

export function requestStopTopicGrouping() {
  if (!activeTopicRun) return false;
  activeTopicRun.cancelled = true;
  return true;
}

function throwIfCancelled(runState) {
  if (runState?.cancelled) {
    throw createAbortError();
  }
}

function getTopicThreshold() {
  const value = elements.topicSensitivitySelect
    ? elements.topicSensitivitySelect.value
    : settings.topicSensitivity;
  if (value === "high") return CONFIG.topicThresholds.high;
  if (value === "low") return CONFIG.topicThresholds.low;
  return CONFIG.topicThresholds.medium;
}

function buildVectorForTab(
  meta,
  includeContent,
  idfMap,
  contentByTabId,
  dynamicStopwords
) {
  const vector = buildTitleVector(
    meta,
    idfMap.idfMap,
    CONFIG.topicCluster.useBigrams,
    CONFIG.topicCluster.urlTokenWeight,
    dynamicStopwords
  );

  if (includeContent) {
    const content = contentByTabId.get(meta.tab.id) || "";
    if (content) {
      const contentVector = limitVector(
        buildVector(
          addBigrams(tokenize(content), CONFIG.topicCluster.useBigrams),
          idfMap.idfMap,
          dynamicStopwords
        ),
        CONFIG.topicCluster.contentTokenLimit
      );
      for (const [key, value] of contentVector.entries()) {
        contentVector.set(key, value * CONFIG.topicCluster.contentWeight);
      }
      mergeVectors(vector, contentVector);
    }
  }
  return normalizeVector(vector);
}

export async function groupByTopic() {
  if (activeTopicRun) {
    setStatus("Topic grouping is already running.");
    return;
  }
  const runState = { cancelled: false };
  activeTopicRun = runState;
  const startedAt = Date.now();
  const runNumber = topicGroupingRunCount + 1;
  setStatusDurationSeconds(0);
  const durationTimer = setInterval(() => {
    setStatusDurationSeconds((Date.now() - startedAt) / 1000);
  }, 1000);
  const activateTabs = getToggleValue(
    elements.activateTabsForContentToggle,
    settings.activateTabsForContent
  );
  try {
    setStatus(`Grouping topics${activateTabs ? " (activating tabs)..." : "..."}`);
    setProgress(0);
    const tabsWithMeta = await fetchTabsWithMeta();
    throwIfCancelled(runState);
    const safeTabsWithMeta = tabsWithMeta.filter(isValidTabMeta);
    let contentByTabId = new Map();
    let contentStats = {
      eligible: 0,
      success: 0,
      restricted: 0
    };
    const hasContentAccess = await ensureContentAccess();
    if (hasContentAccess) {
      const contentResult = await fetchTabContents(
        safeTabsWithMeta,
        6000,
        () => runState.cancelled
      );
      contentByTabId = contentResult.contentsByTabId;
      contentStats = contentResult.stats;
    }
    throwIfCancelled(runState);

    const canUseContent = contentStats.success > 0;
    const idfTitle = buildIdfMap(
      safeTabsWithMeta,
      false,
      contentByTabId,
      CONFIG.topicCluster.useBigrams,
      {
        enabled: CONFIG.topicCluster.dynamicStopwordsEnabled,
        minDocRatio: CONFIG.topicCluster.dynamicStopwordsMinDocRatio,
        minDocs: CONFIG.topicCluster.dynamicStopwordsMinDocs
      }
    );
    const idfContent = canUseContent
      ? buildIdfMap(
          safeTabsWithMeta,
          true,
          contentByTabId,
          CONFIG.topicCluster.useBigrams,
          {
            enabled: CONFIG.topicCluster.dynamicStopwordsEnabled,
            minDocRatio: CONFIG.topicCluster.dynamicStopwordsMinDocRatio,
            minDocs: CONFIG.topicCluster.dynamicStopwordsMinDocs
          }
        )
      : idfTitle;
    const titleOnlyTokenSets = safeTabsWithMeta.map((meta) => {
      const tokens = getTitleOnlyTokens(meta).filter(
        (token) => !idfTitle.dynamicStopwords.has(token)
      );
      return new Set(tokens);
    });
    const buildClusters = (threshold, includeContent, idfMap) => {
      const vectors = safeTabsWithMeta.map((meta) =>
        buildVectorForTab(
          meta,
          includeContent,
          idfMap,
          contentByTabId,
          idfMap.dynamicStopwords
        )
      );
      return clusterTabs({
        metas: safeTabsWithMeta,
        vectors,
        titleOnlyTokenSets,
        threshold,
        config: CONFIG.topicCluster
      });
    };
    let thresholdUsed = getTopicThreshold();
    let clusters = buildClusters(thresholdUsed, canUseContent, idfContent);
    const hasGroups = clusters.some((cluster) => cluster.tabs.length >= 2);
    if (!hasGroups) {
      thresholdUsed = CONFIG.topicThresholds.fallback;
      clusters = buildClusters(thresholdUsed, false, idfTitle);
    }

    if (CONFIG.topicCluster.debugLogGroups) {
      const debugRows = clusters
        .filter((cluster) => cluster.tabs.length >= 2)
        .map((cluster, index) => ({
          group: index + 1,
          size: cluster.tabs.length,
          keywords: buildDebugKeywords(cluster.vectors, CONFIG.topicCluster)
        }));
      if (debugRows.length > 0) {
        console.log("Topic groups (pre-create):", debugRows);
      } else {
        console.log("Topic groups (pre-create): none");
      }
      const singletonRows = clusters
        .filter((cluster) => cluster.tabs.length === 1)
        .map((cluster) => ({
          title: cluster.tabs[0]?.tab?.title || "(untitled)",
          url: cluster.tabs[0]?.tab?.url || "",
          keywords: buildDebugKeywords(cluster.vectors, CONFIG.topicCluster)
        }));
      if (singletonRows.length > 0) {
        console.log("Topic singletons (pre-create):", singletonRows);
      }
      latestDebugReport = {
        generatedAt: new Date().toISOString(),
        thresholdUsed,
        config: CONFIG.topicCluster,
        groups: debugRows,
        singletons: singletonRows
      };
    }
    throwIfCancelled(runState);

    if (!clusters.some((cluster) => cluster.tabs.length >= 2)) {
      const tokenToTabs = new Map();

      for (const meta of safeTabsWithMeta) {
        const tokens = getTitleTokens(meta, CONFIG.topicCluster.useBigrams);
        for (const token of tokens) {
          const list = tokenToTabs.get(token) || [];
          list.push(meta);
          tokenToTabs.set(token, list);
        }
      }

      const candidates = Array.from(tokenToTabs.entries())
        .filter(([, list]) => list.length >= 2)
        .sort((a, b) => b[1].length - a[1].length);

      const assigned = new Set();
      const fallbackClusters = [];

      for (const [, list] of candidates) {
        const unassigned = list.filter((meta) => !assigned.has(meta.tab.id));
        if (unassigned.length < 2) continue;
        unassigned.forEach((meta) => assigned.add(meta.tab.id));
        const vectors = unassigned.map((meta) =>
          buildVector(
            getTitleTokens(meta, CONFIG.topicCluster.useBigrams),
            idfTitle.idfMap,
            idfTitle.dynamicStopwords
          )
        );
        fallbackClusters.push({ tabs: unassigned, vectors, centroid: new Map() });
      }

      if (fallbackClusters.length > 0) {
        clusters = fallbackClusters;
      }
    }

    const groupedClusters = clusters.filter((cluster) => cluster.tabs.length >= 2);
    const groupedTabIds = new Set();
    groupedClusters.forEach((cluster) =>
      cluster.tabs.forEach((meta) => groupedTabIds.add(meta.tab.id))
    );
    const statusParts = [
      `Topic grouping: ${formatCount(
        groupedClusters.length,
        "group",
        "groups"
      )} from ${formatCount(groupedTabIds.size, "tab", "tabs")} (out of ${formatCount(
        safeTabsWithMeta.length,
        "tab",
        "tabs"
      )}).`
    ];
    if (!hasContentAccess) {
      statusParts.push("Content scan: off (grant site access).");
    } else if (contentStats.eligible > 0) {
      statusParts.push(
        `Content scan: ${contentStats.success}/${contentStats.eligible} tabs.`
      );
    } else {
      statusParts.push("Content scan: skipped.");
    }
    if (contentStats.restricted) {
      statusParts.push(
        `Restricted: ${formatCount(contentStats.restricted, "tab", "tabs")}.`
      );
    }
    statusParts.push(`Run #${runNumber}.`);
    topicGroupingRunCount = runNumber;
    setStatusDurationSeconds((Date.now() - startedAt) / 1000);
    setStatus(statusParts.join(" "));
    setProgress(100);
    throwIfCancelled(runState);

    const windowId = await getTargetWindowId();
    const useNames = elements.nameGroupsToggle?.checked ?? false;
    const color = elements.groupColorSelect?.value || "";
    const collapseAfter = elements.collapseAfterGroupToggle?.checked ?? false;
    const groupsToCreate = clusters
      .filter((cluster) => cluster.tabs.length >= 2)
      .sort((a, b) => {
        const firstA = Math.min(...a.tabs.map((meta) => meta.tab.index));
        const firstB = Math.min(...b.tabs.map((meta) => meta.tab.index));
        return firstB - firstA;
      });

    await ungroupAllTabsInternal(false);
    for (const cluster of groupsToCreate) {
      throwIfCancelled(runState);
      const tabIds = cluster.tabs.map((meta) => meta.tab.id);
      const groupId = await runIgnoringMissingTab(
        chrome.tabs.group({
          tabIds,
          createProperties: { windowId }
        }),
        "tabs.group"
      );
      if (groupId == null) continue;

      const updatePayload = {};
      if (useNames) {
        updatePayload.title = buildTopicLabel(cluster.vectors, CONFIG.topicCluster);
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

    throwIfCancelled(runState);
    await refresh();
  } catch (error) {
    if (isAbortError(error)) {
      setStatus(`Topic grouping stopped (run #${runNumber}).`);
      setStatusDurationSeconds((Date.now() - startedAt) / 1000);
      setProgress(0);
      return;
    }
    throw error;
  } finally {
    clearInterval(durationTimer);
    if (activeTopicRun === runState) {
      activeTopicRun = null;
    }
  }
}

export async function copyDebugReport() {
  if (!latestDebugReport) {
    setStatus("No debug report yet. Run topic grouping first.");
    return;
  }
  const payload = JSON.stringify(latestDebugReport, null, 2);
  try {
    await navigator.clipboard.writeText(payload);
    setStatus("Debug report copied to clipboard.");
  } catch (error) {
    reportError("copyDebugReport", error);
  }
}
