import { SETTINGS_KEY, settings } from "./config.js";
import { elements } from "./ui.js";

export async function loadSettings() {
  const data = await chrome.storage.local.get([SETTINGS_KEY]);
  if (data[SETTINGS_KEY]) {
    Object.assign(settings, data[SETTINGS_KEY]);
  }
  if (elements.nameGroupsToggle) elements.nameGroupsToggle.checked = settings.nameGroups;
  if (elements.groupColorSelect) elements.groupColorSelect.value = settings.groupColor || "";
  if (elements.collapseAfterGroupToggle) {
    elements.collapseAfterGroupToggle.checked = settings.collapseAfterGroup;
  }
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
}

export function saveSettings() {
  return chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}
