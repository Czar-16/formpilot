#!/usr/bin/env python3
"""Build an allowlisted Firefox package without changing Chrome's manifest."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'manifest.firefox.json').read_text())
output = root / 'dist'
staging = output / 'firefox'
staging.mkdir(parents=True, exist_ok=True)
# Only our generated staging directory is replaced.
shutil.rmtree(staging)
staging.mkdir()
files = ['browser-api.js', 'background.js', 'content.js', 'sidepanel.html',
         'sidepanel.css', 'sidepanel.js', 'theme.js', 'model.js', 'icons.js', 'db.js',
         'release/PRIVACY.md', 'release/THIRD-PARTY-NOTICES.md']
files += [str(p.relative_to(root)) for folder in ('fonts', 'icons')
          for p in sorted((root / folder).iterdir()) if p.is_file()]
for name in files:
    destination = staging / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / name, destination)
(staging / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
archive = output / f'formpilot-firefox-{manifest["version"]}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
    for source in sorted(staging.rglob('*')):
        if source.is_file():
            info = zipfile.ZipInfo(str(source.relative_to(staging)), (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            package.writestr(info, source.read_bytes())
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.sha256').write_text(f'{checksum}  {archive.name}\n')
print(f'{archive}\nSHA256 {checksum}')
