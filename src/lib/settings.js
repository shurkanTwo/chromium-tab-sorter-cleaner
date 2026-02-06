import { CONFIG, DEFAULT_CONFIG, SETTINGS_KEY, settings } from "./config.js";
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
  return null;
}

function replaceValues(target, source) {
  Object.keys(target).forEach((key) => {
    delete target[key];
  });
  Object.assign(target, source);
}

function syncSettingsToInputs() {
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

export async function loadSettings() {
  const data = await chrome.storage.local.get([SETTINGS_KEY]);
  const stored = data[SETTINGS_KEY];
  if (stored) {
    if (stored.settings) {
      Object.assign(settings, stored.settings);
    } else {
      Object.assign(settings, stored);
    }
  }
  syncSettingsToInputs();
}

export function saveSettings() {
  return chrome.storage.local.set({
    [SETTINGS_KEY]: {
      settings
    }
  });
}

export async function resetSettingsToDefaults() {
  replaceValues(settings, DEFAULT_CONFIG.settings);
  replaceValues(CONFIG.topicCluster, DEFAULT_CONFIG.topicCluster);
  replaceValues(CONFIG.topicThresholds, DEFAULT_CONFIG.topicThresholds);
  await saveSettings();
  syncSettingsToInputs();
}
