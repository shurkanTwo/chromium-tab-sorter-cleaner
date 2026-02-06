export const SETTING_BINDINGS = [
  { elementKey: "nameGroupsToggle", section: "settings", key: "nameGroups", type: "boolean" },
  { elementKey: "groupColorSelect", section: "settings", key: "groupColor", type: "select" },
  {
    elementKey: "collapseAfterGroupToggle",
    section: "settings",
    key: "collapseAfterGroup",
    type: "boolean"
  },
  {
    elementKey: "includePinnedTabsToggle",
    section: "settings",
    key: "includePinnedTabs",
    type: "boolean",
    onChange: "refresh"
  },
  {
    elementKey: "lastVisitedOrderSelect",
    section: "settings",
    key: "lastVisitedOrder",
    type: "select"
  },
  {
    elementKey: "topicSensitivitySelect",
    section: "settings",
    key: "topicSensitivity",
    type: "select"
  },
  {
    elementKey: "activateTabsForContentToggle",
    section: "settings",
    key: "activateTabsForContent",
    type: "boolean"
  },
  { elementKey: "cfgKNearestInput", section: "topicCluster", key: "kNearest", type: "number", integer: true },
  {
    elementKey: "cfgMinSharedTokensInput",
    section: "topicCluster",
    key: "minSharedTokens",
    type: "number",
    integer: true
  },
  {
    elementKey: "cfgMinAverageSimilarityFloorInput",
    section: "topicCluster",
    key: "minAverageSimilarityFloor",
    type: "number"
  },
  {
    elementKey: "cfgMinAverageSimilarityScaleInput",
    section: "topicCluster",
    key: "minAverageSimilarityScale",
    type: "number"
  },
  {
    elementKey: "cfgAdaptiveThresholdToggle",
    section: "topicCluster",
    key: "adaptiveThreshold",
    type: "boolean"
  },
  {
    elementKey: "cfgAdaptiveTargetSimilarityInput",
    section: "topicCluster",
    key: "adaptiveTargetSimilarity",
    type: "number"
  },
  {
    elementKey: "cfgAdaptiveMinThresholdInput",
    section: "topicCluster",
    key: "adaptiveMinThreshold",
    type: "number"
  },
  {
    elementKey: "cfgAdaptiveMaxThresholdInput",
    section: "topicCluster",
    key: "adaptiveMaxThreshold",
    type: "number"
  },
  {
    elementKey: "cfgAdaptiveMaxPairsInput",
    section: "topicCluster",
    key: "adaptiveMaxPairs",
    type: "number",
    integer: true
  },
  { elementKey: "cfgUseBigramsToggle", section: "topicCluster", key: "useBigrams", type: "boolean" },
  {
    elementKey: "cfgTitleKeywordLimitInput",
    section: "topicCluster",
    key: "titleKeywordLimit",
    type: "number",
    integer: true
  },
  {
    elementKey: "cfgTitleIncludeScoresToggle",
    section: "topicCluster",
    key: "titleIncludeScores",
    type: "boolean"
  },
  {
    elementKey: "cfgDebugLogGroupsToggle",
    section: "topicCluster",
    key: "debugLogGroups",
    type: "boolean"
  },
  {
    elementKey: "cfgDebugKeywordLimitInput",
    section: "topicCluster",
    key: "debugKeywordLimit",
    type: "number",
    integer: true
  },
  {
    elementKey: "cfgContentWeightInput",
    section: "topicCluster",
    key: "contentWeight",
    type: "number"
  },
  {
    elementKey: "cfgContentTokenLimitInput",
    section: "topicCluster",
    key: "contentTokenLimit",
    type: "number",
    integer: true
  },
  {
    elementKey: "cfgUrlTokenWeightInput",
    section: "topicCluster",
    key: "urlTokenWeight",
    type: "number"
  },
  {
    elementKey: "cfgDynamicStopwordsEnabledToggle",
    section: "topicCluster",
    key: "dynamicStopwordsEnabled",
    type: "boolean"
  },
  {
    elementKey: "cfgDynamicStopwordsMinDocRatioInput",
    section: "topicCluster",
    key: "dynamicStopwordsMinDocRatio",
    type: "number"
  },
  {
    elementKey: "cfgDynamicStopwordsMinDocsInput",
    section: "topicCluster",
    key: "dynamicStopwordsMinDocs",
    type: "number",
    integer: true
  },
  { elementKey: "cfgThresholdHighInput", section: "topicThresholds", key: "high", type: "number" },
  { elementKey: "cfgThresholdMediumInput", section: "topicThresholds", key: "medium", type: "number" },
  { elementKey: "cfgThresholdLowInput", section: "topicThresholds", key: "low", type: "number" },
  {
    elementKey: "cfgThresholdFallbackInput",
    section: "topicThresholds",
    key: "fallback",
    type: "number"
  }
];
