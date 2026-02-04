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
    minAverageSimilarityFloor: 0.06,
    minAverageSimilarityScale: 0.75,
    adaptiveThreshold: true,
    adaptiveTargetSimilarity: 0.1,
    adaptiveMinThreshold: 0.05,
    adaptiveMaxThreshold: 0.28,
    adaptiveMaxPairs: 2000,
    useBigrams: true,
    titleKeywordLimit: 3,
    titleIncludeScores: false,
    debugLogGroups: true,
    debugKeywordLimit: 10,
    contentWeight: 0.6,
    contentTokenLimit: 60,
    urlTokenWeight: 0.35
  },
  topicThresholds: {
    high: 0.16,
    medium: 0.1,
    low: 0.07,
    fallback: 0.05
  }
};

export const settings = { ...CONFIG.settings };
