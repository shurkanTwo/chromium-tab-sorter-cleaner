# Manage Tabs - Auto Group, Sort and Clean

![Demo animation](docs/assets/demo.gif)

[![Manage Tabs demo](https://img.youtube.com/vi/2SNyTUOQEM0/maxresdefault.jpg)](https://www.youtube.com/watch?v=2SNyTUOQEM0)

Chromium extension that helps you sort and group tabs, close duplicates, and
review tab activity from a dedicated action window.

GitHub Pages: https://shurkantwo.github.io/chromium-tab-sorter-cleaner/
Tested working in Brave browser as well: [brave.com](https://brave.com)

## Features

- Dedicated action window (single instance) with status, duration, and progress.
- Opens from the toolbar button or keyboard shortcut `Alt+Shift+T`.
- Targets the window it was opened from (click target label to focus that window).
- Sort tabs A-Z by title or by last-visited order.
- Close duplicate tabs quickly.
- Group tabs by domain.
- Group tabs by topic using title/URL signals and optional page-content scanning.
- Stop a running topic-grouping operation.
- Collapse/expand all tab groups and ungroup everything.
- Undo the last 5 actions.
- Review tab details (URL, hostname, last visited, tracked time spent) on hover.
- Copy a topic-grouping debug report to the clipboard.
- Configurable behavior:
  - Include pinned tabs in actions (off by default).
  - Group naming, color, and collapse-after-grouping behavior.
  - Topic sensitivity and advanced topic-clustering parameters.
  - Optional "activate tabs for content scan" mode.

## Permissions

- `tabs`: read and manage tabs for sorting and deduplication.
- `history`: inspect recent activity to support cleanup decisions.
- `storage`: persist settings.
- `tabGroups`: organize tabs into groups.
- `scripting`: read visible page text for topic grouping.
- Host access (`<all_urls>`): optional, requested at runtime for topic page-text scanning.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked" and select this folder.

For faster reloads during development (especially in Brave):

1. Run `./scripts/prepare-unpacked.sh`.
2. In `brave://extensions`, load unpacked from `dist/` instead of the repo root.

This avoids scanning large dev folders like `node_modules` on every reload.

Optional live sync while editing:

1. Run `./scripts/watch-unpacked.sh`.
2. Keep Brave loaded from `dist/` and use Reload after edits.

The watcher uses `inotifywait` when available, otherwise a 1s polling fallback.

## Package for Chrome Web Store

1. Run `./scripts/package-cws.sh`.
2. Upload the generated ZIP from `build/` to the Chrome Web Store dashboard.
3. Use `CWS_LISTING.md` for listing text.
4. Add listing images from `store-assets/` (see `store-assets/README.md`).

## Usage

Click the toolbar button to open the action window and run actions.
The window targets the browser window it was opened from; click the target
label to focus it. You can also open the window via `Alt+Shift+T`.

## Troubleshooting (Brave content grouping)

- Set Site access to "On all sites" in `brave://extensions` while testing.
- Restricted pages (e.g., `chrome://`, Chrome Web Store) cannot be scanned.
- Discarded or not-fully-loaded tabs are skipped for content scans.
- File URLs require "Allow access to file URLs" in extension details.
- If content scans still time out, enable "Activate tabs for content scan".
- If "Include pinned tabs in actions" is off, pinned tabs are excluded.

## Privacy

See [PRIVACY.md](PRIVACY.md) or the published page:
https://shurkantwo.github.io/chromium-tab-sorter-cleaner/

## Disclaimer

This extension is provided "as is" without warranty of any kind. You use it at
your own risk. The authors are not liable for any damages or losses arising
from its use.

## Author

Lucas Lepski

## License

Source-available, not open source. Personal non-commercial use of the
unmodified software is allowed; copying, modification, redistribution, and
commercial use require prior written permission. See [LICENSE](LICENSE).
