export const SETTINGS_KEY = "tabSorterSettings";
export const UNDO_KEY = "tabSorterUndoStack";
export const MAX_UNDO = 5;

export const CONFIG = {
  settings: {
    nameGroups: true,
    groupColor: "",
    collapseAfterGroup: false,
    lastVisitedOrder: "desc",
    topicSensitivity: "medium",
    activateTabsForContent: false
  },
  topicCluster: {
    kNearest: 5,
    minSharedTokens: 1,
    minAverageSimilarityFloor: 0.08,
    minAverageSimilarityScale: 0.75,
    adaptiveThreshold: true,
    adaptiveTargetSimilarity: 0.12,
    adaptiveMinThreshold: 0.06,
    adaptiveMaxThreshold: 0.28,
    adaptiveMaxPairs: 2000,
    useBigrams: true,
    titleKeywordLimit: 3,
    titleIncludeScores: false,
    debugLogGroups: true,
    debugKeywordLimit: 6,
    contentWeight: 0.3,
    contentTokenLimit: 30
  },
  topicThresholds: {
    high: 0.18,
    medium: 0.12,
    low: 0.08,
    fallback: 0.06
  }
};

export const settings = { ...CONFIG.settings };
