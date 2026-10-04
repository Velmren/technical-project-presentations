#!/bin/sh
# Builds a release candidate from one pinned commit in a clean copy outside the shared working tree.
# The same full hash is used for the export and for the package label, so commits that land meanwhile cannot mix in.
# Usage: sh scripts/build-candidate.sh <commit>
#   RELEASE_OUT  folder for the copies (default C:/AstraTmp/portfolio-release); the result is
#                <RELEASE_OUT>/<short hash>/output/deploy/<version>/ with public-bundle.tar.gz and manifest.json.
# Delete the copy after the release is deployed: the server keeps its own.
set -e
R=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
FULL=$(git -C "$R" rev-parse "$1")
SHORT=$(git -C "$R" rev-parse --short "$1")
D=${RELEASE_OUT:-C:/AstraTmp/portfolio-release}/$SHORT
mkdir -p "$D"
# --force-local: GNU tar from Git Bash would read the drive letter in an absolute path as a remote host.
git -C "$R" -c core.autocrlf=false archive "$FULL" | tar --force-local -x -C "$D"
# Not in Git, taken from this working tree: the Category Spark browser build and the gallery films.
[ -d "$R/public/assets/godot/web" ] || { echo "public/assets/godot/web is missing: build it with scripts/build-category-spark-web.mjs" >&2; exit 1; }
cp -r "$R/public/assets/godot/web" "$D/public/assets/godot/web"
for f in $(find "$R/public/assets/video" -name "*.mp4" | sed "s|$R/public/assets/video/||"); do
  mkdir -p "$D/public/assets/video/$(dirname "$f")"
  cp "$R/public/assets/video/$f" "$D/public/assets/video/$f"
done
echo "commit $SHORT, films $(find "$D/public/assets/video" -name '*.mp4' | wc -l)"
npm --prefix "$D" ci > "$D-ci.log" 2>&1
node "$D/scripts/prepare-videos.mjs" --check | tail -1
npm --prefix "$D" test 2>&1 | grep -E "^ℹ (pass|fail)"
npm --prefix "$D" run typecheck > /dev/null 2>&1 && echo "typecheck ok"
npm --prefix "$D" run build > "$D-build.log" 2>&1 && echo "build ok"
RELEASE_COMMIT=$FULL npm --prefix "$D" run package:release 2>&1 | tail -1
