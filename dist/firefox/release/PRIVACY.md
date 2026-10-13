# FormPilot privacy

FormPilot stores profiles, preferences and saved file metadata in extension local storage, and file contents in the browser's local IndexedDB. Temporary selected-field descriptors and document/frame registration tokens are kept in session storage. These descriptors contain labels, accessible names, placeholders, field name/ID, autocomplete and input type, never existing field values.

FormPilot has no accounts, analytics, advertising, tracking, remote services or automatic synchronization. It makes no extension-originated network requests and sends no data to its developer or third parties. Search runs locally.

You control disclosure: pressing Fill or Attach places the selected saved value or file into the webpage field you chose. Pressing Fill automatically inspects eligible controls locally and places confidently matched values from the selected profile into empty fields, including clearly identified résumé uploads. A remembered field limits filling to its form (or its document when outside a form); otherwise accessible page documents and frames are processed. Existing field contents are checked locally to preserve answers; scans sent to the panel contain descriptors and empty-state flags, never existing answers. Only matched values/files are sent back to their owning document. FormPilot never submits forms. The destination website controls any subsequent processing or transmission. Copy places the selected text on your system clipboard. Download and JSON export create local files; exports include personal values and complete saved files. Keep backups private.

Browser storage is separate between Firefox and Chrome. JSON export/import transfers profiles and files when you choose. Removing the extension deletes browser-managed extension storage, but does not remove your downloaded files or clipboard contents. Start fresh replaces saved profiles and removes their saved file records after the replacement succeeds.

The Firefox manifest declares required data collection as `none`: FormPilot has no background collection or transmission service. Filling and attachment are explicit user-directed interactions with a selected website.
