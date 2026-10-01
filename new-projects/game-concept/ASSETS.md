# Assets and licences

## Built in code (no files shipped)

- **MULE–06, the three utility modules, the service bay, props, the sector map, the five operation targets (NACRE–9 courier wreck, SERAPH–2 lifeboat, TALLOW REACH freighter, K–17 beacon, BRINE HOLLOW platform), the debris field and the seven salvage items** are modelled procedurally in `src/render/` (rounded lofts, lathes, filleted extrusions, instanced structure).
- **Hold thumbnails and module pictures** are rendered from the item and module models in the browser at start-up (`stage.thumbnails()`, `stage.moduleThumbnails()`); no image files are shipped for them.
- **Materials** are generated at start-up: a 512×512 tileable noise/scratch/streak texture drives object-space paint variation, curvature-based edge chipping, grime runs and panel seams (`src/render/materials.js`).
- **Lighting environment** is a small emissive probe scene prefiltered with PMREM, so reflections match the visible light fixtures (`src/render/hangar.js`).
- **Decals and stencils** (hull names, hazard bands, pictograms, floor markings) are drawn into canvas textures.
- **Planet, ring dust and stars** are shaders and instanced geometry (`src/render/sector.js`).
- **Icons and module line drawings** (shown only when there is no 3D view) are inline SVG written for this project.

No bitmap artwork, photographs, texture sets, HDRI or third-party models are used.

**Sound** is synthesised with Web Audio at run time (`src/audio.js`); no audio files are shipped, and nothing plays until sound is switched on in settings.

## Fonts

| Font | Files | Licence |
| --- | --- | --- |
| Tektur 1.005 (static instances at width 75, weights 600 and 700), The Tektur Project Authors, 2023 | `assets/fonts/tektur-600.woff`, `-700.woff` | SIL Open Font License 1.1, text in `assets/fonts/OFL-Tektur.txt` |
| IBM Plex Sans 3.201 (Regular, Medium, SemiBold), IBM Corp., shipped as **Lacuna Text** | `assets/fonts/lacuna-text-400.woff`, `-500.woff`, `-600.woff` | SIL Open Font License 1.1 with Reserved Font Name "Plex", text in `assets/fonts/OFL-IBMPlexSans.txt` |

Both families come from the Google Fonts repository. The files are subsets (Basic Latin, Latin-1, Cyrillic, general punctuation, arrows, a few symbols) converted to WOFF with fontTools; Tektur's static instances were cut from the variable font. Because subsetting modifies IBM Plex Sans and "Plex" is a Reserved Font Name, the modified files carry their own family name, Lacuna Text, as the licence requires. Both families cover Russian and English, so the interface keeps the same typography in either language.

## Code

| Library | Location | Licence |
| --- | --- | --- |
| Three.js 0.180.0 and the example modules used (post-processing, GTAO, bloom, fat lines, geometry utilities) | `vendor/three/` | MIT, `vendor/three/LICENSE` |
