# Build & Release Instructions

## Build the Extension Package

To create a Chrome Web Store–ready ZIP:

```bash
npm run build
```

This will:

- Read the version from `extension/manifest.json`
- Create `dist/` if needed
- Generate `dist/folio-v{VERSION}.zip`
- Exclude system files (`.DS_Store`, `__MACOSX/*`)
- Print the package size

**Example output**: `dist/folio-v1.4.0.zip`

## Manual Build (without npm)

```bash
cd extension
zip -r ../dist/folio-v1.4.0.zip . -x "*.DS_Store" -x "__MACOSX/*"
```

## Releasing a New Version

The single source of truth for release notes is [`CHANGELOG.md`](CHANGELOG.md). The flow:

1. **Bump the version** in `extension/manifest.json` (and `package.json` to keep them in sync — npm packaging uses the latter)
2. **Add a section to `CHANGELOG.md`** at the top: `## X.Y.Z - YYYY-MM-DD`, followed by grouped changes (`### Added` / `### Fixed` / `### Changed` / `### Removed`)
3. **Update the badge in `README.md`** (`![Version](.../version-X.Y.Z-blue.svg)`) and the "What's New" block
4. **Commit + push** the version bump
5. **Tag and push the tag**:
   ```bash
   git tag -a vX.Y.Z -m "Folio vX.Y.Z"
   git push origin vX.Y.Z
   ```
6. The `Release` GitHub Actions workflow (`.github/workflows/release.yml`) will:
   - Build the extension ZIP
   - Extract the matching section from `CHANGELOG.md` as the release body
   - Create a GitHub Release with the ZIP attached

## Upload to Chrome Web Store

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Select Folio
3. Click **Package** → **Upload new package**
4. Upload the ZIP from `dist/`
5. Fill in the store listing details
6. Submit for review

## Versioning Policy

Folio follows **Semantic Versioning** (`MAJOR.MINOR.PATCH`):

- **MAJOR** — breaking changes to settings, storage format, or extension permissions
- **MINOR** — new user-visible features, non-breaking
- **PATCH** — bug fixes, compliance updates, internal improvements

`extension/manifest.json` is the canonical version (it's what Chrome ships with). `package.json`, `popup.html`'s footer badge, the About-page string, and the README badge must all match it on release.

## Package Contents

The ZIP includes everything under `extension/`:

- `manifest.json`
- JavaScript: `background.js`, `popup.js`, `options.js`, `oauth.js`, `ai-manager.js`, `drive-api.js`
- HTML: `popup.html`, `options.html`
- CSS: `modern-ui.css`
- Icons: `icon16.png`, `icon64.png`, `icon128.png`, `icon512.png`, plus `icons/*.svg`

## Notes

- `dist/` is gitignored (see `.gitignore`)
- Only the `extension/` folder is packaged
- System files are excluded by the build script
- Final package size should be well under the 5 MB Chrome Web Store limit
