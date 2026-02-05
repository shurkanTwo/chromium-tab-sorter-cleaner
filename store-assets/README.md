# Chrome Web Store Assets

Use this folder for files that are uploaded in the Chrome Web Store listing UI.

## Required

- `icon-128.png`: 128x128 extension icon (already in `icons/icon-128.png`).
- At least 1 screenshot:
  - Preferred: 1280x800 PNG or JPG
  - Alternative: 640x400 PNG or JPG
  - Current: `screenshot-01-1280x800.png`

## Optional (Recommended)

- Small promo tile: 440x280 PNG or JPG
  - Current: `small-promo-440x280.png`
- Marquee promo tile: 1400x560 PNG or JPG

## Suggested File Names

- `screenshot-01-1280x800.png`
- `screenshot-02-1280x800.png`
- `small-promo-440x280.png`
- `marquee-1400x560.png`

## Quick Publish Checklist

1. Build upload ZIP: `./scripts/package-cws.sh`
2. Upload ZIP from `build/`
3. Fill listing text from `CWS_LISTING.md`
4. Upload at least one screenshot from this folder
5. Set privacy policy URL: `https://shurkantwo.github.io/chromium-tab-sorter-cleaner/`
6. Complete privacy form ("not sold", "not transferred")
