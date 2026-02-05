import { CONFIG, SETTINGS_KEY, settings } from "./config.js";
import { elements } from "./ui.js";

function setCheckbox(element, value) {
  if (!element) return;
  element.checked = Boolean(value);
}

function setInputValue(element, value) {
  if (!element) return;
  element.value = String(value);
}

export async function loadSettings() {
  const data = await chrome.storage.local.get([SETTINGS_KEY]);
  const stored = data[SETTINGS_KEY];
  if (stored) {
    if (stored.settings || stored.topicCluster || stored.topicThresholds) {
      if (stored.settings) Object.assign(settings, stored.settings);
      if (stored.topicCluster) {
        Object.assign(CONFIG.topicCluster, stored.topicCluster);
      }
      if (stored.topicThresholds) {
        Object.assign(CONFIG.topicThresholds, stored.topicThresholds);
      }
    } else {
      Object.assign(settings, stored);
    }
  }
  setCheckbox(elements.nameGroupsToggle, settings.nameGroups);
  if (elements.groupColorSelect) elements.groupColorSelect.value = settings.groupColor || "";
  setCheckbox(elements.collapseAfterGroupToggle, settings.collapseAfterGroup);
  setCheckbox(elements.includePinnedTabsToggle, settings.includePinnedTabs || false);
  if (elements.lastVisitedOrderSelect) {
    elements.lastVisitedOrderSelect.value = settings.lastVisitedOrder || "desc";
  }
  if (elements.topicSensitivitySelect) {
    elements.topicSensitivitySelect.value = settings.topicSensitivity || "medium";
  }
  if (elements.activateTabsForContentToggle) {
    elements.activateTabsForContentToggle.checked =
      settings.activateTabsForContent || false;
  }

  setInputValue(elements.cfgKNearestInput, CONFIG.topicCluster.kNearest);
  setInputValue(elements.cfgMinSharedTokensInput, CONFIG.topicCluster.minSharedTokens);
  setInputValue(
    elements.cfgMinAverageSimilarityFloorInput,
    CONFIG.topicCluster.minAverageSimilarityFloor
  );
  setInputValue(
    elements.cfgMinAverageSimilarityScaleInput,
    CONFIG.topicCluster.minAverageSimilarityScale
  );
  setCheckbox(elements.cfgAdaptiveThresholdToggle, CONFIG.topicCluster.adaptiveThreshold);
  setInputValue(
    elements.cfgAdaptiveTargetSimilarityInput,
    CONFIG.topicCluster.adaptiveTargetSimilarity
  );
  setInputValue(elements.cfgAdaptiveMinThresholdInput, CONFIG.topicCluster.adaptiveMinThreshold);
  setInputValue(elements.cfgAdaptiveMaxThresholdInput, CONFIG.topicCluster.adaptiveMaxThreshold);
  setInputValue(elements.cfgAdaptiveMaxPairsInput, CONFIG.topicCluster.adaptiveMaxPairs);
  setCheckbox(elements.cfgUseBigramsToggle, CONFIG.topicCluster.useBigrams);
  setInputValue(elements.cfgTitleKeywordLimitInput, CONFIG.topicCluster.titleKeywordLimit);
  setCheckbox(elements.cfgTitleIncludeScoresToggle, CONFIG.topicCluster.titleIncludeScores);
  setCheckbox(elements.cfgDebugLogGroupsToggle, CONFIG.topicCluster.debugLogGroups);
  setInputValue(elements.cfgDebugKeywordLimitInput, CONFIG.topicCluster.debugKeywordLimit);
  setInputValue(elements.cfgContentWeightInput, CONFIG.topicCluster.contentWeight);
  setInputValue(elements.cfgContentTokenLimitInput, CONFIG.topicCluster.contentTokenLimit);
  setInputValue(elements.cfgUrlTokenWeightInput, CONFIG.topicCluster.urlTokenWeight);
  setCheckbox(
    elements.cfgDynamicStopwordsEnabledToggle,
    CONFIG.topicCluster.dynamicStopwordsEnabled
  );
  setInputValue(
    elements.cfgDynamicStopwordsMinDocRatioInput,
    CONFIG.topicCluster.dynamicStopwordsMinDocRatio
  );
  setInputValue(elements.cfgDynamicStopwordsMinDocsInput, CONFIG.topicCluster.dynamicStopwordsMinDocs);

  setInputValue(elements.cfgThresholdHighInput, CONFIG.topicThresholds.high);
  setInputValue(elements.cfgThresholdMediumInput, CONFIG.topicThresholds.medium);
  setInputValue(elements.cfgThresholdLowInput, CONFIG.topicThresholds.low);
  setInputValue(elements.cfgThresholdFallbackInput, CONFIG.topicThresholds.fallback);
}

export function saveSettings() {
  return chrome.storage.local.set({
    [SETTINGS_KEY]: {
      settings,
      topicCluster: CONFIG.topicCluster,
      topicThresholds: CONFIG.topicThresholds
    }
  });
}
