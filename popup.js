import { settings } from "./config.js";
import { elements, reportError } from "./ui.js";
import { loadSettings, saveSettings } from "./settings.js";
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
} from "./tabs.js";
import { copyDebugReport, groupByTopic } from "./topic.js";

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
    runWithUndo(groupByTopic)
  );
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
if (elements.copyDebugReportButton) {
  elements.copyDebugReportButton.addEventListener("click", copyDebugReport);
}

if (elements.nameGroupsToggle) {
  elements.nameGroupsToggle.addEventListener("change", () => {
    settings.nameGroups = elements.nameGroupsToggle.checked;
    saveSettings();
  });
}
if (elements.groupColorSelect) {
  elements.groupColorSelect.addEventListener("change", () => {
    settings.groupColor = elements.groupColorSelect.value;
    saveSettings();
  });
}
if (elements.collapseAfterGroupToggle) {
  elements.collapseAfterGroupToggle.addEventListener("change", () => {
    settings.collapseAfterGroup = elements.collapseAfterGroupToggle.checked;
    saveSettings();
  });
}
if (elements.lastVisitedOrderSelect) {
  elements.lastVisitedOrderSelect.addEventListener("change", () => {
    settings.lastVisitedOrder = elements.lastVisitedOrderSelect.value;
    saveSettings();
  });
}
if (elements.topicSensitivitySelect) {
  elements.topicSensitivitySelect.addEventListener("change", () => {
    settings.topicSensitivity = elements.topicSensitivitySelect.value;
    saveSettings();
  });
}
if (elements.activateTabsForContentToggle) {
  elements.activateTabsForContentToggle.addEventListener("change", () => {
    settings.activateTabsForContent =
      elements.activateTabsForContentToggle.checked;
    saveSettings();
  });
}
if (elements.targetWindowLabel) {
  elements.targetWindowLabel.addEventListener("click", focusTargetWindow);
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
