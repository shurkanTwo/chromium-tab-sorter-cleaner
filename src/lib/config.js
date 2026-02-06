export const SETTINGS_KEY = "tabSorterSettings";
export const UNDO_KEY = "tabSorterUndoStack";
export const MAX_UNDO = 5;

export const DEFAULT_CONFIG = {
  settings: {
    nameGroups: true,
    groupColor: "",
    collapseAfterGroup: false,
    includePinnedTabs: false,
    lastVisitedOrder: "desc",
    topicSensitivity: "medium",
    activateTabsForContent: true
  },
  topicCluster: {
    kNearest: 10,
    minSharedTokens: 1,
    minAverageSimilarityFloor: 0.06,
    minAverageSimilarityScale: 0.6,
    adaptiveThreshold: true,
    adaptiveTargetSimilarity: 0.1,
    adaptiveMinThreshold: 0.05,
    adaptiveMaxThreshold: 0.2,
    adaptiveMaxPairs: 2000,
    useBigrams: true,
    titleKeywordLimit: 3,
    titleIncludeScores: false,
    debugLogGroups: true,
    debugKeywordLimit: 10,
    contentWeight: 0.85,
    contentTokenLimit: 120,
    urlTokenWeight: 0.35,
    dynamicStopwordsEnabled: true,
    dynamicStopwordsMinDocRatio: 0.8,
    dynamicStopwordsMinDocs: 3
  },
  topicThresholds: {
    high: 0.16,
    medium: 0.08,
    low: 0.06,
    fallback: 0.05
  }
};

export const CONFIG = {
  settings: { ...DEFAULT_CONFIG.settings },
  topicCluster: { ...DEFAULT_CONFIG.topicCluster },
  topicThresholds: { ...DEFAULT_CONFIG.topicThresholds }
};

export const settings = { ...DEFAULT_CONFIG.settings };
