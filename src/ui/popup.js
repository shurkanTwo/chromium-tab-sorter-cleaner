import { CONFIG, settings } from "../lib/config.js";
import { elements, reportError, setStatus, setTopicGroupingRunning } from "../lib/ui.js";
import { loadSettings, resetSettingsToDefaults, saveSettings } from "../lib/settings.js";
import { SETTING_BINDINGS } from "../lib/setting_definitions.js";
import {
  closeDuplicates,
  focusTargetWindow,
  groupByDomain,
  loadUndoStack,
  refresh,
  runWithUndo,
  setAllGroupsCollapsed,
  sortAlphabetically,
  sortByLastVisited,
  undoLastAction,
  ungroupAllTabs,
  updateTargetWindowLabel
} from "../lib/tabs.js";
import {
  copyDebugReport,
  groupByTopic,
  hasActiveTopicGrouping,
  requestStopTopicGrouping
} from "../lib/topic.js";

async function runTopicGroupingWithStop() {
  setTopicGroupingRunning(true);
  try {
    await runWithUndo(groupByTopic);
  } finally {
    setTopicGroupingRunning(hasActiveTopicGrouping());
  }
}

if (elements.closeDuplicatesButton) {
  elements.closeDuplicatesButton.addEventListener("click", () =>
    runWithUndo(closeDuplicates)
  );
}
if (elements.sortAlphaButton) {
  elements.sortAlphaButton.addEventListener("click", () =>
    runWithUndo(sortAlphabetically)
  );
}
if (elements.sortLastVisitedButton) {
  elements.sortLastVisitedButton.addEventListener("click", () =>
    runWithUndo(sortByLastVisited)
  );
}
if (elements.groupDomainButton) {
  elements.groupDomainButton.addEventListener("click", () =>
    runWithUndo(groupByDomain)
  );
}
if (elements.groupTopicButton) {
  elements.groupTopicButton.addEventListener("click", () =>
    runTopicGroupingWithStop()
  );
}
if (elements.stopActionButton) {
  elements.stopActionButton.addEventListener("click", () => {
    if (!requestStopTopicGrouping()) return;
    setStatus("Stopping topic grouping...");
  });
}
if (elements.collapseGroupsButton) {
  elements.collapseGroupsButton.addEventListener("click", () =>
    runWithUndo(() => setAllGroupsCollapsed(true))
  );
}
if (elements.expandGroupsButton) {
  elements.expandGroupsButton.addEventListener("click", () =>
    runWithUndo(() => setAllGroupsCollapsed(false))
  );
}
if (elements.ungroupAllButton) {
  elements.ungroupAllButton.addEventListener("click", () =>
    runWithUndo(ungroupAllTabs)
  );
}
if (elements.undoActionButton) {
  elements.undoActionButton.addEventListener("click", undoLastAction);
}
if (elements.copyDebugReportLink) {
  elements.copyDebugReportLink.addEventListener("click", (event) => {
    event.preventDefault();
    copyDebugReport();
  });
}
if (elements.resetSettingsButton) {
  elements.resetSettingsButton.addEventListener("click", async () => {
    const confirmed = window.confirm("Reset all configuration values to defaults?");
    if (!confirmed) return;
    await resetSettingsToDefaults();
    await refresh();
    setStatus("Settings reset to defaults.");
  });
}

if (elements.targetWindowLabel) {
  elements.targetWindowLabel.addEventListener("click", focusTargetWindow);
}

function bindBooleanSetting(element, target, key, onChange) {
  if (!element) return;
  element.addEventListener("change", async () => {
    target[key] = element.checked;
    await saveSettings();
    if (typeof onChange === "function") {
      await onChange();
    }
  });
}

function bindSelectSetting(element, target, key, onChange) {
  if (!element) return;
  element.addEventListener("change", async () => {
    target[key] = element.value;
    await saveSettings();
    if (typeof onChange === "function") {
      await onChange();
    }
  });
}

function bindNumberSetting(element, target, key, integer = false) {
  if (!element) return;
  element.addEventListener("change", async () => {
    const parsed = integer
      ? Number.parseInt(element.value, 10)
      : Number.parseFloat(element.value);
    if (!Number.isFinite(parsed)) {
      element.value = String(target[key]);
      return;
    }
    target[key] = parsed;
    await saveSettings();
  });
}

function getBindingTarget(section) {
  if (section === "settings") return settings;
  if (section === "topicCluster") return CONFIG.topicCluster;
  if (section === "topicThresholds") return CONFIG.topicThresholds;
  return null;
}

const onChangeHandlers = {
  refresh
};

for (const binding of SETTING_BINDINGS) {
  const element = elements[binding.elementKey];
  const target = getBindingTarget(binding.section);
  if (!element || !target) continue;
  const onChange = binding.onChange ? onChangeHandlers[binding.onChange] : undefined;
  if (binding.type === "boolean") {
    bindBooleanSetting(element, target, binding.key, onChange);
    continue;
  }
  if (binding.type === "select") {
    bindSelectSetting(element, target, binding.key, onChange);
    continue;
  }
  bindNumberSetting(element, target, binding.key, binding.integer === true);
}

window.addEventListener("error", (event) => {
  reportError("popup", event?.error || event?.message || "Unknown error");
});

window.addEventListener("unhandledrejection", (event) => {
  reportError("popup", event?.reason || "Unhandled rejection");
});

Promise.all([loadSettings(), loadUndoStack()])
  .then(async () => {
    setTopicGroupingRunning(hasActiveTopicGrouping());
    await refresh();
    await updateTargetWindowLabel();
  })
  .catch((error) => reportError("startup", error));
