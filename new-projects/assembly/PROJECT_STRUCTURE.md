# Project structure

Veresta: sales website of a fictional residential quarter with a scroll-driven 3D first screen. Vanilla ES modules, no dependencies.

```
assembly/
├── README.md              what it is, how to run, how the first screen and the data work
├── PROJECT_STRUCTURE.md   this map
├── ASSETS.md              fonts, textures, skies and plant models with licences
├── index.html             page markup with the Russian text, site plan and area map as inline SVG
├── metadata.json          title, languages, runtime, entry
├── package.json           scripts: start, build, frames, verify, capture
├── serve.mjs              local preview on the site's paths
├── styles/
│   └── main.css           layout and type: side panel, top bar, phones
├── src/
│   ├── main.js            entry: tables and cards from the data, site plan, menu, form, language
│   ├── scene.js           frames on the canvas, scroll mapping, fallback, schedule, building labels
│   ├── flats.js           apartment search, list, tiles, card of the chosen apartment
│   ├── mortgage.js        mortgage and instalment calculator
│   ├── plan.js            floor plan drawing from room rows
│   ├── select.js          drop-down list in the style of the site
│   ├── data.js            buildings, layouts, apartments, schedule, mortgage programmes
│   ├── anchors.js         position of each building in every desktop frame
│   └── i18n.js            Russian and English texts, number and quarter formats
├── fonts/                 Jost subset (woff2) and its OFL text
└── tools/
    ├── encode-frames.mjs  PNG frames to WebP sets, posters and the frame manifest
    ├── build.mjs          copies the page to public/projects/assembly/
    ├── verify.mjs         browser check: overlaps, text over the scene, sizes, smoothness, fallback, texts
    └── capture.mjs        images and the scroll clip for the portfolio card and case page
```

Produced elsewhere in the portfolio:

```
public/projects/assembly/      built page (copy of index.html, src, styles, fonts)
public/assets/assembly/
├── frames/desktop/NNN.webp    180 frames, 16:9
├── frames/mobile/NNN.webp     90 frames, 4:5, cut from the desktop frames
├── frames/manifest.json       frame counts and sizes read by the page
├── poster-desktop.webp, poster-mobile.webp   last frame of each set
├── assembly.mp4, assembly-mobile.mp4         fallback videos
├── home-*.webp, quay.webp     renders of the buildings and the embankment for the sections
├── progress-2026-10.webp      the first frame cut to the site, for the progress section
├── site-plan.webp             the finished quarter rendered from above, for the site plan
└── case/                      screens, details and the scroll clip for the portfolio card and case page
```
