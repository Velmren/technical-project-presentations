# Veresta

First screen of a fictional residential quarter that assembles as the visitor scrolls. On a finished embankment site three buildings go up part by part: frame and cores, floor slabs, facade sections, glazing, roofs and the tower crown. Each building lights its windows floor by floor once its facade is closed. Below it are ordinary content blocks, so the handover from the pinned scene to the page is visible.

The scene is a 3D model rendered as an image sequence. The page draws the frame that matches the scroll position on a canvas.

## Run

Requires Node.js 18 or newer. No dependencies and no build step.

```bash
node serve.mjs
```

Open http://127.0.0.1:4361/projects/assembly/. The server maps `/projects/assembly/` to this folder and `/assets/` to `public/assets/` of the portfolio, the same paths as on the site. Set `PORT` to use another port.

## How the first screen works

- The hero section is 420 viewport heights tall with a pinned scene inside; scroll progress through it is the position in the sequence.
- The shown frame follows the target with easing, in both directions. With `prefers-reduced-motion` it follows the scroll directly.
- Frames load in a coarse-to-fine order (last and first frame, then every 16th, 8th, 4th, 2nd, the rest), so any scroll position has a near frame early. The nearest loaded frame is drawn until the exact one arrives.
- Until enough frames are in, the last frame is shown as a poster and the progress line reports loading. Then the canvas takes over and, if the page is at the top, rewinds from the finished quarter to the first frame.
- Screens of 16:9 and wider get the 16:9 set (180 frames) drawn to cover the screen, with the object kept in view. On taller landscape screens (16:10, 4:3) the frame takes the full width and rests on the bottom, so the object stays clear of the text. Phones and portrait screens get a lighter 4:5 set (90 frames) with the object centred under the text.
- If the canvas is unavailable or the frames fail to load, a looping video of the assembly is shown; if that fails too, the poster stays.
- Russian and English switch in place. `?lang=en` or `?lang=ru` in the address sets the language.

## Source

| Path | Role |
| --- | --- |
| `index.html` | Markup: header, pinned hero, content blocks, form, footer. Russian text is in the markup |
| `styles/main.css` | Layout and type for desktop and phone |
| `src/main.js` | Frame loading, scroll to frame mapping, canvas drawing, fallback, stage label, form |
| `src/i18n.js` | Russian and English texts, language choice |
| `fonts/` | Onest and Noto Serif Display, Cyrillic and Latin subsets, with licence texts |
| `tools/encode-frames.mjs` | Rendered PNG frames to the WebP sets, posters and `frames/manifest.json` |
| `tools/fetch-fonts.mjs` | Downloads the font subsets |
| `tools/build.mjs` | Copies the page to `public/projects/assembly/` |
| `tools/verify.mjs` | Browser check: screenshots at 1920, 1440, 1280, 1024 and 390, scroll smoothness, transferred weight, fallback |
| `tools/capture.mjs` | Images and the scroll clip that present the work in the portfolio (`public/assets/assembly/case/`) |
| `serve.mjs` | Local preview server |

## Frames

The frames are rendered outside this repository (Blender 5.2, Cycles) as PNG with a transparent background: 180 frames 1920x1080. `tools/encode-frames.mjs` lays them over the page background colour, sharpens them lightly and writes WebP at quality 86:

```bash
node tools/encode-frames.mjs <desktop png dir> --dw 1920 --dq 86 --mw 720 --mq 86 --mcount 90
```

The phone set (90 frames, 720x900) is cut from the same desktop frames instead of being rendered separately: the camera path is identical, so the 4:5 frame is the part of the 16:9 frame that holds the object, with faded edges and empty background added above and below. This saved a second render and keeps a higher pixel density than a separate 864x1080 render would.

Set `FFMPEG` to the ffmpeg binary if it is not on `PATH`. The script prints the total weight of each set; the sizes in use are recorded in `public/assets/assembly/frames/manifest.json`.

The frame is composed over the page colour in RGB and converted to WebP's YUV in one explicit step, so the frame background matches the page background within one level and no edge shows where the frame ends.

## Weight and checks

Measured on 3 October 2026 with `tools/verify.mjs` (Chromium, local server without compression) and Lighthouse 12.8.

| | Desktop | Phone |
| --- | --- | --- |
| Frames | 180, 1920x1080, WebP 86 | 90, 720x900, WebP 86 |
| Whole set | 18.2 MB | 3.2 MB |
| Loaded before the scene responds to scroll | 25 frames, 2.5 MB | 14 frames, 0.5 MB |
| Poster (first paint) | 132 KB | 45 KB |
| Lighthouse performance | 100 | 92 |
| Largest contentful paint | 0.8 s | 3.2 s (simulated slow 4G) |
| Scripted scroll through the hero and back | median 16.7 ms between frames, none over 34 ms | median 16.7 ms, none over 34 ms |

The page, styles, scripts and fonts weigh 0.25 MB. The desktop set is heavier than a typical 8-10 MB budget on purpose: at lower quality the brick and foliage turn soft. The frames load after the page itself, so the weight does not delay the first screen.

`tools/verify.mjs` needs Playwright: install `playwright` in this folder or set `PLAYWRIGHT_CORE` to an existing `playwright-core` directory. It exits with an error if a size overflows horizontally, the console has errors, the page does not return to the top or the fallback video does not play.

## Build

```bash
node tools/build.mjs
```

Copies `index.html`, `metadata.json`, `src/`, `styles/` and `fonts/` to `public/projects/assembly/`. Frames, posters, videos and block images live in `public/assets/assembly/` and are not touched by the build.

Credits for fonts, textures, skies and plant models are in `ASSETS.md`.
