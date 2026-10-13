# FormPilot

A Chrome and desktop Firefox Manifest V3 extension that keeps profiles and files on your device and fills the field you select on a webpage. The panel follows [DESIGN.md](DESIGN.md), with bundled fonts, light and dark themes, and plain HTML, CSS and JavaScript. No build step, runtime dependencies, analytics or runtime network requests.

## Installation and use

1. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select this directory. Chrome 116 or later is required.
2. Refresh existing webpages after installing or reloading the extension.
3. Click the FormPilot toolbar icon or press **Alt+Shift+F**. Customize the shortcut at `chrome://extensions/shortcuts`.
4. Click a saved card's text to edit its label, type, value and category. Save commits your changes; Cancel leaves them untouched. For a file item, choose a file in its edit sheet and Save.
5. Select a webpage field, then press the saved card's arrow. The target box names the remembered field and the best matching card gains an indigo border. A successful fill turns the card green, adds a check and “· Filled”, and briefly outlines the webpage field. Filling never submits the form.
6. Copy writes a text value to the clipboard and shows a check for 1.2 seconds. Download saves a stored file; Attach transfers it to a selected upload control, replacing that control's existing file selection.

The profile pill switches profiles and offers Add, Rename, Duplicate and Delete. The final profile cannot be deleted. Duplicating a profile copies files into independent IndexedDB records. Settings offers System / Light / Dark, JSON export/import, Add item/project/category, category management and Start fresh. System follows your OS and removes the explicit theme override.

Search filters labels, values and file names together with the selected category. Chips appear as All, Links, Address, Personal, Projects, Documents, Custom, then user categories. Education and Experience are available through All. Category titles open category editing; each section has an Add button. Projects contain independently editable Title (`text`), Link (`url`) and Description (`multiline`) cards.

Drag card text onto another card in the same category or project to place it before that card. Section headers support category dragging. Edit sheets also offer a drag handle and Move up/down buttons; dragging the sheet handle dismisses the sheet so you can drop onto a saved card. Select a different category in an item sheet to move an item. Use the project's Move action to move an entire project. A populated category can only be deleted after choosing a destination for all its entries.

The header, search, chips, target and privacy footer stay fixed; only the saved-items list scrolls. The panel works at 320px and 380px. Keyboard focus is visible, dialogs restore focus, buttons have accessible names, and reduced motion disables scaling and fades. The 36px profile/chip/settings visuals have expanded 44px hit areas.

## Firefox installation and release

Build with `python3 scripts/build-firefox.py`. The generated `dist/firefox/manifest.json` is Firefox-specific; the original Chrome manifest stays in place. To test temporarily, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select that generated manifest. Temporary installation ends when Firefox restarts. Desktop Firefox 140+ is required. Open the native sidebar with the toolbar button or **Alt+Shift+F**; configure shortcuts in **Manage Extension Shortcuts** from `about:addons`.

For permanent installation, upload `dist/formpilot-firefox-2.1.0.zip` through Mozilla Developer Hub and install Mozilla's signed package when available. The ZIP is unsigned. Listing copy, privacy explanation, permission rationale, notices, dummy-data screenshots and submission steps are in [release/LISTING.md](release/LISTING.md); validation evidence is in [release/VERIFICATION.md](release/VERIFICATION.md). No account credentials are included.

Firefox requests `storage`, `activeTab`, `clipboardWrite` and website access (`<all_urls>`), excluding Chrome-only APIs. Website access lets content scripts remember selected fields across tabs and frames. If access is withheld, enable the desired sites in Firefox's extension settings and refresh them. Firefox and Chrome storage remain separate: JSON export/import transfers profiles and files.

```sh
npx --yes web-ext lint --source-dir dist/firefox
SELENIUM_MODULE=/path/to/selenium-webdriver FIREFOX_PATH=/path/to/firefox GECKODRIVER_PATH=/path/to/geckodriver node tests/firefox.cjs
```

The Firefox test installs the actual package into a disposable browser profile. Run it separately from the Chrome suite: both serve fixtures on port 8765. Firefox test screenshots use only dummy data and are written to `release/screenshots/`.

## New defaults and existing installations

New profiles have eight categories: Links, Address, Personal, Projects, Documents, Education, Experience and Custom. Fourteen items start empty:

- Personal: Full name, Email, Phone, Bio.
- Address: Street address, City, State, Pin code, Country.
- Links: Website, LinkedIn, GitHub, Portfolio.
- Documents: Resume.

On the first opening of an existing version-1 collection, **Export backup / Start fresh / Cancel** is offered. Export includes all current profiles and files. Start fresh commits the new version-2 collection before cleaning up the previous files. A failed metadata commit leaves the old collection and files intact. Cancel keeps all saved values and suppresses the automatic prompt; Settings → Start fresh lets you revisit the decision. There is no silent destructive migration.

## Storage, backup and privacy

**All data is stored only on this device.** Profiles use extension `storage.local`, files use IndexedDB, and temporary focus ownership uses `storage.session`. Firefox prefers the `browser` API namespace; Chrome uses `chrome`. No automatic cloud backup exists. Uninstalling the extension deletes its storage.

Export includes all profiles, category/entry/field ordering, project membership, file metadata and base64 contents, and the theme preference. Keep exports safe: they contain your personal data. Import accepts collection versions 1 and 2, validates unique IDs, types, every reference and file encoding, and confirms before replacing all profiles. Legacy labels, values, category IDs and ordering remain intact; URL and multiline metadata are converted. Cancel or validation failure preserves the collection. File records are staged under new IDs and removed if the metadata commit fails; old files are cleaned up only after a successful commit. Saves, reset, import and export are serialized within each panel.

Permissions are exactly `storage`, `sidePanel`, `activeTab`, `scripting`, and `clipboardWrite`. Content scripts run in all permitted webpage frames. No context-menu permission or optional context menu is used. Field descriptors contain only labels, accessible names, placeholders, name/ID, autocomplete and input type—never the field's current value.

## Architecture

- `manifest.json`: Chrome side panel, service worker, bundled icons and shortcut.
- `manifest.firefox.json`: Firefox 140+ native sidebar, background scripts, stable ID and data declaration.
- `browser-api.js`: shared Promise-based browser API adapter, loaded before background/content/panel/theme code.
- `scripts/build-firefox.py`: allowlisted, reproducible Firefox package and SHA-256 checksum.
- `background.js`: serialized focus ownership per tab, frame/document tokens and navigation cleanup.
- `content.js`: retained fields, open-shadow focus, native setters/events, selects, contenteditable, DataTransfer uploads and reversible green feedback. Only the owning document responds to transfers.
- `sidepanel.html`, `sidepanel.css`, `sidepanel.js`: fixed panel layout, popovers, sheets, local preference, CRUD and staged import/reset.
- `theme.js`: applies the saved theme before revealing the panel to avoid theme flashes.
- `model.js`: deterministic field matching and lossless legacy metadata conversion. Matching prefers exact canonical labels, then whole-label containment, then meaningful token overlap; saved order resolves ties. Autocomplete aliases include `postal-code` → Pin code and `tel` → Phone.
- `icons.js`, `icons/`, `assets/brand/`: the design's inline SVG paths and generated local PNG marks.
- `db.js`: transactional IndexedDB files and base64 validation.
- `fonts/`: bundled WOFF2 files and license notices.

Collection version 2 contains `theme`, `activeProfileId` and ordered `profiles`. Each profile owns ordered `categories`, `items` and `groups`. Categories have stable IDs and ordered `entries` (`{kind:"item"|"group",id}`). Groups own ordered `fields` item IDs. Items use `{id,category,label,value,type}`, where type is `text`, `multiline`, `url` or `file`. A file value is an IndexedDB record ID, empty until uploaded. Exports add a `files` array with ID, name, MIME type, last-modified time and base64 content.

Each panel follows the active tab in its own browser window. Panel focus does not discard the remembered webpage field. Filled item IDs last until a tab switch or navigation; filled styling takes precedence over target styling. A removed field produces an actionable error. Document IDs and random tokens prevent delivery to another document after navigation.

## Font attribution

Manrope was designed by Mikhail Sharanda; its OFL variable release covers the requested 400–800 weights. The specified [original repository](https://github.com/sharanda/manrope) returned HTTP 404 during implementation, so the bundled WOFF2 was converted from the [Google Fonts OFL archive](https://github.com/google/fonts/tree/main/ofl/manrope) of that release. `fonts/Manrope-OFL.txt` accompanies it. This uses the archived OFL font, rather than the newer separately licensed V5 release.

[JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) by Philipp Nurullin and Konstantin Bulenkov is bundled directly from the archived webfonts in its official repository at weights 400 and 500, with `fonts/JetBrainsMono-OFL.txt`.

All fonts load locally. If a bundled font cannot load, the fallback stacks are `Manrope, system-ui, sans-serif` and `"JetBrains Mono", ui-monospace, monospace`. No remote-font fallback exists.

## Verification

Run model tests and syntax checks:

```sh
node tests/model.mjs
node tests/assets.cjs
node tests/browser-api.cjs
node --check sidepanel.js
node --check background.js
node --check content.js
node --check db.js
node --check theme.js
node --check model.js
node --check icons.js
```

With Playwright installed outside the extension and a Chromium/Chrome for Testing executable:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_PATH=/path/to/chromium node tests/browser.cjs
```

The integration test serves local fixtures on port 8765 and loads the unpacked extension into a temporary browser profile. It covers fourteen defaults, CRUD, keyboard/drag ordering, projects, local files, duplication, canceled/invalid imports, staged-file rollback, legacy import, reset cancellation/failure, live matching and filled states, copy timing, repeated field feedback, selects, contenteditable, open shadow DOM, same/cross-origin frames, file restrictions, React-controlled inputs, navigation, all sixteen theme tokens plus delete colors, font loading, focus restoration, reduced motion, fixed layout and 320/380px screenshots. Extension-page network requests are checked. Screenshots are written to the system temporary directory as `formpilot-{system,light,dark}-{320,380}.png` for comparison with DESIGN.md.

`tests/react.html` is an actual React-controlled form: fill its input and click Rerender; the value and React output must persist. Its prebuilt local React fixture is test-only, accompanied by `tests/React-LICENSE.txt`. To rebuild it with React, React DOM and esbuild installed externally, use `NODE_PATH=/path/to/node_modules /path/to/esbuild tests/react-source.jsx --bundle --minify --define:process.env.NODE_ENV='"production"' --outfile=tests/react-fixture.js`.

Manual checks in a real Chrome side panel:

- [ ] Load unpacked with no extension errors; toolbar and shortcut open the panel.
- [ ] Compare light/dark at 320px and 380px with DESIGN.md: exact colors, fonts, spacing, borders, arrows, fixed header/footer, target and filled cards.
- [ ] Tab through profile, settings, search, chips, edit/copy/fill controls; exercise Escape, Save, Cancel and focus restoration. Check touch targets and reduced motion.
- [ ] Select fields in two separate browser windows; each panel follows its own active tab and retains targets when the panel receives focus.
- [ ] Fill the actual local React fixture, click Rerender and verify both input and React output; also test the intended application framework.
- [ ] Test same/cross-origin frames, repeated filling, removed/disabled fields and navigation; check original outline/shadow restoration after 800ms.
- [ ] Test explicit file upload controls, MIME/extension restrictions, ambiguous upload candidates, replacement and download; test custom widgets separately.
- [ ] Export/import projects and files; cancel reset and import; simulate storage quota and file-staging failures.
- [ ] Inspect extension DevTools during normal use: no runtime network requests.

## Limitations

Browser internal pages, Mozilla Add-ons, the Chrome Web Store and other protected pages cannot receive content scripts. Restricted pages show field-selection or refresh/unsupported-page guidance; Chrome may withhold their URLs under the chosen permissions. Local `file://` pages require **Allow access to file URLs** in extension settings. Closed shadow roots are inaccessible. Navigation or removed fields require selecting a field again.

Synthetic input/change/blur events and native setters work with ordinary forms and the tested React-controlled form, but cannot guarantee every custom application accepts them. Rich text editors may normalize text. Selects match enabled option value/text exactly, then without case sensitivity. File attachment checks extension/MIME and requires an unambiguous enabled upload control. Large files can exceed device quota, memory or Chrome message limits; use the webpage's file picker if attachment fails. There is no application-imposed file-size cap. Multiple panels share committed metadata; simultaneous edits from separate panels are not merged.
