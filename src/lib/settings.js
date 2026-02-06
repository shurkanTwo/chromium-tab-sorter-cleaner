import { CONFIG, SETTINGS_KEY, settings } from "./config.js";
import { elements } from "./ui.js";
import { SETTING_BINDINGS } from "./setting_definitions.js";

function setCheckbox(element, value) {
  if (!element) return;
  element.checked = Boolean(value);
}

function setInputValue(element, value) {
  if (!element) return;
  element.value = String(value);
}

function getBindingTarget(section) {
  if (section === "settings") return settings;
  if (section === "topicCluster") return CONFIG.topicCluster;
  if (section === "topicThresholds") return CONFIG.topicThresholds;
  return null;
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
  for (const binding of SETTING_BINDINGS) {
    const target = getBindingTarget(binding.section);
    if (!target) continue;
    const element = elements[binding.elementKey];
    if (!element) continue;
    if (binding.type === "boolean") {
      setCheckbox(element, target[binding.key]);
      continue;
    }
    setInputValue(element, target[binding.key]);
  }
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
