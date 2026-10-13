"""Audit the unsigned Firefox release archive against current sources."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "manifest.firefox.json").read_text())
archive = root / "dist" / f"formpilot-firefox-{manifest['version']}.zip"
with zipfile.ZipFile(archive) as package:
    names = package.namelist()
    assert "manifest.json" in names and len(names) == len(set(names))
    assert package.testzip() is None
    allowed = {"manifest.json", "browser-api.js", "background.js", "content.js",
               "sidepanel.html", "sidepanel.css", "sidepanel.js", "model.js",
               "theme.js", "icons.js", "db.js", "release/PRIVACY.md",
               "release/THIRD-PARTY-NOTICES.md"}
    allowed.update(str(p.relative_to(root)) for folder in ("fonts", "icons")
                   for p in (root / folder).iterdir() if p.is_file())
    assert set(names) == allowed, set(names) ^ allowed
    assert json.loads(package.read("manifest.json")) == manifest
    for name in names:
        assert not name.startswith("/") and ".." not in Path(name).parts
        if name != "manifest.json":
            assert package.read(name) == (root / name).read_bytes(), name
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
assert archive.with_suffix(".sha256").read_text() == f"{checksum}  {archive.name}\n"
print(f"PASS: {len(names)} allowlisted release files, root manifest, source bytes, archive integrity and SHA-256")
