# Mozilla Add-ons listing draft

Name: FormPilot

Summary: Save profiles and files on your device, then fill application forms with one click from Firefox’s sidebar.

## Description

Keep the details you use often within reach. FormPilot opens in Firefox’s native sidebar so you can work beside the form you’re completing.

Create separate profiles for work, personal use, or applications. Save names, addresses, links, notes, project details, and résumé files. Search saved items, filter by category, and arrange cards to match your workflow.

Press Fill automatically to fill empty fields using your selected profile. Click a field first to limit filling to its form. Existing answers and files are preserved; clearly identified résumé uploads are attached only when accepted. Persistent results report filled fields, files, unmatched fields and failures. Click again for newly revealed fields or another application step. New profiles include separate First name and Last name cards; existing Full name data is retained. You can also click a webpage field, then press a saved card’s arrow to fill it. FormPilot remembers the selected field in each tab and window and suggests matching saved items. It never submits your form. Copy text, download stored documents, or attach a résumé to a selected upload control.

Choose a light, dark, or system theme. Export and import JSON backups including profiles and saved files. Chrome and Firefox keep separate storage; use a backup to transfer your collection.

Your collection stays on your device. No account, cloud sync, analytics, advertising, or extension-originated network requests. Data reaches a webpage only when you choose Fill automatically, Fill or Attach. Keep exported backups private.

Open FormPilot using the toolbar button or Alt+Shift+F. Desktop Firefox 140 or later is required. Internal browser pages, add-on stores, and other protected pages cannot be filled. Some custom editors and upload widgets may require manual input.

## Permission rationale

- Website access (`<all_urls>`): detect the field you select and fill it only when you press Fill automatically, Fill or Attach, including fields in embedded frames. It also allows the sidebar to identify the active webpage. Firefox’s website-access controls can limit the sites where this works. FormPilot checks field contents locally to preserve existing answers. Existing values never leave the owning content script. FormPilot never submits forms.
- `storage`: save profiles and theme preferences locally and maintain temporary field ownership by tab.
- `activeTab`: enable access associated with an explicit toolbar/shortcut interaction; broader website permission supports field selection across tabs and frames.
- `clipboardWrite`: copy a saved value when you press Copy. Clipboard reading is not part of the extension.

Firefox does not request Chrome’s `sidePanel` or `scripting` permissions. The built-in sidebar API requires no separate permission.

## Reviewer notes

Plain, readable HTML/CSS/JavaScript with no compilation step or runtime libraries. Firefox’s manifest is generated into the package from `manifest.firefox.json`; Chrome keeps its own manifest. Build: `python3 scripts/build-firefox.py`. The package includes only extension files, icons, local fonts, privacy text, and license notices. Test fixtures, including React, are excluded.

Temporary field ownership uses `storage.session`, frame IDs and random per-document tokens. The Firefox toolbar and command handlers call `sidebarAction.open()` directly within the user gesture. Chrome continues to use its service worker and side-panel API.

Privacy text is in `PRIVACY.md`; bundled font notices are in `THIRD-PARTY-NOTICES.md` and the full notices accompany the fonts. FormPilot's existing licensing is unchanged; no top-level open-source license exists in the supplied project. Select the appropriate existing/custom license when completing the listing. Do not select a new open-source license.

Suggested screenshots: `screenshots/firefox-light-380.png`, `screenshots/firefox-dark-380.png`, and `screenshots/firefox-light-380-focused.png`. All captured values and résumé contents are dummy examples.

## Public submission

1. Sign in at https://addons.mozilla.org/developers/addon/submit/ and choose distribution on this site (public listed release).
2. Upload `dist/formpilot-firefox-2.2.0.zip`; respond to validation/review findings. Android is intentionally unsupported. See `VERIFICATION.md` for lint warnings and test evidence.
3. Use the summary, description, privacy text, permission explanations and screenshots above. Select the appropriate existing/custom license. Account-owned author/support fields must be supplied by the publisher.
4. Complete and submit the listing. Record the actual listing URL and signing/review status; do not assume the name determines the URL.
5. After Mozilla provides the signed XPI, download it and install that signed package for permanent installation. The current ZIP is unsigned, suitable for submission and temporary testing only.

No submission, listing URL, review result or signed package exists yet. Publication requires an authenticated Mozilla Developer Hub account.
