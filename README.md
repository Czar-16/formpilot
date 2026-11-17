<p align="center">
  <img src="assets/brand/formpilot-logo.png" alt="FormPilot logo" width="96" height="96">
</p>

<h1 align="center">FormPilot</h1>

<p align="center">
  Your details and documents, ready to fill forms from your browser's side panel.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.2.0-blue.svg" alt="Version 2.2.0">
  <img src="https://img.shields.io/badge/Chrome-116%2B-4285F4.svg" alt="Chrome 116 or later">
  <img src="https://img.shields.io/badge/Firefox-140%2B-FF7139.svg" alt="Firefox 140 or later">
  <img src="https://img.shields.io/badge/storage-local_only-4F46E5.svg" alt="Local storage only">
</p>

<p align="center">
  <strong><a href="https://addons.mozilla.org/en-US/firefox/addon/formpilot-by-czar16/">Install for Firefox &amp; Zen</a></strong>
  &nbsp;·&nbsp;
  <strong><a href="https://github.com/Czar-16/formpilot/releases/latest">Download for Chrome</a></strong>
</p>

---

Use separate profiles for personal details, work, or job applications. Your profiles and files stay on your device—no account, analytics, or cloud sync.

## Features

- **Fill forms with a click** — fill matching empty fields while preserving existing answers. FormPilot never submits your form.
- **Keep separate profiles** — switch between personal, work, and application details.
- **Save documents** — keep résumé files and other documents ready to attach.
- **Stay organized** — search saved items and filter them by category.
- **Make it yours** — choose a light, dark, or system theme.
- **Keep control of your data** — store everything locally and export backups that include your saved files.

## Installation

### Firefox and Zen

Open the [FormPilot listing on Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/formpilot-by-czar16/) in Firefox or Zen and follow the prompts to install it. No ZIP extraction or developer mode is needed.

Requires desktop Firefox 140+ or a compatible version of Zen.

### Chrome

1. Open the [latest GitHub release](https://github.com/Czar-16/formpilot/releases/latest).
2. Under **Assets**, download **`formpilot-chrome-2.2.0.zip`** (or the Chrome ZIP for the latest version).
3. Extract the ZIP into a folder you will keep on your computer.
4. Open `chrome://extensions` and turn on **Developer mode**.
5. Click **Load unpacked** and select the extracted folder containing `manifest.json`.

Requires Chrome 116+. Keep the extracted folder in place while using the extension. To update, replace its contents with the newer Chrome release and click **Reload** on FormPilot's card at `chrome://extensions`.

## How to Use

1. Refresh any webpage tabs that were already open when you installed FormPilot.
2. Open FormPilot from the browser toolbar or press **Alt+Shift+F**.
3. Edit the saved cards with your details, or use **Settings → Add item** to add your own.
4. Open a form and click **Fill automatically**. Review the filled fields before submitting the form yourself.

### Manage your details and files

- Click a saved card's text to edit its label, type, value, or category, then click **Save**. Use **Settings → Add item**, **Add project**, or **Add category** to add entries.
- Click the profile name at the top to switch profiles or add, rename, duplicate, and delete them.
- Click **Fill automatically** to fill matching empty fields from the selected profile. Selecting a webpage field first limits filling to its form. Automatic filling preserves existing answers and uploaded files. FormPilot never submits forms.
- For an individual value, select a field on the webpage, then click the saved card's arrow.
- To save a file, edit a card with type **File**, choose a file under **Upload file**, and click **Save**. Select a webpage upload field and click **Attach** to use it; this replaces that field's current file selection. The download icon retrieves a saved file.
- Search saved items and filter by category to find a detail quickly. Choose a light, dark, or system theme in **Settings**.

## If a field does not fill

- Refresh the webpage and try again. Browser settings pages and extension stores cannot be filled.
- Check that you selected the right profile and saved a matching value. Automatic filling leaves existing answers in place.
- Select the field on the webpage, then use the saved card's arrow to fill it individually. Some custom form controls may need manual input.

For bugs or feature requests, [open a GitHub issue](https://github.com/Czar-16/formpilot/issues). Include your browser version and steps to reproduce the problem; remove personal details from screenshots and examples.

## Storage, backups, and privacy

Profiles, preferences, and saved files are stored locally in your browser. Each browser keeps its own collection; nothing syncs automatically between Chrome, Firefox, and Zen.

Use **Settings → Export JSON** to back up all profiles, including complete saved files. **Settings → Import JSON** restores a backup after confirmation, replacing **all profiles and saved files**. Export/import also transfers data between browsers. Backups contain sensitive personal data and files; keep them private.

Uninstalling removes extension storage; downloaded backups and files remain. Filling or attaching shares the selected data with the destination website. FormPilot has no analytics or remote services. See the [privacy document](release/PRIVACY.md).

## Tech Stack

- **Manifest V3** — browser-specific manifests for Chrome and Firefox.
- **Vanilla JavaScript, HTML, and CSS** — no runtime dependencies.
- **Local browser storage and IndexedDB** — profiles, preferences, and saved files on your device.
- **Bundled fonts and icons** — no remote assets needed by the extension.

## Build from Source

With Python 3 installed, run these commands from the project folder:

```sh
python3 scripts/build-chrome.py
python3 scripts/build-firefox.py
```

Packages are written to `dist/`. The Firefox build is unsigned and intended for submission or temporary testing; use the Mozilla Add-ons listing above for regular installation.

## Folder Structure

```text
formpilot/
├── assets/brand/         # Logo and wordmarks
├── fonts/               # Bundled fonts and licenses
├── icons/               # Browser extension icons
├── release/             # Privacy policy, notices, and screenshots
├── scripts/             # Chrome and Firefox package builders
├── tests/               # Extension and browser checks
├── background.js        # Coordinates fields across tabs and frames
├── browser-api.js       # Chrome and Firefox API adapter
├── content.js           # Selects and fills webpage fields
├── db.js                # Saved file storage
├── manifest.json        # Chrome configuration
├── manifest.firefox.json
├── model.js             # Profiles and field matching
└── sidepanel.*          # Side panel interface
```

## Contributing

[Open an issue](https://github.com/Czar-16/formpilot/issues) to report a bug or suggest a feature, or submit a pull request with improvements. For form-filling bugs, include your browser version and a reproducible example with dummy data.

## Third-Party Notices

Bundled font attribution and licenses: [third-party notices](release/THIRD-PARTY-NOTICES.md).
