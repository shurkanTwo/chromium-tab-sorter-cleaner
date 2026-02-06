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
