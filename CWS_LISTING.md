# Chrome Web Store Listing Draft

## Short Description (up to 132 chars)
Sort tabs, close duplicates, group by domain or topic, and review recent activity from a dedicated action window.

## Detailed Description
Manage Tabs - Auto Group, Sort and Clean helps you tame tab overload in seconds.

Use the window to:
- Sort tabs A–Z or by last visited (for the target window)
- Close duplicate tabs
- Group tabs by domain, with optional names and colors
- Group tabs by topic using page text (optional)
- Stop topic grouping while it is running
- Collapse or expand all groups
- Ungroup all tabs at once
- Undo recent actions
- Review recent activity and time spent per tab
- Include pinned tabs in actions (optional)
- Copy a debug report after topic grouping

## Permission Justifications
- `tabs`: Read tab titles/URLs and move tabs to sort and deduplicate.
- `history`: Read visit times to show last visited for open tabs.
- `storage`: Persist settings, undo snapshots, and per-tab time tracking data locally.
- `tabGroups`: Create, name, color, collapse, and expand groups in the current window.
- `scripting`: Read visible page text for topic grouping.
- Host access: Requested at runtime for page text scanning.

## Privacy
No data is sold or shared. All data stays local in the browser.
Privacy policy: `PRIVACY.md`
Public privacy page: https://shurkantwo.github.io/chromium-tab-sorter-cleaner/
