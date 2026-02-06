# Chrome Web Store Listing Draft

## Short Description (up to 132 chars)

Sort tabs, close duplicates, automatically group by domain or content/topic, and review recent activity from a dedicated action window.

## Detailed Description

Manage Tabs - Auto Group, Sort and Clean keeps tab chaos under control with a dedicated action window for fast cleanup and organization. Sort the current window A-Z or by last visited, close duplicates in one click, and group tabs by domain with optional names, colors, and collapse behavior. The standout feature is automatic topic grouping: it can cluster tabs by title/URL signals or, when you allow it, scan visible page content for more accurate topics. You can stop a running topic pass at any time.

Built-in controls let you collapse or expand all groups, ungroup everything, and undo your last actions. Hover any tab for details like URL, hostname, last visited time, and tracked time spent. Pinned tabs can be included or excluded based on your preference. A debug report can be copied after topic grouping when you want to troubleshoot results.

All data stays local in your browser. The extension uses the `tabs`, `history`, `tabGroups`, `storage`, and `scripting` permissions to provide its features, and optional host permissions are requested at runtime only for content-based topic scans.

If you want fewer tabs and more focus, Manage Tabs - Auto Group, Sort and Clean gives you fast, transparent, and controllable cleanup without sending your data anywhere.

## Permission Justifications

- `tabs`: Read tab titles/URLs and move tabs to sort and deduplicate.
- `history`: Read visit times to show last visited for open tabs.
- `storage`: Persist settings, undo snapshots, and per-tab time tracking data locally.
- `tabGroups`: Create, name, color, collapse, and expand groups in the current window.
- `scripting`: Read visible page text for topic grouping.
- Host access: Requested at runtime for page text scanning.

## Privacy

No data is sold or shared. All data stays local in the browser.
Privacy policy (repo): https://github.com/shurkantwo/chromium-tab-sorter-cleaner/blob/main/PRIVACY.md
Public privacy page: https://shurkantwo.github.io/chromium-tab-sorter-cleaner/
