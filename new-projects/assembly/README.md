# Veresta

Sales website of a fictional business-class residential quarter. On the first screen the quarter is built as the visitor scrolls: on a finished embankment site three brick buildings go up part by part, and the scroll moves along the construction schedule below the scene, so each building is finished in its own quarter of the year. Below the first screen is a working sales site: the facts of the quarter, apartment search with floor plans, the buildings, a site plan rendered from above from the same scene, the schedule and progress, a mortgage calculator, the location and the sales office.

The scene is a 3D model rendered as an image sequence. The page draws the frame that matches the scroll position on a canvas.

## Run

Requires Node.js 18 or newer. No dependencies and no build step.

```bash
node serve.mjs
```

Open http://127.0.0.1:4361/projects/assembly/. The server maps `/projects/assembly/` to this folder and `/assets/` to `public/assets/` of the portfolio, the same paths as on the site. Set `PORT` to use another port.

## The first screen

- The hero section is 420 viewport heights tall with a pinned scene inside; scroll progress through it is the position in the sequence.
- The shown frame follows the target with easing, in both directions. With `prefers-reduced-motion` it follows the scroll directly.
- Frames load in a coarse-to-fine order (last and first frame, then every 16th, 8th, 4th, 2nd, the rest), so any scroll position has a near frame early. The nearest loaded frame is drawn until the exact one arrives.
- Until enough frames are in, the last frame is shown as a poster. Then the canvas takes over and, if the page is at the top, rewinds from the finished quarter to the first frame.
- The frame is placed by the box of the quarter inside it: the quarter fills the free area right of the search panel and above the schedule and rests on the schedule. If the heading would reach the tower or the long building, the quarter moves down and gets smaller. The poster and the fallback video take exactly the same place. Phones and portrait screens get the 4:5 set (90 frames) centred under the text.
- The schedule maps the scroll to eight quarters, from Q4 2026 to Q3 2028. Each building has its handover quarter and the share of the scroll at which the frames show it finished (`HOUSES` in `src/data.js`); at that point it is marked as handed over and a label with its price appears on it.
- The labels follow the buildings while the camera moves: the points on the buildings were projected through the camera of the animation for every frame (`src/anchors.js`). Each label takes the side that keeps it clear of the heading, the search panel, the schedule and the other labels.
- If the canvas is unavailable or the frames fail to load, a looping video of the assembly is shown; if that fails too, the poster stays.
- Russian and English switch in place. `?lang=en` or `?lang=ru` in the address sets the language.

## The data

All figures come from `src/data.js`: three buildings, 16 layouts, 126 apartments on sale, prices, the schedule and the mortgage programmes. The layouts are rows of rooms in metres; `src/plan.js` draws them with windows, doors and openings derived from the geometry. Areas in the list are the sums of the rooms, "from" prices are the lowest prices on sale, so the page cannot contradict itself.

## Source

| Path | Role |
| --- | --- |
| `index.html` | Markup with the Russian text: side panel, first screen, sections, site plan overlays and the area map as inline SVG, footer |
| `styles/main.css` | Layout and type: side panel from 1280 px, top bar below, phones and portrait screens |
| `src/main.js` | Entry: tables and cards from the data, site plan, menu, viewing form, language switch |
| `src/scene.js` | Frame loading, scroll to frame mapping, canvas drawing, fallback, schedule, building labels |
| `src/flats.js` | Apartment search: filter shared by the first screen and the section, list, tiles, card of the chosen apartment |
| `src/mortgage.js` | Mortgage and instalment calculator |
| `src/plan.js` | Floor plan drawing from the room rows |
| `src/select.js` | Drop-down list in the style of the site over a hidden native select: combobox and listbox roles, arrows, Home, End, Enter, Escape, first letter |
| `src/data.js` | Buildings, layouts, apartments, schedule, mortgage programmes |
| `src/anchors.js` | Position of each building in every desktop frame |
| `src/i18n.js` | Russian and English texts, number and quarter formats |
| `fonts/` | Jost, Cyrillic and Latin subset with the rouble sign, and its licence |
| `tools/encode-frames.mjs` | Rendered PNG frames to the WebP sets, posters and `frames/manifest.json` |
| `tools/build.mjs` | Copies the page to `public/projects/assembly/` |
| `tools/verify.mjs` | Browser check: overlaps and text over the scene at 1920, 1440, 1366, 1280, 1024 and 390, sections, English, scroll smoothness, fallback, markup against the dictionary |
| `tools/capture.mjs` | Images and the scroll clip that present the work in the portfolio (`public/assets/assembly/case/`) |
| `serve.mjs` | Local preview server |

## Site plan

`public/assets/assembly/site-plan.webp` is the finished quarter rendered straight down with an orthographic camera, 128 m across, in the dusk light of the sequence, with a band on top for the street name. Over it the page lays outlines of the buildings and areas in the same pixel grid: `x = (X + 64) * 15`, `y = 80 + (46.93 - Y) * 15` for scene metres X, Y. The render script is kept outside this repository together with the scene.

## Frames

The frames are rendered outside this repository (Blender 5.2, Cycles) as PNG with a transparent background: 180 frames 1920x1080. `tools/encode-frames.mjs` lays them over the page background colour, sharpens them lightly and writes WebP at quality 86:

```bash
node tools/encode-frames.mjs <desktop png dir> --dw 1920 --dq 86 --mw 720 --mq 86 --mcount 90
```

The phone set (90 frames, 720x900) is cut from the same desktop frames: the camera path is identical, so the 4:5 frame is the part of the 16:9 frame that holds the object, with faded edges and empty background added above and below.

Set `FFMPEG` to the ffmpeg binary if it is not on `PATH`. The sizes in use are recorded in `public/assets/assembly/frames/manifest.json`.

The frame is composed over the page colour, so the frame background matches the page background within one level. Where an edge of the frame lands inside the canvas it fades into the page, because the ground shadow reaches the lower and right edges.

## Weight and checks

Measured on 3 October 2026 with `tools/verify.mjs` (Chromium, local server without compression) and Lighthouse 12.8.

| | Desktop | Phone |
| --- | --- | --- |
| Frames | 180, 1920x1080, WebP 86 | 90, 720x900, WebP 86 |
| Whole set | 18.2 MB | 3.2 MB |
| Loaded before the scene responds to scroll | 25 frames, 2.5 MB | 14 frames, 0.5 MB |
| Lighthouse performance | 99-100 | 87-98, median 91 of five runs |
| Lighthouse accessibility, best practices, SEO | 97, 100, 100 | 100, 100, 100 |
| Largest contentful paint | 0.6-0.8 s | 2.3-3.4 s (simulated slow 4G) |
| Scripted scroll through the hero and back | median 16.7 ms between frames, none over 34 ms | median 16.7 ms, none over 34 ms |

The scroll was also compared with the previous version of the page in the same conditions, three runs each: the share of frames longer than 20 ms is the same within the spread between runs.

`tools/verify.mjs` needs Playwright: install `playwright` in this folder or set `PLAYWRIGHT_CORE` to an existing `playwright-core` directory. It exits with an error if elements of the first screen overlap, the label of the current quarter covers a quarter name or the schedule title anywhere along the scroll, text lies on the rendered quarter, a size overflows horizontally, the console has errors, the page does not return to the top, the fallback video does not play or the Russian markup differs from the dictionary.

## Build

```bash
node tools/build.mjs
```

Copies `index.html`, `metadata.json`, `src/`, `styles/` and `fonts/` to `public/projects/assembly/`. Frames, posters, videos and block images live in `public/assets/assembly/` and are not touched by the build.

Credits for fonts, textures, skies and plant models are in `ASSETS.md`.
