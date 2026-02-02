# Chrome Web Store Listing Draft

## Short Description (up to 132 chars)
Sort tabs, close duplicates, group by domain, and review recent activity from a clean window.

## Detailed Description
Tab Sorter Cleaner helps you tame tab overload in seconds.

Use the window to:
- Sort tabs A–Z or by last visited (for the target window)
- Close duplicate tabs
- Group tabs by domain, with optional names and colors
- Group tabs by topic using page text (optional)
- Collapse or expand all groups
- Ungroup all tabs at once
- Review recent activity and time spent per tab

## Permission Justifications
- `tabs`: Read tab titles/URLs and move tabs to sort and deduplicate.
- `history`: Read visit times to show last visited for open tabs.
- `storage`: Persist per-tab time tracking data locally.
- `tabGroups`: Create, name, color, collapse, and expand groups in the current window.
- `scripting`: Read visible page text for topic grouping.
- Host access: Requested at runtime for page text scanning.

## Privacy
No data is sold or shared. All data stays local in the browser.
Privacy policy: `PRIVACY.md`
