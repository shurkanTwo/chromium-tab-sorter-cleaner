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

const STOPWORDS_ENGLISH = [
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "have", "how", "in", "is", "it", "its", "of", "on", "or",
  "that", "the", "this", "to", "was", "were", "what", "when", "where",
  "who", "why", "with", "you", "your", "our", "we", "us", "they",
  "their", "them", "there", "here", "about", "into", "over", "under"
];
const STOPWORDS_GERMAN = [
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "eines",
  "einem", "einen", "und", "oder", "aber", "doch", "dass", "daß", "nicht",
  "kein", "keine", "keiner", "keines", "keinem", "keinen", "im", "am", "an",
  "auf", "aus", "bei", "mit", "nach", "von", "vor", "zu", "zum", "zur",
  "über", "unter", "für", "ist", "sind", "war", "waren", "wie", "was",
  "wer", "wo", "wann", "warum", "wieso", "welche", "welcher", "welches",
  "mehr", "anzeige", "anzeigen", "sie", "ihr", "ihre", "ihren", "ihrem",
  "ihres", "wir", "uns", "euch", "euer", "eure"
];
const STOPWORDS_DUTCH = [
  "de", "het", "een", "en", "of", "maar", "dat", "die", "dit", "in", "is",
  "op", "te", "van", "voor", "met", "zonder", "naar", "bij", "aan", "uit",
  "ook", "niet", "wel", "we", "wij", "jij", "je", "u", "hun", "ze", "zij",
  "ons", "onze", "jullie", "waar", "wanneer", "waarom"
];
const STOPWORDS_SPANISH = [
  "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "pero",
  "de", "del", "al", "en", "para", "por", "con", "sin", "sobre", "entre",
  "como", "que", "qué", "quien", "quién", "cuando", "cuándo", "donde",
  "dónde", "porque", "porqué", "si", "sí", "no", "ya", "más", "muy"
];
const STOPWORDS_FRENCH = [
  "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "mais",
  "dans", "sur", "sous", "avec", "sans", "pour", "par", "chez", "entre",
  "au", "aux", "ce", "cet", "cette", "ces", "son", "sa", "ses", "leur",
  "leurs", "mon", "ma", "mes", "ton", "ta", "tes", "notre", "nos",
  "votre", "vos", "qui", "que", "quoi", "dont", "ou", "quand",
  "pourquoi", "comment", "est", "sont", "etre", "il", "elle",
  "ils", "elles", "on", "nous", "vous", "je", "tu"
];
const STOPWORDS_ITALIAN = [
  "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "e", "o", "ma",
  "di", "del", "della", "dei", "degli", "delle", "da", "dal", "dalla",
  "dai", "dagli", "dalle", "in", "nel", "nello", "nella", "nei", "negli",
  "nelle", "su", "sul", "sullo", "sulla", "sui", "sugli", "sulle",
  "per", "tra", "fra", "con", "senza", "che", "chi", "cui", "come",
  "quando", "perche", "perchè", "dove", "qui", "ed",
  "essere", "sono", "era", "erano", "io", "tu", "lui", "lei", "noi",
  "voi", "loro", "mi", "ti", "si", "ci", "vi"
];
const STOPWORDS_PORTUGUESE = [
  "o", "a", "os", "as", "um", "uma", "uns", "umas", "e", "ou", "mas",
  "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
  "por", "para", "com", "sem", "sobre", "entre", "ao", "aos", "à",
  "às", "que", "quem", "qual", "quais", "quando", "onde", "como",
  "porque", "porquê", "se", "não", "sim", "já", "mais", "muito",
  "ser", "são", "era", "eram", "eu", "tu", "ele", "ela", "nós",
  "vos", "vós", "eles", "elas", "me", "te", "se", "nos", "vos"
];
const STOPWORDS_WEB = [
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
const STOPWORDS_CSS_JS = [
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

const STOPWORDS = new Set([
  ...STOPWORDS_ENGLISH,
  ...STOPWORDS_GERMAN,
  ...STOPWORDS_DUTCH,
  ...STOPWORDS_SPANISH,
  ...STOPWORDS_FRENCH,
  ...STOPWORDS_ITALIAN,
  ...STOPWORDS_PORTUGUESE,
  ...STOPWORDS_WEB,
  ...STOPWORDS_CSS_JS
]);

export function stemToken(token) {
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

export function tokenize(text) {
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
  const stemmed = raw.map((token) => stemToken(token));
  return stemmed.filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export function addBigrams(tokens, useBigrams) {
  if (!useBigrams || tokens.length < 2) return tokens;
  const result = [...tokens];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const left = tokens[i];
    const right = tokens[i + 1];
    if (!left || !right) continue;
    result.push(`${left}_${right}`);
  }
  return result;
}

export function getTitleText(meta) {
  const title = meta.tab.title || "";
  return stripSiteNameFromTitle(title, meta.tab?.url || "");
}

export function getUrlTokens(url) {
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

const TITLE_SEPARATORS = [
  " - ",
  " | ",
  " — ",
  " – ",
  " · ",
  " • ",
  " :: ",
  " » ",
  " « "
];

const COMMON_TLDS = new Set([
  "com", "net", "org", "co", "io", "gov", "edu", "dev", "app", "ai",
  "uk", "de", "fr", "es", "it", "nl", "ru", "jp", "br", "ca", "au",
  "us", "ch", "se", "no", "fi", "pl", "pt", "in", "kr", "cn"
]);

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getHostTokens(url) {
  if (!url) return [];
  try {
    const parsed = new URL(url);
    const host = (parsed.hostname || "")
      .toLowerCase()
      .replace(/^www\d?\./, "");
    if (!host) return [];
    const labels = host
      .split(".")
      .filter(Boolean)
      .filter((label) => !COMMON_TLDS.has(label));
    if (labels.length === 0) return [];
    const combined = labels
      .map((label) => label.replace(/[^a-z0-9]+/g, " "))
      .join(" ");
    return tokenize(combined);
  } catch (error) {
    return [];
  }
}

function shouldStripPart(part, hostTokens) {
  if (!part) return false;
  const tokens = tokenize(part);
  if (tokens.length === 0 || hostTokens.length === 0) return false;
  const hostSet = new Set(hostTokens);
  let overlap = 0;
  for (const token of tokens) {
    if (hostSet.has(token)) {
      overlap += 1;
      if (overlap >= 1) return true;
    }
  }
  const lower = part.toLowerCase();
  return hostTokens.some((token) => token && lower.includes(token));
}

function stripSiteNameFromTitle(title, url) {
  const trimmed = title.trim();
  if (!trimmed) return "";
  const hostTokens = getHostTokens(url);
  if (hostTokens.length === 0) return trimmed;
  const pattern = new RegExp(TITLE_SEPARATORS.map(escapeRegex).join("|"));
  const parts = trimmed.split(pattern).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return trimmed;

  const first = parts[0];
  const last = parts[parts.length - 1];

  if (shouldStripPart(last, hostTokens)) {
    const remaining = parts.slice(0, -1).join(" ").trim();
    return remaining || trimmed;
  }

  if (shouldStripPart(first, hostTokens)) {
    const remaining = parts.slice(1).join(" ").trim();
    return remaining || trimmed;
  }

  return trimmed;
}

export function getTitleTokens(meta, useBigrams) {
  const titleTokens = tokenize(getTitleText(meta));
  const urlTokens = getUrlTokens(meta.tab?.url || "");
  const withBigrams = addBigrams(titleTokens, useBigrams);
  return withBigrams.concat(urlTokens);
}

export function getTitleOnlyTokens(meta) {
  return tokenize(getTitleText(meta));
}

export function buildVector(tokens, idfMap) {
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

export function buildTitleVector(meta, idfMap, useBigrams) {
  const vector = buildVector(getTitleTokens(meta, useBigrams), idfMap);
  for (const [key, value] of vector.entries()) {
    vector.set(key, value * 2);
  }
  return vector;
}

export function limitVector(vector, maxKeys) {
  if (vector.size <= maxKeys) return vector;
  const sorted = Array.from(vector.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return new Map(sorted.slice(0, maxKeys));
}

export function cosineSimilarity(a, b) {
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

export function mergeVectors(target, source) {
  for (const [key, value] of source.entries()) {
    target.set(key, (target.get(key) || 0) + value);
  }
}

export function normalizeVector(vector) {
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

export function buildIdfMap(
  tabsWithMeta,
  includeContent,
  contentByTabId,
  useBigrams
) {
  const docCounts = new Map();
  const totalDocs = tabsWithMeta.length || 1;

  for (const meta of tabsWithMeta) {
    const tokens = new Set(getTitleTokens(meta, useBigrams));
    if (includeContent) {
      const content = contentByTabId.get(meta.tab.id) || "";
      if (content) {
        addBigrams(tokenize(content), useBigrams).forEach((token) =>
          tokens.add(token)
        );
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

export function pickTopKeywordEntries(vectors, limit) {
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

export function buildTopicLabel(vectors, config) {
  const entries = pickTopKeywordEntries(vectors, config.titleKeywordLimit);
  if (entries.length === 0) return "Topic";
  const labels = entries
    .map(([word, score]) => {
      const token = titleCase(word);
      if (!token) return "";
      if (!config.titleIncludeScores) return token;
      return `${token}(${score.toFixed(2)})`;
    })
    .filter(Boolean);
  const joined = labels.join(" ");
  return abbreviateKeyword(joined);
}

export function buildDebugKeywords(vectors, config) {
  const entries = pickTopKeywordEntries(vectors, config.debugKeywordLimit);
  return entries.map(([word, score]) => `${word}:${score.toFixed(2)}`);
}

export function clusterTabs({
  metas,
  vectors,
  titleOnlyTokenSets,
  threshold,
  config
}) {
  const parent = new Array(metas.length).fill(0).map((_, index) => index);
  const kNearest = config.kNearest;
  const minSharedTokens = config.minSharedTokens;
  let effectiveThreshold = threshold;

  if (config.adaptiveThreshold && vectors.length >= 2) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < vectors.length; i += 1) {
      for (let j = i + 1; j < vectors.length; j += 1) {
        sum += cosineSimilarity(vectors[i], vectors[j]);
        count += 1;
        if (count >= config.adaptiveMaxPairs) break;
      }
      if (count >= config.adaptiveMaxPairs) break;
    }
    const avg = count ? sum / count : 0;
    if (avg > 0) {
      const scaled = threshold * (avg / config.adaptiveTargetSimilarity);
      effectiveThreshold = Math.min(
        config.adaptiveMaxThreshold,
        Math.max(config.adaptiveMinThreshold, scaled)
      );
    }
  }

  const minAverageSimilarity = Math.max(
    config.minAverageSimilarityFloor,
    effectiveThreshold * config.minAverageSimilarityScale
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
    const setA = titleOnlyTokenSets[a];
    const setB = titleOnlyTokenSets[b];
    if (setA.size === 0 || setB.size === 0) return 0;
    const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
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

function titleCase(word) {
  if (!word) return "";
  return `${word[0].toUpperCase()}${word.slice(1)}`;
}

function abbreviateKeyword(keyword) {
  if (!keyword) return "";
  if (keyword.length <= 12) return keyword;
  return `${keyword.slice(0, 11)}…`;
}
