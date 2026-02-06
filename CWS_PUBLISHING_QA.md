# Chrome Web Store – Publishing Questions (Documentation)

As of: 2026-02-06

## Privacy (Form)

### Single Purpose (Description)
Manage Tabs - Auto Group, Sort and Clean is solely for local organization and cleanup of tabs in the current browser window: sort tabs, close duplicates, group tabs (domain/topic), and display activity in a clear way.

### Permission Justifications

- `tabs`: Required to read tab titles/URLs, sort/move tabs, close duplicates, and manage the target window’s tabs.
- `history`: Required to show “last visited” for open tabs and enable sorting by recent activity.
- `storage`: Required to store settings, undo snapshots, and local tab time data.
- `tabGroups`: Required to create, name, color, collapse/expand, and remove tab groups.
- `scripting`: Required to read visible page text when the optional content‑scan topic grouping is used.
- Optional host permission (`<all_urls>`): Requested at runtime only when content-based topic grouping is used.

### Do you use Remote Code?
No. The extension does not load external JS/Wasm and does not use `eval()`.

### Data Usage – What user data is collected?

- Personally identifiable information: No
- Health information: No
- Financial and payment information: No
- Authentication information: No
- Personal communications: No
- Location: No
- Web history: Yes (local use of visit time for open tabs)
- User activity: Yes (local time/activity display per tab)
- Website content: Yes (optional, only when content‑scan topic grouping is enabled; local only)

### Certifications
- I do not sell or transfer user data to third parties: Yes
- User data is not used or transferred for unrelated purposes: Yes
- No use/transfer for creditworthiness or lending: Yes

### Privacy Policy URL
https://shurkantwo.github.io/chromium-tab-sorter-cleaner/
