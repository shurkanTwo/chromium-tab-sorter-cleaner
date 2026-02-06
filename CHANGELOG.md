# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Documentation refresh for README, privacy policy, and GitHub Pages copy.
- Added `scripts/package-cws.sh` to produce a Chrome Web Store upload ZIP.
- Added `store-assets/README.md` with required CWS listing asset specs and publish checklist.
- Fixed tab time tracking overcount when data is read repeatedly.
- Replaced details panel `innerHTML` rendering with safe DOM construction.
- Loaded tracker state before processing tracker events/messages to avoid startup race conditions.
- Deduplicated popup/settings binding definitions via shared `setting_definitions.js`.
- Refined mobile action-window CSS overrides for narrow widths.
- Extracted shared helper for tab-group update payload handling.
- Tuned default topic-clustering thresholds and weights to reduce missed group merges.
- Added a configuration button to reset all settings to defaults.
- Improved clustering to keep strong one-way neighbor matches and prune outliers instead of splitting whole clusters.
- Improved topic group naming to generate more descriptive multi-keyword labels.
- Added a strict second-pass split for oversized topic clusters to reduce single broad groups.
- Optimized content scanning to activate tabs only when needed instead of warming every eligible tab.
- Changed domain grouping names to use full hostnames.
- Domain group names now strip a leading `www`/`wwwN` prefix.
- Simplified configuration by removing technical tuning controls from the user-facing UI.
- Persisted only user-facing settings and dropped hidden advanced-settings compatibility handling.
- Improved top-toolbar hierarchy by separating primary actions from secondary group controls.
- Added short helper text for key topic-grouping settings in configuration.
- Removed the tab list/details section from the action window to reduce UI clutter.
- Polished action-window styling (no all-caps labels, cleaner buttons, and compact fixed-size layout).
- Replaced inline configuration with a top-right circular toggle that opens/closes a full overlay settings page.
- Action window now enforces the standard size even when re-opening an existing action window.
- Split action buttons into three sections: Sorting, Grouping, and Group controls.
- Fixed config-toggle clickability while overlay is open by keeping the toggle button above the overlay layer.
- Moved the config toggle to the root overlay layer so the close (X) button remains reliably clickable.
- Redesigned the configuration overlay with clearer sections, improved spacing, and more readable controls.
- Flattened configuration into one clear list with more explicit option labels and a smaller inline reset button.
- Moved reset-to-defaults into a top pill button beside the config close control for quicker access.
- Simplified action area visuals by removing section card containers and using regular-weight button text.
- Reworked main actions into a compact toolbar with segmented controls for Sorting, Grouping, and Group controls.
- Compacted the configuration panel with tighter spacing and a denser multi-column settings layout.
- Refined config overlay density with a cleaner two-column layout and full-width rows for verbose topic settings.
- Simplified the configuration area into a compact single-column option list with list-style rows.
- Removed config list bullets and reduced row/control heights for a tighter compact settings list.
- Polished toolbar/status/footer spacing, contrast, and segmented row styling.
- Moved the configuration title to the top overlay header above the target-window row.
- Fixed config overlay visibility regression (hidden state respected again) and expanded config panel to full overlay width.
- Increased action-window popup height to 800px when opening/focusing the action window.
- Anchored the status/progress section and footer to the bottom of the action window layout.

## [0.1.0] - 2026-02-05
- Initial Chromium extension release.
- Dedicated action window targeting a specific browser window.
- Tab actions: sort A-Z, sort by last visited, close duplicates.
- Grouping actions: by domain and by topic.
- Group controls: collapse all, expand all, ungroup all.
- Undo stack for recent actions.
- Optional inclusion of pinned tabs in actions.
- Per-tab time tracking and tab details panel.
- Topic grouping status/progress, stop control, and debug report copy.
- Optional runtime host permission request for page-content scanning.
