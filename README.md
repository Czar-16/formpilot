# FormPilot

FormPilot is a Chrome and Firefox extension that stores profiles and files locally and fills forms from a side panel.

## Download and install

Open the [GitHub repository](https://github.com/Czar-16/formpilot), choose **Code → Download ZIP**, and extract the archive.

**Chrome 116+:** Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the extracted folder containing `manifest.json`.

**Desktop Firefox 140+:** With Python 3 installed, run this command from the extracted project folder:

```sh
python3 scripts/build-firefox.py
```

Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/firefox/manifest.json`. Temporary installation ends when Firefox restarts. The generated ZIP is unsigned; permanent installation requires a Mozilla-signed package.

## Everyday use

Refresh existing tabs after installation. Open FormPilot using its toolbar icon or **Alt+Shift+F**.

- Click a saved card's text to edit its label, type, value, or category, then click **Save**. Use **Settings → Add item**, **Add project**, or **Add category** to add entries.
- Click the profile name at the top to switch profiles or add, rename, duplicate, and delete them.
- Click **Fill automatically** to fill matching empty fields from the selected profile. Selecting a webpage field first limits filling to its form. Automatic filling preserves existing answers and uploaded files. FormPilot never submits forms.
- For an individual value, select a field on the webpage, then click the saved card's arrow.
- To save a file, edit a card with type **File**, choose a file under **Upload file**, and click **Save**. Select a webpage upload field and click **Attach** to use it; this replaces that field's current file selection. The download icon retrieves a saved file.

## Storage, backups, and privacy

Profiles and preferences use extension local storage; saved files use IndexedDB. Temporary selected-field and frame information uses session storage. Chrome and Firefox keep separate storage, with no cloud sync.

Use **Settings → Export JSON** to back up all profiles, including complete saved files. **Settings → Import JSON** restores a backup after confirmation, replacing **all profiles and saved files**. Export/import also transfers data between browsers. Backups contain sensitive personal data and files; keep them private.

Uninstalling removes extension storage; downloaded backups and files remain. Filling or attaching shares the selected data with the destination website. FormPilot has no analytics or remote services. See the [privacy document](release/PRIVACY.md).

## Architecture

Plain HTML, CSS, and JavaScript, with no runtime dependencies:

- Browser manifests and `browser-api.js` configure Chrome/Firefox and adapt browser APIs.
- `background.js` coordinates selected fields across tabs and frames.
- `content.js` selects and fills webpage fields and attaches files.
- `sidepanel.*`, `model.js`, and `db.js` provide the panel, profile matching, and file storage.

Bundled font attribution and licenses: [third-party notices](release/THIRD-PARTY-NOTICES.md).
