import { settings } from "./config.js";
import { elements, setProgress } from "./ui.js";
import { createAbortError, getToggleValue, sleep } from "./utils.js";
import { getActiveTabId, isValidTabMeta } from "./tabs.js";

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

export async function ensureContentAccess() {
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

export async function fetchTabContents(tabsWithMeta, maxLength = 6000, shouldStop) {
  const results = new Map();
  const stats = {
    eligible: 0,
    success: 0,
    restricted: 0
  };
  const warmTabsByActivation = getToggleValue(
    elements.activateTabsForContentToggle,
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

  function throwIfStopped() {
    if (typeof shouldStop === "function" && shouldStop()) {
      throw createAbortError();
    }
  }

  let index = 0;
  let warmed = 0;
  let completed = 0;
  const concurrency = Math.min(4, eligibleTabs.length);
  const timeoutMs = 4000;
  const warmupProgressShare = warmTabsByActivation ? 0.35 : 0;
  const originalActiveTabId = warmTabsByActivation ? await getActiveTabId() : null;

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
    let timeoutTimer = null;
    let stopTimer = null;
    try {
      return await Promise.race([
        Promise.resolve(promise),
        new Promise((resolve) => {
          timeoutTimer = setTimeout(() => resolve(null), ms);
        }),
        new Promise((resolve) => {
          if (typeof shouldStop !== "function") return;
          if (shouldStop()) {
            resolve(null);
            return;
          }
          stopTimer = setInterval(() => {
            if (shouldStop()) {
              resolve(null);
            }
          }, 50);
        })
      ]);
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (stopTimer) clearInterval(stopTimer);
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
          "header,footer,nav,aside,[role='navigation'],[role='contentinfo'],[aria-label*='breadcrumb' i]"
        ).forEach((node) => node.remove());
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

  async function waitForTabReady(tabId, maxWaitMs = 1200) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      throwIfStopped();
      const tab = await getFreshTab(tabId);
      if (!tab) return;
      if (tab.discarded) return;
      if (!tab.status || tab.status === "complete") return;
      await sleep(100);
    }
  }

  async function warmTab(tab) {
    throwIfStopped();
    await activateTab(tab.id);
    await waitForTabReady(tab.id);
    warmed += 1;
    const progress = eligibleTabs.length
      ? (warmed / eligibleTabs.length) * (warmupProgressShare * 100)
      : 0;
    setProgress(progress);
  }

  async function getFreshTab(tabId) {
    try {
      return await chrome.tabs.get(tabId);
    } catch (error) {
      return null;
    }
  }

  async function scanTab(tab) {
    throwIfStopped();
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
    throwIfStopped();
    if (!injected) return;
    const text = injected?.[0]?.result || "";
    if (text.trim().length > 0) {
      stats.success += 1;
    }
    results.set(currentTab.id, text);
  }

  async function worker() {
    while (index < eligibleTabs.length) {
      throwIfStopped();
      const tab = eligibleTabs[index];
      index += 1;
      await scanTab(tab);
      completed += 1;
      const progress = eligibleTabs.length
        ? warmupProgressShare * 100 +
          (completed / eligibleTabs.length) * ((1 - warmupProgressShare) * 100)
        : 0;
      setProgress(progress);
    }
  }

  try {
    if (warmTabsByActivation) {
      for (const tab of eligibleTabs) {
        await warmTab(tab);
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    setProgress(100);
    return { contentsByTabId: results, stats };
  } finally {
    if (warmTabsByActivation && originalActiveTabId != null) {
      try {
        await chrome.tabs.update(originalActiveTabId, { active: true });
      } catch (error) {
        // Ignore focus restore errors.
      }
    }
  }
}
