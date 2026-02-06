export const SETTING_BINDINGS = [
  { elementKey: "nameGroupsToggle", section: "settings", key: "nameGroups", type: "boolean" },
  { elementKey: "groupColorSelect", section: "settings", key: "groupColor", type: "select" },
  {
    elementKey: "collapseAfterGroupToggle",
    section: "settings",
    key: "collapseAfterGroup",
    type: "boolean"
  },
  {
    elementKey: "includePinnedTabsToggle",
    section: "settings",
    key: "includePinnedTabs",
    type: "boolean",
    onChange: "refresh"
  },
  {
    elementKey: "lastVisitedOrderSelect",
    section: "settings",
    key: "lastVisitedOrder",
    type: "select"
  },
  {
    elementKey: "topicSensitivitySelect",
    section: "settings",
    key: "topicSensitivity",
    type: "select"
  },
  {
    elementKey: "activateTabsForContentToggle",
    section: "settings",
    key: "activateTabsForContent",
    type: "boolean"
  }
];
