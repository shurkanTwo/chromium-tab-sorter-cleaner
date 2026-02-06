# Privacy Policy

Last updated: 2026-02-05

Manage Tabs - Auto Group, Sort and Clean is a Chromium extension that helps you sort tabs, close
duplicates, group tabs by domain or topic, and review recent activity.

## Data We Access

- **Tabs**: Read tab titles and URLs to sort and deduplicate tabs.
- **Page Content**: Read visible page text to improve topic grouping.
- **History**: Read visit times for open tabs to show "last visited."
- **Storage**: Store settings, undo snapshots, and tab time tracking data locally on your device.
- **Tab Groups**: Create and manage groups in the current window.
- **Optional Host Permissions (`<all_urls>`)**: Requested at runtime only for page-content scans.

## How We Use Data

- All data is used only to provide the extension features inside your browser.
- Page text is accessed locally at the time you run topic grouping. If enabled,
  the extension may briefly activate tabs to capture visible text.
- Runtime state and settings are stored in extension storage (`storage.local`,
  and `storage.session` when available for undo state).
- Clipboard write is used only when you click "Copy debug report."

## Data Sharing

- We do **not** sell or share data with third parties.
- No data is sent to external servers.

## Data Retention

- Tab time data remains in local storage until you remove the extension or
  clear extension data.
- Undo data remains in session storage when supported (or local extension
  storage fallback).

## Contact

If you have questions, contact: Lucas Lepski (`dickymicky@gmx.de`)
