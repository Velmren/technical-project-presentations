#!/bin/bash
# Installs a release made by scripts/package-release.mjs on the Velmren server.
# Usage: deploy-release.sh <version> <archive-sha256>
# Expects ~/velmren-portfolio-<version>.tar.gz and ~/velmren-portfolio-<version>.manifest.json
# (gcloud compute scp). The previous release stays in place; ROLLBACK.txt in the receipt switches back.
set -euo pipefail
version=${1:?release version required}
expected=${2:?archive SHA-256 required}
base=/srv/velmren
archive="$HOME/velmren-portfolio-$version.tar.gz"
manifest="$HOME/velmren-portfolio-$version.manifest.json"
receipt="$base/docs/deployments/$version"
printf '%s  %s\n' "$expected" "$archive" | sha256sum -c -
python3 - "$archive" <<'PY'
import sys, tarfile
with tarfile.open(sys.argv[1]) as bundle:
    for item in bundle.getmembers():
        parts=item.name.split('/')
        assert parts[0] in ('portfolio','demos'), item.name
        assert not item.name.startswith('/') and '..' not in parts, item.name
        assert item.isfile() or item.isdir(), item.name
        assert all(not p.startswith('.') for p in parts), item.name
print('Archive paths and file types: PASS')
PY
test ! -e "$base/sites/portfolio/releases/$version"
test ! -e "$base/sites/demos/forma/releases/$version"
test ! -e "$base/sites/portfolio/current.next"
test ! -e "$base/sites/demos/forma/current.next"
sudo install -d -m 755 "$base/sites/demos/forma/releases" "$receipt" "$base/tmp/deploy/$version/extracted"
sudo cp "$archive" "$base/tmp/deploy/$version/public-bundle.tar.gz"
sudo tar --no-same-owner -xzf "$archive" -C "$base/tmp/deploy/$version/extracted"
sudo python3 - "$manifest" "$base/tmp/deploy/$version/extracted" <<'PY'
import sys,json,hashlib,pathlib
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text())
root=pathlib.Path(sys.argv[2])
listed=set()
for item in manifest['files']:
    p=root/item['path']; listed.add(item['path'])
    assert p.stat().st_size==item['bytes'], item['path']
    assert hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256'], item['path']
actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
assert actual==listed, 'Unexpected file set'
print(f"Transferred file hashes: PASS ({len(listed)} files)")
PY
sudo cp -a "$base/tmp/deploy/$version/extracted/portfolio" "$base/sites/portfolio/releases/$version"
sudo cp -a "$base/tmp/deploy/$version/extracted/demos/forma" "$base/sites/demos/forma/releases/$version"
sudo chown -R root:root "$base/sites/portfolio/releases/$version" "$base/sites/demos/forma/releases/$version"
sudo find "$base/sites/portfolio/releases/$version" "$base/sites/demos/forma/releases/$version" -type d -exec chmod 755 {} +
sudo find "$base/sites/portfolio/releases/$version" "$base/sites/demos/forma/releases/$version" -type f -exec chmod 644 {} +
# The portfolio pins its own FORMA build, so switching portfolio/current switches both together.
sudo ln -s "$base/sites/demos/forma/releases/$version" "$base/sites/portfolio/releases/$version/forma/live"
test -f "$base/sites/portfolio/releases/$version/forma/live/index.html"
previous=$(readlink "$base/sites/portfolio/current")
previous_forma=$(readlink "$base/sites/demos/forma/current")
sudo cp "$manifest" "$receipt/manifest.json"
printf 'version=%s\nprevious_portfolio=%s\nprevious_forma=%s\narchive_sha256=%s\ndeployed_at_utc=%s\n' \
  "$version" "$previous" "$previous_forma" "$expected" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | sudo tee "$receipt/receipt.txt" >/dev/null
sudo tee "$receipt/ROLLBACK.txt" >/dev/null <<TXT
Switch velmren.com back to the release that was live before $version:
  sudo ln -s $previous $base/sites/portfolio/current.next && sudo mv -Tf $base/sites/portfolio/current.next $base/sites/portfolio/current
  sudo ln -s $previous_forma $base/sites/demos/forma/current.next && sudo mv -Tf $base/sites/demos/forma/current.next $base/sites/demos/forma/current
No Caddy reload is needed for the switch. Release folders are not deleted by either direction.
TXT
sudo chown -R root:root "$receipt"
sudo chmod -R u=rwX,go=rX "$receipt"
sudo ln -s "releases/$version" "$base/sites/demos/forma/current.next"
sudo mv -Tf "$base/sites/demos/forma/current.next" "$base/sites/demos/forma/current"
sudo ln -s "releases/$version" "$base/sites/portfolio/current.next"
sudo mv -Tf "$base/sites/portfolio/current.next" "$base/sites/portfolio/current"
printf 'Published: %s\nPrevious: %s\n' "$version" "$previous"
readlink -f "$base/sites/portfolio/current"
readlink -f "$base/sites/portfolio/current/forma/live"
for page in / /en/ /forma/live/ /assets/godot/web/index.html; do
  curl --fail --silent --show-error --resolve velmren.com:443:127.0.0.1 "https://velmren.com$page" -o /dev/null
  printf 'local check %s: OK\n' "$page"
done
rm -f "$archive" "$manifest"
# The staging copy is only needed until the release is copied into place: left behind, it costs about 1 GB per release.
sudo rm -rf "${base:?}/tmp/deploy/${version:?}"
