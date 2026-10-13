# FormPilot Firefox 2.2.0 verification

Verified on 2026-10-13. Mozilla publication was left untouched at the user's request. No listing URL or signed XPI has been produced.

## Automated results

- `node tests/model.mjs`: pass; manual and strict bulk matching, separate-name aliases, combined full names, ambiguous matches, confidence thresholds, project exclusion, lossless legacy conversion and idempotent name migration.
- `node tests/assets.cjs`: pass; Chrome and Firefox manifests, permissions, API adapter load order, shortcut, local icons/fonts/notices, syntax and absence of runtime network APIs or remote assets.
- `node tests/browser-api.cjs`: pass; Firefox namespace preference, synchronous sidebar opening within command/action gestures, Chrome opening, omitted document IDs, frame fallback, stale-document clear protection and tab/navigation cleanup. Frame registrations survive background restarts through session storage and stale unregister tokens cannot erase a new document.
- `tests/browser.cjs`: pass on Google Chrome for Testing 153.0.8010.12. Existing CRUD, profiles, files, backups and rollback, themes, native/React/shadow/frame filling, navigation and two-window tests pass. The one-click button works without selecting individual fields or showing matching cards in search; it follows the panel’s window even when another window is focused. Bulk scans and writes cover form isolation, existing values/selections, changed-after-scan fields, open shadows, nested contenteditable, native/React inputs, same/cross-origin frames, résumé acceptance and partial failures. Search focus/unfocus, filtering, 44px geometry, one outer focus ring and containment verified at 320px, 380px and 640px in both themes and system mode. No extension-page network requests observed.
- `tests/firefox.cjs`: pass with the actual temporary-installed release ZIP on Mozilla Firefox 140.0 and Firefox 155.0. Native toolbar opening, registered Alt+Shift+F command opening, profile edit/duplication, persistent themes, clipboard copy, dummy résumé upload/download/attachment, full JSON file backup/import, native inputs/select/contenteditable, React-controlled inputs, same/cross-origin frames, navigation token protection, and independent ownership across two browser windows pass. Search focus/unfocus, filtering and alignment are checked at 320px, 380px and 640px in light/dark themes. The one-click button and shared bulk suite pass, including filling while search hides saved cards and preserving existing answers. Extension asset resource entries contain no HTTP(S) URLs.
- `python3 tests/package.py`: pass. Archive audit: 23 allowlisted files, matching source bytes and Firefox manifest; no tests, React, development scripts, source artwork, screenshots, credentials or dependency trees. Full bundled font license notices included. The build produces a SHA-256 file alongside the ZIP and is deterministic.

The runtime code audit found no fetch, XMLHttpRequest or WebSocket calls and no remote asset URLs. Tests use local HTTP fixtures and test-only blob reads to inspect exports/downloads; those calls are outside the extension's normal runtime code. Local font assets load in the existing Chrome suite; Firefox renders the same locally bundled assets.

## Lint

`web-ext` 10.7.0: **0 errors, 0 notices, 2 warnings**. Exact machine-readable output is in `firefox-lint.json`.

1. `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`: the linter compares the data declaration against Android 140. Firefox Android introduced it in 142. This package intentionally supports desktop only and omits `gecko_android`; no Android listing support is declared. Desktop Firefox 140 supports the declaration and the installed-package suite passed there.
2. `UNSAFE_VAR_ASSIGNMENT`, `icons.js:35`: the existing icon renderer assigns `innerHTML` from the bundled `paths` object. Those SVG strings are static source constants selected by application icon names; saved profile values, field descriptors and imports never supply this markup. No change to the established icon asset system was made.

## Screenshots and review limits

`release/screenshots/` contains refreshed focused/unfocused light and dark captures at all three widths from the installed Firefox extension page, plus Chrome light/dark/system captures. The 44px automatic-fill button, keyboard focus and persistent result fit at all widths; reduced motion remains covered by the Chrome suite. Values are dummy data (`Alex Example`, a dummy résumé); no personal collection was loaded. The page was constrained to sidebar widths for these captures; native sidebar opening was tested separately.

The shortcut test verifies Firefox's registered `F` / `alt,shift` key binding and dispatches its native command event, then verifies the sidebar opens. Synthetic WebDriver keystrokes did not activate the browser shortcut reliably. A physical Alt+Shift+F press with the user's desktop/keyboard configuration remains a manual check.

Frame transfers are tested through the real background/content message route using frame IDs and document tokens. The Chrome suite separately exercises panel/window following; Firefox tests window-separated owner records. Download tests intercept the final local anchor click and read its blob to verify contents without OS download prompts. These do not replace a final manual check of the installed sidebar's Fill/Attach buttons or the OS file-save interaction.

The current ZIP is unsigned. Mozilla signing/review and permanent installation are not verified and were not requested to proceed after the user's instruction to leave submission alone. Existing FormPilot licensing is unchanged.

The system Firefox 157 launcher did not start under WebDriver in this environment; verification used the standalone Firefox 140 and 155 binaries. The unsigned 2.2.0 ZIP and adjacent checksum were regenerated after the source checks.

Background-response regression checks pass through the actual Fill automatically handler in Chrome and Firefox: missing responses for focus ownership or document registration, malformed registry replies and rejected messages produce actionable reload instructions, restore the button and never scan or write webpage fields. Normal filling still succeeds afterward.

Automatic-fill reconnection checks pass in Chrome and Firefox after clearing live page registrations. Chrome's separate `tests/reconnect-browser.cjs` also verifies on-demand script injection into a page without a static content script, preservation of existing answers and protection against duplicate listeners. The full browser suites pass with the refresh button at sidebar widths. Its handler is tested with a stubbed `runtime.reload`, including failure recovery. An actual reload/reopen check in command-line-loaded headless Chrome was blocked by `ERR_BLOCKED_BY_CLIENT` after reloading; reopening the native panel after a real refresh remains a manual check. The Firefox package was rebuilt and its source/archive/checksum audit passes.
