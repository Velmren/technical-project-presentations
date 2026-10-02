# Project structure

Veresta: a scroll-driven first screen of a fictional residential quarter. Vanilla ES modules, no dependencies.

```
assembly/
├── README.md              what it is, how to run, how the first screen works
├── PROJECT_STRUCTURE.md   this map
├── ASSETS.md              fonts, textures, skies and plant models with licences
├── index.html             page markup with the Russian text
├── metadata.json          title, languages, runtime, entry
├── package.json           scripts: start, build, fonts, frames
├── serve.mjs              local preview on the site's paths
├── styles/
│   └── main.css           layout and type, desktop and phone
├── src/
│   ├── main.js            frame loading, scroll mapping, canvas drawing, fallback, form
│   └── i18n.js            Russian and English texts, language choice
├── fonts/                 Onest and Noto Serif Display subsets (woff2) and their OFL texts
└── tools/
    ├── encode-frames.mjs  PNG frames to WebP sets, posters and the frame manifest
    ├── fetch-fonts.mjs    downloads the font subsets
    ├── build.mjs          copies the page to public/projects/assembly/
    ├── verify.mjs         browser check: screenshots, scroll smoothness, weight, fallback
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
├── home-*.webp, quay.webp     images of the content blocks
└── case/                      screens, details and the scroll clip for the portfolio card and case page
```
