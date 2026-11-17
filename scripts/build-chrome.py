#!/usr/bin/env python3
"""Build an allowlisted Chrome Web Store upload package."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'manifest.json').read_text())
output = root / 'dist'
output.mkdir(exist_ok=True)
files = ['manifest.json', 'browser-api.js', 'background.js', 'content.js',
         'sidepanel.html', 'sidepanel.css', 'sidepanel.js', 'theme.js',
         'model.js', 'icons.js', 'db.js', 'release/PRIVACY.md',
         'release/THIRD-PARTY-NOTICES.md']
files += [str(p.relative_to(root)) for folder in ('fonts', 'icons')
          for p in sorted((root / folder).iterdir()) if p.is_file()]
archive = output / f'formpilot-chrome-{manifest["version"]}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
    for name in sorted(files):
        info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        package.writestr(info, (root / name).read_bytes())
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    assert set(package.namelist()) == set(files)
    for name in files:
        assert package.read(name) == (root / name).read_bytes(), name
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.sha256').write_text(f'{checksum}  {archive.name}\n')
print(f'{archive}\nVerified {len(files)} files, root Chrome manifest and archive integrity.\nSHA256 {checksum}')
