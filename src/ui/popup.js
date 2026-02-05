import { CONFIG, settings } from "../lib/config.js";
import { elements, reportError, setStatus, setTopicGroupingRunning } from "../lib/ui.js";
import { loadSettings, saveSettings } from "../lib/settings.js";
import {
  closeDuplicates,
  focusTargetWindow,
  groupByDomain,
  loadUndoStack,
  refresh,
  runWithUndo,
  setAllGroupsCollapsed,
  sortAlphabetically,
  sortByLastVisited,
  undoLastAction,
  ungroupAllTabs,
  updateTargetWindowLabel
} from "../lib/tabs.js";
import {
  copyDebugReport,
  groupByTopic,
  hasActiveTopicGrouping,
  requestStopTopicGrouping
} from "../lib/topic.js";

async function runTopicGroupingWithStop() {
  setTopicGroupingRunning(true);
  try {
    await runWithUndo(groupByTopic);
  } finally {
    setTopicGroupingRunning(hasActiveTopicGrouping());
  }
}

if (elements.closeDuplicatesButton) {
  elements.closeDuplicatesButton.addEventListener("click", () =>
    runWithUndo(closeDuplicates)
  );
}
if (elements.sortAlphaButton) {
  elements.sortAlphaButton.addEventListener("click", () =>
    runWithUndo(sortAlphabetically)
  );
}
if (elements.sortLastVisitedButton) {
  elements.sortLastVisitedButton.addEventListener("click", () =>
    runWithUndo(sortByLastVisited)
  );
}
if (elements.groupDomainButton) {
  elements.groupDomainButton.addEventListener("click", () =>
    runWithUndo(groupByDomain)
  );
}
if (elements.groupTopicButton) {
  elements.groupTopicButton.addEventListener("click", () =>
    runTopicGroupingWithStop()
  );
}
if (elements.stopActionButton) {
  elements.stopActionButton.addEventListener("click", () => {
    if (!requestStopTopicGrouping()) return;
    setStatus("Stopping topic grouping...");
  });
}
if (elements.collapseGroupsButton) {
  elements.collapseGroupsButton.addEventListener("click", () =>
    runWithUndo(() => setAllGroupsCollapsed(true))
  );
}
if (elements.expandGroupsButton) {
  elements.expandGroupsButton.addEventListener("click", () =>
    runWithUndo(() => setAllGroupsCollapsed(false))
  );
}
if (elements.ungroupAllButton) {
  elements.ungroupAllButton.addEventListener("click", () =>
    runWithUndo(ungroupAllTabs)
  );
}
if (elements.undoActionButton) {
  elements.undoActionButton.addEventListener("click", undoLastAction);
}
if (elements.copyDebugReportLink) {
  elements.copyDebugReportLink.addEventListener("click", (event) => {
    event.preventDefault();
    copyDebugReport();
  });
}

if (elements.nameGroupsToggle) {
  elements.nameGroupsToggle.addEventListener("change", () => {
    settings.nameGroups = elements.nameGroupsToggle.checked;
    saveSettings();
  });
}
if (elements.groupColorSelect) {
  elements.groupColorSelect.addEventListener("change", () => {
    settings.groupColor = elements.groupColorSelect.value;
    saveSettings();
  });
}
if (elements.collapseAfterGroupToggle) {
  elements.collapseAfterGroupToggle.addEventListener("change", () => {
    settings.collapseAfterGroup = elements.collapseAfterGroupToggle.checked;
    saveSettings();
  });
}
if (elements.includePinnedTabsToggle) {
  elements.includePinnedTabsToggle.addEventListener("change", async () => {
    settings.includePinnedTabs = elements.includePinnedTabsToggle.checked;
    await saveSettings();
    await refresh();
  });
}
if (elements.lastVisitedOrderSelect) {
  elements.lastVisitedOrderSelect.addEventListener("change", () => {
    settings.lastVisitedOrder = elements.lastVisitedOrderSelect.value;
    saveSettings();
  });
}
if (elements.topicSensitivitySelect) {
  elements.topicSensitivitySelect.addEventListener("change", () => {
    settings.topicSensitivity = elements.topicSensitivitySelect.value;
    saveSettings();
  });
}
if (elements.activateTabsForContentToggle) {
  elements.activateTabsForContentToggle.addEventListener("change", () => {
    settings.activateTabsForContent =
      elements.activateTabsForContentToggle.checked;
    saveSettings();
  });
}
if (elements.targetWindowLabel) {
  elements.targetWindowLabel.addEventListener("click", focusTargetWindow);
}

function bindBooleanSetting(element, target, key, onChange) {
  if (!element) return;
  element.addEventListener("change", async () => {
    target[key] = element.checked;
    await saveSettings();
    if (typeof onChange === "function") {
      await onChange();
    }
  });
}

function bindNumberSetting(element, target, key, integer = false) {
  if (!element) return;
  element.addEventListener("change", async () => {
    const parsed = integer
      ? Number.parseInt(element.value, 10)
      : Number.parseFloat(element.value);
    if (!Number.isFinite(parsed)) {
      element.value = String(target[key]);
      return;
    }
    target[key] = parsed;
    await saveSettings();
  });
}

bindNumberSetting(elements.cfgKNearestInput, CONFIG.topicCluster, "kNearest", true);
bindNumberSetting(
  elements.cfgMinSharedTokensInput,
  CONFIG.topicCluster,
  "minSharedTokens",
  true
);
bindNumberSetting(
  elements.cfgMinAverageSimilarityFloorInput,
  CONFIG.topicCluster,
  "minAverageSimilarityFloor"
);
bindNumberSetting(
  elements.cfgMinAverageSimilarityScaleInput,
  CONFIG.topicCluster,
  "minAverageSimilarityScale"
);
bindBooleanSetting(elements.cfgAdaptiveThresholdToggle, CONFIG.topicCluster, "adaptiveThreshold");
bindNumberSetting(
  elements.cfgAdaptiveTargetSimilarityInput,
  CONFIG.topicCluster,
  "adaptiveTargetSimilarity"
);
bindNumberSetting(
  elements.cfgAdaptiveMinThresholdInput,
  CONFIG.topicCluster,
  "adaptiveMinThreshold"
);
bindNumberSetting(
  elements.cfgAdaptiveMaxThresholdInput,
  CONFIG.topicCluster,
  "adaptiveMaxThreshold"
);
bindNumberSetting(elements.cfgAdaptiveMaxPairsInput, CONFIG.topicCluster, "adaptiveMaxPairs", true);
bindBooleanSetting(elements.cfgUseBigramsToggle, CONFIG.topicCluster, "useBigrams");
bindNumberSetting(
  elements.cfgTitleKeywordLimitInput,
  CONFIG.topicCluster,
  "titleKeywordLimit",
  true
);
bindBooleanSetting(elements.cfgTitleIncludeScoresToggle, CONFIG.topicCluster, "titleIncludeScores");
bindBooleanSetting(elements.cfgDebugLogGroupsToggle, CONFIG.topicCluster, "debugLogGroups");
bindNumberSetting(
  elements.cfgDebugKeywordLimitInput,
  CONFIG.topicCluster,
  "debugKeywordLimit",
  true
);
bindNumberSetting(elements.cfgContentWeightInput, CONFIG.topicCluster, "contentWeight");
bindNumberSetting(
  elements.cfgContentTokenLimitInput,
  CONFIG.topicCluster,
  "contentTokenLimit",
  true
);
bindNumberSetting(elements.cfgUrlTokenWeightInput, CONFIG.topicCluster, "urlTokenWeight");
bindBooleanSetting(
  elements.cfgDynamicStopwordsEnabledToggle,
  CONFIG.topicCluster,
  "dynamicStopwordsEnabled"
);
bindNumberSetting(
  elements.cfgDynamicStopwordsMinDocRatioInput,
  CONFIG.topicCluster,
  "dynamicStopwordsMinDocRatio"
);
bindNumberSetting(
  elements.cfgDynamicStopwordsMinDocsInput,
  CONFIG.topicCluster,
  "dynamicStopwordsMinDocs",
  true
);

bindNumberSetting(elements.cfgThresholdHighInput, CONFIG.topicThresholds, "high");
bindNumberSetting(elements.cfgThresholdMediumInput, CONFIG.topicThresholds, "medium");
bindNumberSetting(elements.cfgThresholdLowInput, CONFIG.topicThresholds, "low");
bindNumberSetting(elements.cfgThresholdFallbackInput, CONFIG.topicThresholds, "fallback");

window.addEventListener("error", (event) => {
  reportError("popup", event?.error || event?.message || "Unknown error");
});

window.addEventListener("unhandledrejection", (event) => {
  reportError("popup", event?.reason || "Unhandled rejection");
});

Promise.all([loadSettings(), loadUndoStack()])
  .then(async () => {
    setTopicGroupingRunning(hasActiveTopicGrouping());
    await refresh();
    await updateTargetWindowLabel();
  })
  .catch((error) => reportError("startup", error));
