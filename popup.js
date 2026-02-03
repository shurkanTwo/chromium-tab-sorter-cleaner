const tabsList = document.getElementById("tabs");
const tabCount = document.getElementById("tabCount");
const detailsBody = document.getElementById("detailsBody");
const statusMessage = document.getElementById("statusMessage");
const statusProgressBar = document.getElementById("statusProgressBar");
const targetWindowLabel = document.getElementById("targetWindowLabel");
const targetWindowIdParam = Number.parseInt(
  new URLSearchParams(window.location.search).get("target") || "",
  10
);
const hasTargetWindowId = Number.isFinite(targetWindowIdParam);

const SETTINGS_KEY = "tabSorterSettings";
const UNDO_KEY = "tabSorterUndoStack";
const settings = {
  nameGroups: true,
  groupColor: "",
  collapseAfterGroup: false,
  lastVisitedOrder: "desc",
  topicSensitivity: "medium",
  activateTabsForContent: false
};
const TOPIC_CLUSTER_CONFIG = {
  kNearest: 5,
  minSharedTokens: 2,
  minAverageSimilarityFloor: 0.08,
  minAverageSimilarityScale: 0.75,
  adaptiveThreshold: true,
  adaptiveTargetSimilarity: 0.12,
  adaptiveMinThreshold: 0.06,
  adaptiveMaxThreshold: 0.28,
  adaptiveMaxPairs: 2000,
  useBigrams: true,
  titleKeywordLimit: 3,
  titleIncludeScores: true,
  debugLogGroups: true,
  debugKeywordLimit: 6,
  contentWeight: 0.3,
  contentTokenLimit: 30
};
const TOPIC_THRESHOLD_CONFIG = {
  high: 0.18,
  medium: 0.12,
  low: 0.08,
  fallback: 0.06
};

const closeDuplicatesButton = document.getElementById("closeDuplicates");
const sortAlphaButton = document.getElementById("sortAlpha");
const sortLastVisitedButton = document.getElementById("sortLastVisited");
const groupDomainButton = document.getElementById("groupDomain");
const groupTopicButton = document.getElementById("groupTopic");
const collapseGroupsButton = document.getElementById("collapseGroups");
const expandGroupsButton = document.getElementById("expandGroups");
const ungroupAllButton = document.getElementById("ungroupAll");
const undoActionButton = document.getElementById("undoAction");

const nameGroupsToggle = document.getElementById("nameGroups");
const groupColorSelect = document.getElementById("groupColor");
const collapseAfterGroupToggle = document.getElementById("collapseAfterGroup");
const lastVisitedOrderSelect = document.getElementById("lastVisitedOrder");
const topicSensitivitySelect = document.getElementById("topicSensitivity");
const activateTabsForContentToggle = document.getElementById(
  "activateTabsForContent"
);

const MAX_UNDO = 5;
const undoStack = [];

function getUndoStorage() {
  if (chrome.storage && chrome.storage.session) return chrome.storage.session;
  return chrome.storage.local;
}

async function getTargetWindowId() {
  if (hasTargetWindowId) return targetWindowIdParam;
  const current = await chrome.windows.getCurrent();
  return current.id;
}

async function updateTargetWindowLabel() {
  if (!targetWindowLabel) return;
  const targetId = await getTargetWindowId();
  targetWindowLabel.textContent = `Target window: ${targetId}`;
}

async function focusTargetWindow() {
  try {
    const targetId = await getTargetWindowId();
    const currentWindow = await chrome.windows.getCurrent();
    await chrome.windows.update(targetId, { focused: true });
    await sleep(50);
    await chrome.windows.update(currentWindow.id, { focused: true });
  } catch (error) {
    reportError("focusTargetWindow", error);
  }
}

function getToggleValue(toggle, fallback) {
  return toggle ? toggle.checked : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getActiveTabId() {
  const windowId = await getTargetWindowId();
  const [tab] = await chrome.tabs.query({ windowId, active: true });
  return tab?.id ?? null;
}

function isValidTabMeta(meta) {
  return Boolean(meta && meta.tab && Number.isFinite(meta.tab.id));
}

function getTitleText(meta) {
  const title = meta.tab.title || "";
  return title.trim();
}

function getUrlTokens(url) {
  if (!url) return [];
  try {
    const parsed = new URL(url);
    const host = parsed.hostname || "";
    const segments = (parsed.pathname || "")
      .split("/")
      .filter(Boolean)
      .slice(0, 2)
      .join(" ");
    const combined = `${host} ${segments}`.trim();
    if (!combined) return [];
    return tokenize(combined).filter((token) => {
      if (/^\d+$/.test(token)) return false;
      if (/^[a-z0-9]+$/.test(token) && token.length <= 2) return false;
      return true;
    });
  } catch (error) {
    return [];
  }
}

function setStatus(message) {
  if (!statusMessage) return;
  statusMessage.textContent = message || "";
}

function formatCount(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function setProgress(percent) {
  if (!statusProgressBar) return;
  const safeValue = Number.isFinite(percent) ? percent : 0;
  const clamped = Math.min(100, Math.max(0, safeValue));
  statusProgressBar.style.width = `${clamped}%`;
}

function reportError(context, error) {
  const message = error?.message ? error.message : String(error || "Unknown error");
  setStatus(`Error in ${context}: ${message}`);
}

function isMissingTabError(error) {
  const message = (error?.message || String(error || "")).toLowerCase();
  return message.includes("no tab with id") || message.includes("unknown tab id");
}

async function runIgnoringMissingTab(promise, context) {
  try {
    return await promise;
  } catch (error) {
    if (isMissingTabError(error)) return null;
    reportError(context, error);
    return null;
  }
}

async function loadUndoStack() {
  const storage = getUndoStorage();
  const data = await storage.get([UNDO_KEY]);
  if (Array.isArray(data[UNDO_KEY])) {
    undoStack.splice(0, undoStack.length, ...data[UNDO_KEY]);
  }
  setUndoEnabled();
}

async function saveUndoStack() {
  const storage = getUndoStorage();
  await storage.set({ [UNDO_KEY]: undoStack });
}

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

function abbreviateDomain(hostname) {
  if (!hostname) return "";
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length === 0) return "";
  const letters = parts.map((part) => part[0]).join("");
  return letters.slice(0, 6).toUpperCase();
}

function abbreviateKeyword(keyword) {
  if (!keyword) return "";
  if (keyword.length <= 12) return keyword;
  return `${keyword.slice(0, 11)}…`;
}

const TOKEN_REGEX = (() => {
  try {
    return new RegExp("[^\\p{L}\\p{N}]+", "gu");
  } catch (error) {
    return /[^a-z0-9]+/g;
  }
})();

const MARKS_REGEX = (() => {
  try {
    return new RegExp("\\p{M}+", "gu");
  } catch (error) {
    return null;
  }
})();

function tokenize(text) {
  if (!text) return [];
  let cleaned = text.toLowerCase();
  if (cleaned.normalize) {
    cleaned = cleaned.normalize("NFKD");
  }
  if (MARKS_REGEX) {
    cleaned = cleaned.replace(MARKS_REGEX, "");
  }
  cleaned = cleaned.replace(TOKEN_REGEX, " ");
  const raw = cleaned.split(" ").filter(Boolean);
  const stopwordsEnglish = [
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "have", "how", "in", "is", "it", "its", "of", "on", "or",
    "that", "the", "this", "to", "was", "were", "what", "when", "where",
    "who", "why", "with", "you", "your", "our", "we", "us", "they",
    "their", "them", "there", "here", "about", "into", "over", "under"
  ];
  const stopwordsGerman = [
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "eines",
    "einem", "einen", "und", "oder", "aber", "doch", "dass", "daß", "nicht",
    "kein", "keine", "keiner", "keines", "keinem", "keinen", "im", "am", "an",
    "auf", "aus", "bei", "mit", "nach", "von", "vor", "zu", "zum", "zur",
    "über", "unter", "für", "ist", "sind", "war", "waren", "wie", "was",
    "wer", "wo", "wann", "warum", "wieso", "welche", "welcher", "welches",
    "mehr", "anzeige", "anzeigen", "sie", "ihr", "ihre", "ihren", "ihrem",
    "ihres", "wir", "uns", "euch", "euer", "eure"
  ];
  const stopwordsDutch = [
    "de", "het", "een", "en", "of", "maar", "dat", "die", "dit", "in", "is",
    "op", "te", "van", "voor", "met", "zonder", "naar", "bij", "aan", "uit",
    "ook", "niet", "wel", "we", "wij", "jij", "je", "u", "hun", "ze", "zij",
    "ons", "onze", "jullie", "waar", "wanneer", "waarom"
  ];
  const stopwordsSpanish = [
    "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "pero",
    "de", "del", "al", "en", "para", "por", "con", "sin", "sobre", "entre",
    "como", "que", "qué", "quien", "quién", "cuando", "cuándo", "donde",
    "dónde", "porque", "porqué", "si", "sí", "no", "ya", "más", "muy"
  ];
  const stopwordsWeb = [
    "https", "http", "www", "com", "net", "org", "html", "htm", "php", "asp",
    "css", "js", "json", "xml", "svg", "png", "jpg", "jpeg", "gif", "webp",
    "amp", "utm", "ref", "referrer", "source", "medium", "campaign",
    "index", "home", "default", "login", "signin", "signup",
    "account", "accounts", "user", "users", "profile", "profiles",
    "settings", "setting", "preferences", "prefs", "dashboard", "admin",
    "auth", "oauth", "callback", "redirect", "locale", "lang", "language",
    "session", "sessions", "token", "tokens", "api", "v1", "v2", "v3",
    "docs", "documentation", "help", "support", "faq", "terms", "privacy",
    "policy", "cookie", "cookies", "consent", "about", "contact", "search",
    "news", "blog", "articles", "article", "post", "posts", "tag", "tags",
    "category", "categories", "page", "pages", "view", "views", "edit",
    "new", "create", "update", "delete", "id", "ids", "detail", "details"
  ];
  const stopwordsCssJs = [
    "div", "span", "class", "id", "style", "display", "flex", "block",
    "inline", "grid", "webkit", "moz", "ms", "px", "em", "rem",
    "font", "woff", "woff2", "ttf", "otf", "rgba", "rgb", "url",
    "border", "margin", "padding", "center", "box", "banner", "justify",
    "sans", "none", "trustarc", "align", "justify-content", "text",
    "color", "background", "width", "height", "max", "min", "auto",
    "left", "right", "top", "bottom", "relative", "absolute", "fixed",
    "sticky", "position", "overflow", "hidden", "visible", "opacity",
    "border-radius", "box-shadow", "z-index", "line-height", "font-family",
    "font-size", "font-weight", "letter-spacing", "text-align", "uppercase",
    "lowercase", "capitalize", "transform", "translate", "scale", "rotate",
    "transition", "animation", "keyframes", "ease", "linear", "hover",
    "active", "focus", "before", "after", "content", "var", "calc",
    "grid-template", "grid-area", "gap", "row", "column", "cols", "rows",
    "padding-left", "padding-right", "padding-top", "padding-bottom",
    "margin-left", "margin-right", "margin-top", "margin-bottom",
    "border-top", "border-right", "border-bottom", "border-left",
    "display-block", "display-inline", "display-flex", "display-grid",
    "script", "scripts", "javascript", "typescript", "js", "ts",
    "console", "window", "document", "event", "events", "target",
    "handler", "click", "submit", "input", "change", "keydown", "keyup",
    "mousemove", "mouseenter", "mouseleave", "scroll", "resize",
    "function", "const", "let", "var", "return", "true", "false", "null",
    "undefined", "async", "await", "promise", "then", "catch", "finally",
    "json", "object", "array", "string", "number", "boolean", "prototype"
  ];
  const stopwords = new Set([
    ...stopwordsEnglish,
    ...stopwordsGerman,
    ...stopwordsDutch,
    ...stopwordsSpanish,
    ...stopwordsWeb,
    ...stopwordsCssJs
  ]);
  const stemmed = raw.map((token) => stemToken(token));
  return stemmed.filter((token) => token.length > 1 && !stopwords.has(token));
}

function stemToken(token) {
  if (!token) return "";
  if (token.length <= 3) return token;
  const suffixes = [
    "ments", "ment", "tions", "tion", "ings", "ing", "ers", "er",
    "ies", "ied", "ly", "ed", "es", "s"
  ];
  for (const suffix of suffixes) {
    if (token.length > suffix.length + 2 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

function addBigrams(tokens) {
  if (!TOPIC_CLUSTER_CONFIG.useBigrams || tokens.length < 2) return tokens;
  const result = [...tokens];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const left = tokens[i];
    const right = tokens[i + 1];
    if (!left || !right) continue;
    result.push(`${left}_${right}`);
  }
  return result;
}

function getTitleTokens(meta) {
  const titleTokens = tokenize(getTitleText(meta));
  const urlTokens = getUrlTokens(meta.tab?.url || "");
  const withBigrams = addBigrams(titleTokens);
  return withBigrams.concat(urlTokens);
}

function buildVector(tokens, idfMap) {
  const map = new Map();
  for (const token of tokens) {
    map.set(token, (map.get(token) || 0) + 1);
  }
  if (idfMap) {
    for (const [key, value] of map.entries()) {
      const idf = idfMap.get(key) || 1;
      map.set(key, value * idf);
    }
  }
  return map;
}

function buildTitleVector(meta, idfMap) {
  const vector = buildVector(getTitleTokens(meta), idfMap);
  for (const [key, value] of vector.entries()) {
    vector.set(key, value * 2);
  }
  return vector;
}

function limitVector(vector, maxKeys) {
  if (vector.size <= maxKeys) return vector;
  const sorted = Array.from(vector.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return new Map(sorted.slice(0, maxKeys));
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [key, value] of a.entries()) {
    normA += value * value;
    if (b.has(key)) {
      dot += value * b.get(key);
    }
  }
  for (const value of b.values()) {
    normB += value * value;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function mergeVectors(target, source) {
  for (const [key, value] of source.entries()) {
    target.set(key, (target.get(key) || 0) + value);
  }
}

function normalizeVector(vector) {
  let norm = 0;
  for (const value of vector.values()) {
    norm += value * value;
  }
  if (norm === 0) return vector;
  const scale = 1 / Math.sqrt(norm);
  for (const [key, value] of vector.entries()) {
    vector.set(key, value * scale);
  }
  return vector;
}

function buildIdfMap(tabsWithMeta, includeContent, contentByTabId) {
  const docCounts = new Map();
  const totalDocs = tabsWithMeta.length || 1;

  for (const meta of tabsWithMeta) {
    const tokens = new Set(getTitleTokens(meta));
    if (includeContent) {
      const content = contentByTabId.get(meta.tab.id) || "";
      if (content) {
        tokenize(content).forEach((token) => tokens.add(token));
      }
    }
    for (const token of tokens) {
      docCounts.set(token, (docCounts.get(token) || 0) + 1);
    }
  }

  const idfMap = new Map();
  for (const [token, df] of docCounts.entries()) {
    const idf = Math.log((totalDocs + 1) / (df + 1)) + 1;
    idfMap.set(token, idf);
  }

  return idfMap;
}

function getTabTimes() {
  return chrome.runtime.sendMessage({ type: "getTabTimes" });
}

function setUndoEnabled() {
  if (!undoActionButton) return;
  undoActionButton.disabled = undoStack.length === 0;
}

async function captureState() {
  const windowId = await getTargetWindowId();
  const [tabs, groups] = await Promise.all([
    chrome.tabs.query({ windowId }),
    chrome.tabGroups.query({ windowId })
  ]);

  return {
    windowId,
    capturedAt: Date.now(),
    tabs: tabs.map((tab) => ({
      id: tab.id,
      index: tab.index,
      groupId: tab.groupId,
      url: tab.url || "",
      title: tab.title || "",
      pinned: tab.pinned,
      active: tab.active
    })),
    groups: groups.map((group) => ({
      id: group.id,
      title: group.title || "",
      color: group.color || "",
      collapsed: group.collapsed
    }))
  };
}

async function restoreState(state) {
  if (!state) return;
  const windowId = await getTargetWindowId();
  const tabsNow = await chrome.tabs.query({ windowId });
  const tabsById = new Map(tabsNow.map((tab) => [tab.id, tab]));
  const desiredEntries = [];

  for (const entry of state.tabs) {
    let tab = tabsById.get(entry.id);
    if (!tab) {
      tab = await chrome.tabs.create({
        windowId,
        url: entry.url || "chrome://newtab",
        index: desiredEntries.length,
        pinned: entry.pinned,
        active: false
      });
      tabsById.set(tab.id, tab);
    } else if (tab.pinned !== entry.pinned) {
      await runIgnoringMissingTab(
        chrome.tabs.update(tab.id, { pinned: entry.pinned }),
        "tabs.update"
      );
    }
    desiredEntries.push({ entry, tabId: tab.id });
  }

  const idsToUngroup = desiredEntries
    .map((item) => item.tabId)
    .filter((id) => {
      const tab = tabsById.get(id);
      return tab && tab.groupId !== -1;
    });
  if (idsToUngroup.length > 0) {
    await runIgnoringMissingTab(chrome.tabs.ungroup(idsToUngroup), "tabs.ungroup");
  }

  for (let index = 0; index < desiredEntries.length; index += 1) {
    await runIgnoringMissingTab(
      chrome.tabs.move(desiredEntries[index].tabId, { index }),
      "tabs.move"
    );
  }

  const groupsByOldId = new Map();
  for (const item of desiredEntries) {
    const groupId = item.entry.groupId;
    if (groupId === -1) continue;
    const list = groupsByOldId.get(groupId) || [];
    list.push(item.tabId);
    groupsByOldId.set(groupId, list);
  }

  const groupMetaById = new Map(state.groups.map((group) => [group.id, group]));
  for (const [oldGroupId, tabIds] of groupsByOldId.entries()) {
    const newGroupId = await runIgnoringMissingTab(
      chrome.tabs.group({
        tabIds,
        createProperties: { windowId }
      }),
      "tabs.group"
    );
    if (newGroupId == null) continue;
    const meta = groupMetaById.get(oldGroupId);
    if (meta) {
      const updatePayload = {};
      if (meta.title) updatePayload.title = meta.title;
      if (meta.color) updatePayload.color = meta.color;
      if (typeof meta.collapsed === "boolean") {
        updatePayload.collapsed = meta.collapsed;
      }
      if (Object.keys(updatePayload).length > 0) {
        await runIgnoringMissingTab(
          chrome.tabGroups.update(newGroupId, updatePayload),
          "tabGroups.update"
        );
      }
    }
  }

  const activeEntry = desiredEntries.find((item) => item.entry.active);
  if (activeEntry) {
    await runIgnoringMissingTab(
      chrome.tabs.update(activeEntry.tabId, { active: true }),
      "tabs.update"
    );
  }

  await refresh();
}

async function runWithUndo(action) {
  if (!action) return;
  try {
    if (!undoActionButton) {
      await action();
      return;
    }
    const state = await captureState();
    undoStack.push(state);
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }
    setUndoEnabled();
    await saveUndoStack();
    await action();
  } catch (error) {
    reportError(action?.name || "action", error);
  }
}

async function undoLastAction() {
  if (undoStack.length === 0) return;
  const state = undoStack.pop();
  setUndoEnabled();
  await saveUndoStack();
  await restoreState(state);
}

async function loadSettings() {
  const data = await chrome.storage.local.get([SETTINGS_KEY]);
  if (data[SETTINGS_KEY]) {
    Object.assign(settings, data[SETTINGS_KEY]);
  }
  if (nameGroupsToggle) nameGroupsToggle.checked = settings.nameGroups;
  if (groupColorSelect) groupColorSelect.value = settings.groupColor || "";
  if (collapseAfterGroupToggle) {
    collapseAfterGroupToggle.checked = settings.collapseAfterGroup;
  }
  if (lastVisitedOrderSelect) {
    lastVisitedOrderSelect.value = settings.lastVisitedOrder || "desc";
  }
  if (topicSensitivitySelect) {
    topicSensitivitySelect.value = settings.topicSensitivity || "medium";
  }
  if (activateTabsForContentToggle) {
    activateTabsForContentToggle.checked =
      settings.activateTabsForContent || false;
  }
}

function saveSettings() {
  return chrome.storage.local.set({ [SETTINGS_KEY]: settings });
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

async function fetchLastVisitedBatch(urls) {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const results = new Map();
  const entries = await Promise.all(
    unique.map(async (url) => {
      const visits = await chrome.history.getVisits({ url });
      if (!visits || visits.length === 0) return [url, null];
      const last = visits.reduce((latest, visit) => {
        return visit.visitTime > latest.visitTime ? visit : latest;
      }, visits[0]);
      return [url, last.visitTime];
    })
  );
  for (const [url, lastVisited] of entries) {
    results.set(url, lastVisited);
  }
  return results;
}

async function fetchTabsWithMeta() {
  const windowId = await getTargetWindowId();
  const [tabs, timeData] = await Promise.all([
    chrome.tabs.query({ windowId }),
    getTabTimes()
  ]);

  const timeByTabId = timeData?.timeByTabId || {};
  const lastVisitedByUrl = await fetchLastVisitedBatch(
    tabs.map((tab) => tab.url)
  );
  const withMeta = tabs
    .filter((tab) => tab && Number.isFinite(tab.id) && !tab.pinned)
    .map((tab) => ({
      tab,
      lastVisited: lastVisitedByUrl.get(tab.url) || null,
      timeSpent: timeByTabId[tab.id] || 0,
      hostname: getHostname(tab.url)
    }));

  return withMeta;
}

function isScriptableUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === "chrome.google.com" ||
      host === "chromewebstore.google.com"
    ) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function fetchTabContents(tabsWithMeta, maxLength = 6000) {
  const results = new Map();
  const stats = {
    eligible: 0,
    success: 0,
    restricted: 0
  };
  const activateTabs = getToggleValue(
    activateTabsForContentToggle,
    settings.activateTabsForContent
  );
  const tabs = tabsWithMeta
    .filter(isValidTabMeta)
    .map((meta) => meta.tab);
  const eligibleTabs = [];
  const hostPermissionCache = new Map();

  for (const tab of tabs) {
    if (isScriptableUrl(tab.url)) {
      eligibleTabs.push(tab);
    } else if (tab?.url) {
      stats.restricted += 1;
    }
  }

  stats.eligible = eligibleTabs.length;
  if (eligibleTabs.length === 0) {
    return { contentsByTabId: results, stats };
  }

  let index = 0;
  let completed = 0;
  const concurrency = activateTabs ? 1 : Math.min(4, eligibleTabs.length);
  const timeoutMs = 4000;
  const originalActiveTabId = activateTabs ? await getActiveTabId() : null;

  async function hasHostPermission(url) {
    if (!chrome.permissions?.contains) return null;
    try {
      const origin = new URL(url).origin;
      if (hostPermissionCache.has(origin)) {
        return hostPermissionCache.get(origin);
      }
      const allowed = await chrome.permissions.contains({
        origins: [`${origin}/*`]
      });
      hostPermissionCache.set(origin, allowed);
      return allowed;
    } catch (error) {
      return null;
    }
  }

  async function runWithTimeout(promise, ms) {
    let timer = null;
    try {
      return await Promise.race([
        Promise.resolve(promise),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(null), ms);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function executeContentScript(tabId) {
    const payload = {
      target: { tabId, allFrames: false },
      func: (limit) => {
        const primary =
          document.querySelector("main, article, [role='main']") ||
          document.body ||
          document.documentElement;
        if (!primary) return "";
        const clone = primary.cloneNode(true);
        clone.querySelectorAll("script, style, noscript").forEach((node) =>
          node.remove()
        );
        clone.querySelectorAll(
          "[id*='cookie' i],[class*='cookie' i],[id*='consent' i],[class*='consent' i],[id*='banner' i],[class*='banner' i],[id*='gdpr' i],[class*='gdpr' i],[id*='privacy' i],[class*='privacy' i]"
        ).forEach((node) => node.remove());
        const raw = clone.textContent || "";
        return raw.slice(0, limit);
      },
      args: [maxLength],
      injectImmediately: true
    };

    return new Promise((resolve, reject) => {
      try {
        chrome.scripting.executeScript(payload, (result) => {
          if (chrome.runtime.lastError) {
            const message =
              chrome.runtime.lastError.message ||
              String(chrome.runtime.lastError);
            reject(new Error(message));
            return;
          }
          resolve(result);
        });
      } catch (error) {
        const message = error?.message ? error.message : String(error || "");
        if (
          message.includes("injectImmediately") ||
          message.includes("Unexpected property") ||
          message.includes("Invalid")
        ) {
          const fallback = { ...payload };
          delete fallback.injectImmediately;
          try {
            chrome.scripting.executeScript(fallback, (result) => {
              if (chrome.runtime.lastError) {
                const errMessage =
                  chrome.runtime.lastError.message ||
                  String(chrome.runtime.lastError);
                reject(new Error(errMessage));
                return;
              }
              resolve(result);
            });
          } catch (fallbackError) {
            reject(fallbackError);
          }
          return;
        }
        reject(error);
      }
    });
  }

  async function activateTab(tabId) {
    try {
      await chrome.tabs.update(tabId, { active: true });
    } catch (error) {
      return;
    }
    await sleep(200);
  }

  async function getFreshTab(tabId) {
    try {
      return await chrome.tabs.get(tabId);
    } catch (error) {
      return null;
    }
  }

  async function scanTab(tab) {
    if (activateTabs) {
      await activateTab(tab.id);
    }

    const currentTab = (await getFreshTab(tab.id)) || tab;
    if (currentTab.discarded) return;
    if (currentTab.status && currentTab.status !== "complete") return;
    const hasPermission = await hasHostPermission(currentTab.url || "");
    if (hasPermission === false) return;

    let injected = null;
    try {
      injected = await runWithTimeout(
        executeContentScript(currentTab.id),
        timeoutMs
      );
    } catch (error) {
      const message = error?.message || String(error || "");
      if (message.toLowerCase().includes("cannot access contents")) {
        stats.restricted += 1;
      }
      return;
    }
    if (!injected) return;
    const text = injected?.[0]?.result || "";
    if (text.trim().length > 0) {
      stats.success += 1;
    }
    results.set(currentTab.id, text);
  }

  async function worker() {
    while (index < eligibleTabs.length) {
      const tab = eligibleTabs[index];
      index += 1;
      await scanTab(tab);
      completed += 1;
      const progress = eligibleTabs.length
        ? (completed / eligibleTabs.length) * 100
        : 0;
      setProgress(progress);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  setProgress(100);
  if (activateTabs && originalActiveTabId != null) {
    try {
      await chrome.tabs.update(originalActiveTabId, { active: true });
    } catch (error) {
      // Ignore focus restore errors.
    }
  }
  return { contentsByTabId: results, stats };
}

async function ensureContentAccess() {
  if (!chrome.permissions?.contains || !chrome.permissions?.request) {
    return false;
  }
  const granted = await chrome.permissions.contains({
    origins: ["<all_urls>"]
  });
  if (granted) return true;
  try {
    return await chrome.permissions.request({ origins: ["<all_urls>"] });
  } catch (error) {
    return false;
  }
}

function renderTabs(tabsWithMeta) {
  tabsList.innerHTML = "";
  tabCount.textContent = tabsWithMeta.length.toString();

  tabsWithMeta.forEach((meta) => {
    if (!meta || !meta.tab) return;
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
      runIgnoringMissingTab(
        chrome.tabs.update(meta.tab.id, { active: true }),
        "tabs.update"
      );
    });

    tabsList.appendChild(li);
  });
}

async function closeDuplicates() {
  const windowId = await getTargetWindowId();
  const tabs = await chrome.tabs.query({ windowId });
  const candidates = tabs.filter((tab) => tab && !tab.pinned);
  const seen = new Map();
  const toClose = [];

  candidates.forEach((tab) => {
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

  if (toClose.length > 0) {
    setStatus(
      `Closed ${formatCount(toClose.length, "duplicate", "duplicates")} out of ${formatCount(
        candidates.length,
        "tab",
        "tabs"
      )}.`
    );
  } else {
    setStatus(
      `No duplicate tabs found in ${formatCount(candidates.length, "tab", "tabs")}.`
    );
  }
  await refresh();
}

async function moveTabsInOrder(sorted) {
  const windowId = await getTargetWindowId();
  const pinnedCount = (await chrome.tabs.query({
    windowId,
    pinned: true
  })).length;
  for (let index = 0; index < sorted.length; index += 1) {
    const tab = sorted[index].tab;
    await runIgnoringMissingTab(
      chrome.tabs.move(tab.id, { index: pinnedCount + index }),
      "tabs.move"
    );
  }
}

async function sortWithGroups(comparator, metaById) {
  const windowId = await getTargetWindowId();
  const tabs = await chrome.tabs.query({ windowId });
  const pinnedCount = tabs.filter((tab) => tab.pinned).length;
  const candidates = tabs.filter((tab) => !tab.pinned);
  const groupMap = new Map();
  const topLevel = [];

  for (const tab of candidates) {
    if (tab.groupId === -1) {
      topLevel.push(tab);
      continue;
    }
    const list = groupMap.get(tab.groupId) || [];
    list.push(tab);
    groupMap.set(tab.groupId, list);
  }

  const groupEntries = Array.from(groupMap.entries()).map(([groupId, list]) => {
    const sortedTabs = [...list].sort((a, b) =>
      comparator(metaById.get(a.id), metaById.get(b.id))
    );
    return { groupId, sortedTabs };
  });

  groupEntries.sort((a, b) => {
    const indexA = Math.min(...a.sortedTabs.map((tab) => tab.index));
    const indexB = Math.min(...b.sortedTabs.map((tab) => tab.index));
    return indexA - indexB;
  });

  for (const entry of groupEntries) {
    const startIndex = Math.min(...entry.sortedTabs.map((tab) => tab.index));
    for (let offset = 0; offset < entry.sortedTabs.length; offset += 1) {
      const tab = entry.sortedTabs[offset];
      await runIgnoringMissingTab(
        chrome.tabs.move(tab.id, { index: startIndex + offset }),
        "tabs.move"
      );
    }
  }

  const refreshed = await chrome.tabs.query({ windowId });
  const refreshedGroupMap = new Map();
  const refreshedTopLevel = [];

  for (const tab of refreshed) {
    if (tab.pinned) continue;
    if (tab.groupId === -1) {
      refreshedTopLevel.push(tab);
      continue;
    }
    const list = refreshedGroupMap.get(tab.groupId) || [];
    list.push(tab);
    refreshedGroupMap.set(tab.groupId, list);
  }

  const blocks = [];
  for (const tab of refreshedTopLevel) {
    blocks.push({ type: "tab", id: tab.id });
  }
  for (const [groupId, list] of refreshedGroupMap.entries()) {
    const sortedTabs = [...list].sort((a, b) =>
      comparator(metaById.get(a.id), metaById.get(b.id))
    );
    blocks.push({
      type: "group",
      id: groupId,
      size: sortedTabs.length,
      representative: metaById.get(sortedTabs[0]?.id) || null
    });
  }

  blocks.sort((a, b) => {
    const metaA = a.type === "tab" ? metaById.get(a.id) : a.representative;
    const metaB = b.type === "tab" ? metaById.get(b.id) : b.representative;
    if (!metaA && !metaB) return 0;
    if (!metaA) return 1;
    if (!metaB) return -1;
    return comparator(metaA, metaB);
  });

  let targetIndex = 0;
  for (const block of blocks) {
    if (block.type === "tab") {
      await runIgnoringMissingTab(
        chrome.tabs.move(block.id, { index: pinnedCount + targetIndex }),
        "tabs.move"
      );
      targetIndex += 1;
      continue;
    }
    await chrome.tabGroups.move(block.id, { index: pinnedCount + targetIndex });
    targetIndex += block.size || 0;
  }
}

async function sortAlphabetically() {
  const tabsWithMeta = await fetchTabsWithMeta();
  const windowId = await getTargetWindowId();
  const tabs = await chrome.tabs.query({ windowId });
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
    await sortWithGroups(comparator, metaById);
  } else {
    await moveTabsInOrder(sorted);
  }
  setStatus(`Sorted ${formatCount(tabsWithMeta.length, "tab", "tabs")} A-Z by title.`);
  await refresh();
}

async function sortByLastVisited() {
  const tabsWithMeta = await fetchTabsWithMeta();
  const windowId = await getTargetWindowId();
  const tabs = await chrome.tabs.query({ windowId });
  const metaById = new Map(tabsWithMeta.map((meta) => [meta.tab.id, meta]));
  const descending = lastVisitedOrderSelect.value !== "asc";
  const comparator = (a, b) => {
    const timeA = a.lastVisited || 0;
    const timeB = b.lastVisited || 0;
    return descending ? timeB - timeA : timeA - timeB;
  };
  const sorted = [...tabsWithMeta].sort(comparator);

  if (tabs.some((tab) => tab.groupId !== -1)) {
    await sortWithGroups(comparator, metaById);
  } else {
    await moveTabsInOrder(sorted);
  }
  setStatus(
    `Sorted ${formatCount(
      tabsWithMeta.length,
      "tab",
      "tabs"
    )} by last visited (${descending ? "newest first" : "oldest first"}).`
  );
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

  const windowId = await getTargetWindowId();
  const useNames = nameGroupsToggle.checked;
  const color = groupColorSelect.value;
  const collapseAfter = collapseAfterGroupToggle.checked;

  let currentHost = null;
  let currentGroupTabs = [];
  let groupsCreated = 0;
  let groupedTabs = 0;

  async function finalizeGroup() {
    if (currentGroupTabs.length === 0) {
      currentGroupTabs = [];
      return;
    }
    const groupId = await runIgnoringMissingTab(
      chrome.tabs.group({
        tabIds: currentGroupTabs,
        createProperties: { windowId }
      }),
      "tabs.group"
    );
    if (groupId == null) {
      currentGroupTabs = [];
      return;
    }
    groupsCreated += 1;
    groupedTabs += currentGroupTabs.length;
    const updatePayload = {};
    if (useNames && currentHost) {
      updatePayload.title = abbreviateDomain(currentHost);
    }
    if (color) updatePayload.color = color;
    if (collapseAfter) updatePayload.collapsed = true;
    if (Object.keys(updatePayload).length > 0) {
      await runIgnoringMissingTab(
        chrome.tabGroups.update(groupId, updatePayload),
        "tabGroups.update"
      );
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

  if (groupsCreated > 0) {
    setStatus(
      `Grouped ${formatCount(groupedTabs, "tab", "tabs")} into ${formatCount(
        groupsCreated,
        "group",
        "groups"
      )} by domain.`
    );
  } else {
    setStatus(
      `No domain groups created from ${formatCount(sorted.length, "tab", "tabs")}.`
    );
  }
  await refresh();
}

function titleCase(word) {
  if (!word) return "";
  return `${word[0].toUpperCase()}${word.slice(1)}`;
}

function pickTopKeywordEntries(vectors, limit) {
  const counts = new Map();
  for (const vector of vectors) {
    for (const [key, value] of vector.entries()) {
      counts.set(key, (counts.get(key) || 0) + value);
    }
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0].length - a[0].length;
  });
  return sorted.slice(0, limit);
}

function buildTopicLabel(vectors) {
  const entries = pickTopKeywordEntries(
    vectors,
    TOPIC_CLUSTER_CONFIG.titleKeywordLimit
  );
  if (entries.length === 0) return "Topic";
  const labels = entries
    .map(([word, score]) => {
      const token = titleCase(word);
      if (!token) return "";
      if (!TOPIC_CLUSTER_CONFIG.titleIncludeScores) return token;
      return `${token}(${score.toFixed(2)})`;
    })
    .filter(Boolean);
  const joined = labels.join(" ");
  return abbreviateKeyword(joined);
}

function buildDebugKeywords(vectors) {
  const entries = pickTopKeywordEntries(
    vectors,
    TOPIC_CLUSTER_CONFIG.debugKeywordLimit
  );
  return entries.map(([word, score]) => `${word}:${score.toFixed(2)}`);
}

function getTopicThreshold() {
  const value = topicSensitivitySelect
    ? topicSensitivitySelect.value
    : settings.topicSensitivity;
  if (value === "high") return TOPIC_THRESHOLD_CONFIG.high;
  if (value === "low") return TOPIC_THRESHOLD_CONFIG.low;
  return TOPIC_THRESHOLD_CONFIG.medium;
}

async function ungroupAllTabsInternal(shouldRefresh) {
  const windowId = await getTargetWindowId();
  const tabs = await chrome.tabs.query({ windowId });
  const groupedTabs = tabs.filter(
    (tab) => !tab.pinned && tab.groupId !== -1
  );
  if (groupedTabs.length === 0) return 0;
  await runIgnoringMissingTab(
    chrome.tabs.ungroup(groupedTabs.map((tab) => tab.id)),
    "tabs.ungroup"
  );
  if (shouldRefresh) await refresh();
  return groupedTabs.length;
}

async function groupByTopic() {
  const activateTabs = getToggleValue(
    activateTabsForContentToggle,
    settings.activateTabsForContent
  );
  setStatus(`Grouping topics${activateTabs ? " (activating tabs)..." : "..."}`);
  setProgress(0);
  const tabsWithMeta = await fetchTabsWithMeta();
  const safeTabsWithMeta = tabsWithMeta.filter(isValidTabMeta);
  await ungroupAllTabsInternal(false);
  let contentByTabId = new Map();
  let contentStats = {
    eligible: 0,
    success: 0,
    restricted: 0
  };
  const hasContentAccess = await ensureContentAccess();
  if (hasContentAccess) {
    const contentResult = await fetchTabContents(safeTabsWithMeta);
    contentByTabId = contentResult.contentsByTabId;
    contentStats = contentResult.stats;
  }

  function buildVectorForTab(meta, includeContent, idfMap) {
    const vector = buildTitleVector(meta, idfMap);

    if (includeContent) {
      const content = contentByTabId.get(meta.tab.id) || "";
      if (content) {
        const contentVector = limitVector(
          buildVector(addBigrams(tokenize(content)), idfMap),
          TOPIC_CLUSTER_CONFIG.contentTokenLimit
        );
        for (const [key, value] of contentVector.entries()) {
          contentVector.set(key, value * TOPIC_CLUSTER_CONFIG.contentWeight);
        }
        mergeVectors(vector, contentVector);
      }
    }
    return normalizeVector(vector);
  }

  function clusterTabs(threshold, includeContent, idfMap) {
    const metas = safeTabsWithMeta;
    const vectors = metas.map((meta) =>
      buildVectorForTab(meta, includeContent, idfMap)
    );
    const titleTokenSets = metas.map((meta) =>
      new Set(tokenize(getTitleText(meta)))
    );
    const parent = new Array(metas.length).fill(0).map((_, index) => index);
    const kNearest = TOPIC_CLUSTER_CONFIG.kNearest;
    const minSharedTokens = TOPIC_CLUSTER_CONFIG.minSharedTokens;
    let effectiveThreshold = threshold;
    if (TOPIC_CLUSTER_CONFIG.adaptiveThreshold && vectors.length >= 2) {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < vectors.length; i += 1) {
        for (let j = i + 1; j < vectors.length; j += 1) {
          sum += cosineSimilarity(vectors[i], vectors[j]);
          count += 1;
          if (count >= TOPIC_CLUSTER_CONFIG.adaptiveMaxPairs) break;
        }
        if (count >= TOPIC_CLUSTER_CONFIG.adaptiveMaxPairs) break;
      }
      const avg = count ? sum / count : 0;
      if (avg > 0) {
        const scaled =
          threshold * (avg / TOPIC_CLUSTER_CONFIG.adaptiveTargetSimilarity);
        effectiveThreshold = Math.min(
          TOPIC_CLUSTER_CONFIG.adaptiveMaxThreshold,
          Math.max(TOPIC_CLUSTER_CONFIG.adaptiveMinThreshold, scaled)
        );
      }
    }
    const minAverageSimilarity = Math.max(
      TOPIC_CLUSTER_CONFIG.minAverageSimilarityFloor,
      effectiveThreshold * TOPIC_CLUSTER_CONFIG.minAverageSimilarityScale
    );

    function find(index) {
      let root = index;
      while (parent[root] !== root) root = parent[root];
      while (parent[index] !== index) {
        const next = parent[index];
        parent[index] = root;
        index = next;
      }
      return root;
    }

    function union(a, b) {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA === rootB) return;
      parent[rootB] = rootA;
    }

    function countSharedTokens(a, b) {
      const setA = titleTokenSets[a];
      const setB = titleTokenSets[b];
      if (setA.size === 0 || setB.size === 0) return 0;
      const [small, large] =
        setA.size <= setB.size ? [setA, setB] : [setB, setA];
      let count = 0;
      for (const token of small) {
        if (large.has(token)) {
          count += 1;
          if (count >= minSharedTokens) return count;
        }
      }
      return count;
    }

    function countSharedWeightedTokens(a, b) {
      const vectorA = vectors[a];
      const vectorB = vectors[b];
      let count = 0;
      for (const [token, value] of vectorA.entries()) {
        if (value <= 0) continue;
        const otherValue = vectorB.get(token);
        if (otherValue == null || otherValue <= 0) continue;
        const minValue = Math.min(value, otherValue);
        if (minValue >= 0.05) {
          count += 1;
          if (count >= minSharedTokens) return count;
        }
      }
      return count;
    }

    const neighbors = new Array(metas.length)
      .fill(0)
      .map(() => []);

    for (let i = 0; i < metas.length; i += 1) {
      for (let j = i + 1; j < metas.length; j += 1) {
        const score = cosineSimilarity(vectors[i], vectors[j]);
        if (score < effectiveThreshold) continue;
        const sharedTokens = countSharedTokens(i, j);
        if (sharedTokens >= minSharedTokens) {
          neighbors[i].push({ index: j, score });
          neighbors[j].push({ index: i, score });
          continue;
        }
        const sharedWeighted = countSharedWeightedTokens(i, j);
        if (sharedWeighted < minSharedTokens) continue;
        neighbors[i].push({ index: j, score });
        neighbors[j].push({ index: i, score });
      }
    }

    const topNeighbors = neighbors.map((list) => {
      return list
        .sort((a, b) => b.score - a.score)
        .slice(0, kNearest)
        .map((entry) => entry.index);
    });

    const topSets = topNeighbors.map((list) => new Set(list));
    for (let i = 0; i < metas.length; i += 1) {
      for (const j of topNeighbors[i]) {
        if (topSets[j].has(i)) {
          union(i, j);
        }
      }
    }

    const clustersByRoot = new Map();
    for (let i = 0; i < metas.length; i += 1) {
      const root = find(i);
      let cluster = clustersByRoot.get(root);
      if (!cluster) {
        cluster = { tabs: [], vectors: [] };
        clustersByRoot.set(root, cluster);
      }
      cluster.tabs.push(metas[i]);
      cluster.vectors.push(vectors[i]);
    }

    function averageSimilarity(vectorsInCluster) {
      if (vectorsInCluster.length < 2) return 1;
      let sum = 0;
      let count = 0;
      for (let i = 0; i < vectorsInCluster.length; i += 1) {
        for (let j = i + 1; j < vectorsInCluster.length; j += 1) {
          sum += cosineSimilarity(vectorsInCluster[i], vectorsInCluster[j]);
          count += 1;
        }
      }
      return count ? sum / count : 0;
    }

    const clusters = [];
    for (const cluster of clustersByRoot.values()) {
      if (cluster.tabs.length < 2) {
        clusters.push(cluster);
        continue;
      }
      const avg = averageSimilarity(cluster.vectors);
      if (avg >= minAverageSimilarity) {
        clusters.push(cluster);
        continue;
      }
      for (let i = 0; i < cluster.tabs.length; i += 1) {
        clusters.push({
          tabs: [cluster.tabs[i]],
          vectors: [cluster.vectors[i]]
        });
      }
    }

    return clusters;
  }

  const canUseContent = contentStats.success > 0;
  const idfTitle = buildIdfMap(safeTabsWithMeta, false, contentByTabId);
  const idfContent = canUseContent
    ? buildIdfMap(safeTabsWithMeta, true, contentByTabId)
    : idfTitle;
  let thresholdUsed = getTopicThreshold();
  let clusters = clusterTabs(thresholdUsed, canUseContent, idfContent);
  const hasGroups = clusters.some((cluster) => cluster.tabs.length >= 2);
  if (!hasGroups) {
    thresholdUsed = TOPIC_THRESHOLD_CONFIG.fallback;
    clusters = clusterTabs(thresholdUsed, false, idfTitle);
  }

  if (TOPIC_CLUSTER_CONFIG.debugLogGroups) {
    const debugRows = clusters
      .filter((cluster) => cluster.tabs.length >= 2)
      .map((cluster, index) => ({
        group: index + 1,
        size: cluster.tabs.length,
        keywords: buildDebugKeywords(cluster.vectors)
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
        keywords: buildDebugKeywords(cluster.vectors)
      }));
    if (singletonRows.length > 0) {
      console.log("Topic singletons (pre-create):", singletonRows);
    }
  }

  if (!clusters.some((cluster) => cluster.tabs.length >= 2)) {
    const tokenToTabs = new Map();

    for (const meta of safeTabsWithMeta) {
      const tokens = getTitleTokens(meta);
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

    for (const [token, list] of candidates) {
      const unassigned = list.filter((meta) => !assigned.has(meta.tab.id));
      if (unassigned.length < 2) continue;
      unassigned.forEach((meta) => assigned.add(meta.tab.id));
      const vectors = unassigned.map((meta) =>
        buildVector(getTitleTokens(meta), idfTitle)
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
  setStatus(statusParts.join(" "));
  setProgress(100);

  const windowId = await getTargetWindowId();
  const useNames = nameGroupsToggle.checked;
  const color = groupColorSelect.value;
  const collapseAfter = collapseAfterGroupToggle.checked;

  for (const cluster of clusters) {
    if (cluster.tabs.length < 2) continue;
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
      updatePayload.title = buildTopicLabel(cluster.vectors);
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

  await refresh();
}

async function setAllGroupsCollapsed(collapsed) {
  const windowId = await getTargetWindowId();
  const groups = await chrome.tabGroups.query({ windowId });
  await Promise.all(
    groups.map((group) => chrome.tabGroups.update(group.id, { collapsed }))
  );
  if (groups.length > 0) {
    setStatus(
      `${collapsed ? "Collapsed" : "Expanded"} ${formatCount(
        groups.length,
        "group",
        "groups"
      )}.`
    );
  } else {
    setStatus("No tab groups to update.");
  }
  await refresh();
}

async function ungroupAllTabs() {
  const ungrouped = await ungroupAllTabsInternal(true);
  if (ungrouped > 0) {
    setStatus(`Ungrouped ${formatCount(ungrouped, "tab", "tabs")}.`);
  } else {
    setStatus("No grouped tabs to ungroup.");
  }
}

async function refresh() {
  const tabsWithMeta = await fetchTabsWithMeta();
  renderTabs(tabsWithMeta);
}

closeDuplicatesButton.addEventListener("click", () =>
  runWithUndo(closeDuplicates)
);
sortAlphaButton.addEventListener("click", () => runWithUndo(sortAlphabetically));
sortLastVisitedButton.addEventListener("click", () =>
  runWithUndo(sortByLastVisited)
);
groupDomainButton.addEventListener("click", () => runWithUndo(groupByDomain));
groupTopicButton.addEventListener("click", () => runWithUndo(groupByTopic));
collapseGroupsButton.addEventListener("click", () =>
  runWithUndo(() => setAllGroupsCollapsed(true))
);
expandGroupsButton.addEventListener("click", () =>
  runWithUndo(() => setAllGroupsCollapsed(false))
);
ungroupAllButton.addEventListener("click", () => runWithUndo(ungroupAllTabs));
if (undoActionButton) {
  undoActionButton.addEventListener("click", undoLastAction);
}

if (nameGroupsToggle) {
  nameGroupsToggle.addEventListener("change", () => {
    settings.nameGroups = nameGroupsToggle.checked;
    saveSettings();
  });
}
if (groupColorSelect) {
  groupColorSelect.addEventListener("change", () => {
    settings.groupColor = groupColorSelect.value;
    saveSettings();
  });
}
if (collapseAfterGroupToggle) {
  collapseAfterGroupToggle.addEventListener("change", () => {
    settings.collapseAfterGroup = collapseAfterGroupToggle.checked;
    saveSettings();
  });
}
if (lastVisitedOrderSelect) {
  lastVisitedOrderSelect.addEventListener("change", () => {
    settings.lastVisitedOrder = lastVisitedOrderSelect.value;
    saveSettings();
  });
}
if (topicSensitivitySelect) {
  topicSensitivitySelect.addEventListener("change", () => {
    settings.topicSensitivity = topicSensitivitySelect.value;
    saveSettings();
  });
}
if (activateTabsForContentToggle) {
  activateTabsForContentToggle.addEventListener("change", () => {
    settings.activateTabsForContent = activateTabsForContentToggle.checked;
    saveSettings();
  });
}
if (targetWindowLabel) {
  targetWindowLabel.addEventListener("click", focusTargetWindow);
}

window.addEventListener("error", (event) => {
  reportError("popup", event?.error || event?.message || "Unknown error");
});

window.addEventListener("unhandledrejection", (event) => {
  reportError("popup", event?.reason || "Unhandled rejection");
});

Promise.all([loadSettings(), loadUndoStack()])
  .then(async () => {
    await refresh();
    await updateTargetWindowLabel();
  })
  .catch((error) => reportError("startup", error));
