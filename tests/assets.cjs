const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file));
const manifest = JSON.parse(read("manifest.json"));
assert.equal(manifest.name, "FormPilot");
assert.equal(manifest.manifest_version, 3);
assert.deepEqual([...manifest.permissions].sort(), [
  "activeTab",
  "clipboardWrite",
  "scripting",
  "sidePanel",
  "storage",
]);
assert.equal(
  manifest.commands["open-panel"].suggested_key.default,
  "Alt+Shift+F",
);
for (const size of [16, 32, 48, 128, 256]) {
  const png = read(`icons/${size}.png`);
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}
for (const font of ["Manrope", "JetBrainsMono-Regular", "JetBrainsMono-Medium"])
  assert.equal(read(`fonts/${font}.woff2`).subarray(0, 4).toString(), "wOF2");
for (const notice of ["Manrope", "JetBrainsMono"])
  assert.match(
    read(`fonts/${notice}-OFL.txt`).toString(),
    /SIL OPEN FONT LICENSE/,
  );
for (const file of [
  "browser-api.js",
  "sidepanel.js",
  "background.js",
  "content.js",
  "db.js",
  "theme.js",
  "model.js",
  "icons.js",
]) {
  const check = spawnSync(
    process.execPath,
    ["--check", path.join(root, file)],
    { encoding: "utf8" },
  );
  assert.equal(check.status, 0, check.stderr);
  assert.doesNotMatch(
    read(file).toString(),
    /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/,
    file,
  );
}
for (const file of ["sidepanel.html", "sidepanel.css"])
  assert.doesNotMatch(
    read(file).toString(),
    /(?:src|href)=["']https?:\/\/|url\(["']?https?:\/\//,
    file,
  );
for (const file of [
  manifest.background.service_worker,
  manifest.side_panel.default_path,
  ...manifest.content_scripts.flatMap((s) => s.js),
  ...Object.values(manifest.icons),
])
  assert.ok(fs.existsSync(path.join(root, file)), file);
console.log(
  "PASS: manifest, five permissions, shortcut, PNG dimensions, WOFF2/license assets, JavaScript syntax and no runtime network APIs or remote assets",
);

const firefox = JSON.parse(read("manifest.firefox.json"));
assert.equal(firefox.version, "2.1.0");
assert.deepEqual(firefox.permissions, ["storage", "activeTab", "clipboardWrite"]);
assert.deepEqual(firefox.host_permissions, ["<all_urls>"]);
assert.equal(firefox.background.service_worker, undefined);
assert.equal(firefox.side_panel, undefined);
assert.deepEqual(firefox.background.scripts, ["browser-api.js", "background.js"]);
assert.deepEqual(firefox.content_scripts[0].js, ["browser-api.js", "content.js"]);
assert.equal(firefox.sidebar_action.default_panel, "sidepanel.html");
assert.deepEqual(firefox.browser_specific_settings.gecko, {
  id: "formpilot@extensions.local", strict_min_version: "140.0",
  data_collection_permissions: {required: ["none"]}
});
assert.ok(read("sidepanel.html").toString().indexOf('src="browser-api.js"') < read("sidepanel.html").toString().indexOf('src="theme.js"'));
console.log("PASS: Firefox manifest, adapter load order, desktop target, data declaration and permission exclusions");
