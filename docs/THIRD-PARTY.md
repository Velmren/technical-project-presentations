# Third-party assets

## Godot Engine logo

- Author: Andrea Calabró, 2017.
- Source: [Godot press kit](https://godotengine.org/press/), Godot Engine icons, coloured SVG: https://godotengine.org/assets/press/icon_color.svg
- File: `public/assets/brands/godot.svg`, downloaded on 26 September 2026 and not modified. SHA-256 `7e2f17cf43a151e26736468544023ced8c07210c57b9d238264a1f1b28af9868`.
- Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The author's notice from the [Godot repository](https://github.com/godotengine/godot/blob/master/misc/logo/LICENSE.txt) is copied unchanged to `public/assets/brands/godot-LICENSE.txt`.
- Use: marks the engine in the lower block of the Category Spark page. The credit links to `/assets/brands/godot-credit.html` with the source, licence and a note that the file is unchanged. The logo is not used as the mark of Category Spark and does not imply endorsement by the Godot developers, in line with the press kit usage guidelines.

## Fonts

All fonts below are licensed under the SIL Open Font License 1.1.

| Font | Location | Licence text |
| --- | --- | --- |
| Golos Text, Tektur, Sofia Sans Condensed | downloaded from Google Fonts at build time by `next/font` | not stored in the repository |
| Onest | `demos/forma/assets/` | `demos/forma/assets/OFL-Onest.txt` |
| IBM Plex Sans, IBM Plex Mono | `public/projects/dev-utilities/fonts/` | `OFL-IBMPlexSans.txt`, `OFL-IBMPlexMono.txt` in the same folder; sources in `new-projects/dev-utilities/src/fonts/` |
| Inter, Caveat | `public/projects/admin-dashboard/assets/` | `OFL-Inter.txt`, `OFL-Caveat.txt` in the same folder; sources in `new-projects/admin-dashboard/static/assets/` |
| Tektur, IBM Plex Sans (subset renamed Lacuna Text) | `new-projects/game-concept/assets/fonts/`, `public/projects/game-concept/assets/fonts/` | `OFL-Tektur.txt`, `OFL-IBMPlexSans.txt` in the same folders |
| Nunito, Rubik, PT Sans, Noto Serif | `public/projects/mobile-game/` (inside the game package) | OFL files packaged with the game |
| Golos Text, Tektur | `public/projects/motion/fonts/` | `Golos-Text-OFL.txt`, `Tektur-OFL.txt` in the same folder |
| Inter, Literata (subsets) | `public/projects/shopify/preview/fonts/` | `OFL-Inter.txt`, `OFL-Literata.txt` in the same folder |
| Jost | `new-projects/assembly/fonts/`, `public/projects/assembly/fonts/` | `Jost-OFL.txt` in the same folders |

The videos in `public/assets/motion/video/` were rendered with Inter Tight, Nunito, Manrope, Unbounded, Tektur and Golos Text, all under the SIL Open Font License 1.1; those font files are not in the repository.

The browser build of Category Spark, produced by `scripts/build-category-spark-web.mjs` and not committed, also includes DejaVu Sans Bold from the `dejavu-fonts-ttf` package, under the Bitstream Vera and DejaVu licence, with its licence file.

## Code and data

- three.js, MIT: `new-projects/game-concept/vendor/three/` and `public/projects/game-concept/vendor/three/`, licence in `LICENSE` in each folder.
- JSONPath Compliance Test Suite, BSD 2-Clause: test fixture in `new-projects/dev-utilities/tests/fixtures/jsonpath-cts/`, licence in the same folder.
- lottie-web 5.13.0 (light, canvas build), MIT: `public/assets/motion/embed/lottie_light_canvas.min.js`, licence in `lottie-web-LICENSE.txt` in the same folder.
- The hatch animation (`public/assets/motion/embed/hatch.js`), the live Lottie page and the motion examples page are original code. The motion videos were composed with GSAP 3.15 (GSAP Standard licence, https://gsap.com/standard-license) and rendered locally; only the finished videos are published.
- The Sheaf demo (`public/projects/shopify/`) does not include files of Shopify's Dawn theme. The screenshots on its page show the section rendered next to Dawn's stylesheet in local development.

## Music

The sound of the videos in `public/assets/motion/video/` is music from Free Stock Music cut on its bar grid and mixed with synthesised effects. The tracks themselves are not stored in the repository, only excerpts inside the finished videos. The credit is also in the footer of `public/projects/motion/`.

- "Sunfade" by Roa Music, Royalty Free Music by https://www.free-stock-music.com. Licence: [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Page: https://www.free-stock-music.com/roa-music-sunfade.html (checked 1 October 2026). Used in `reel.mp4`.
- "Between Oceans and Summits" by Alex-Productions, https://onsound.eu/, Royalty Free Music by https://www.free-stock-music.com. Licence: [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Page: https://www.free-stock-music.com/alex-productions-between-oceans-and-summits.html (checked 1 October 2026). Used in `sono-promo.mp4`.
- "Little Adventures" by Sokolovsky Music, http://sokolovskymusic.com, Royalty Free Music by https://www.free-stock-music.com. Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Page: https://www.free-stock-music.com/sokolovsky-music-little-adventures.html (checked 1 October 2026). Used in `vertical.mp4`.

## Veresta

The buildings, the site and the materials without textures are modelled for the project in Blender. The rendered frames in `public/assets/assembly/` also contain the Poly Haven assets below, all under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); the source files are not stored in the repository. The full list with authors is in `new-projects/assembly/ASSETS.md`.

- Brick textures: Brick Wall 006, Brick Wall 001, Red Bricks 04.
- Sky: Qwantani Dusk 2 (Pure Sky).
- Plants: Tree Small 02, Jacaranda Tree, Island Tree 01, 02 and 03, Pine Tree 01, Searsia Burchellii, Shrub 02, Fern 02, Grass Medium 02, Periwinkle Plant.

## VELMREN tech

Brand logo sources are listed in `new-projects/electronics-store/docs/BRAND-SOURCES.md`, product images, video and the 3D model in `new-projects/electronics-store/docs/IMAGE-SOURCES.md`.
