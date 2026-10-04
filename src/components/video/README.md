# Video gallery

The gallery at `/video/`, a page for every clip at `/video/<slug>/`, collections at `/video/c/<slug>/`, each also under `/en/`. One player for the whole site.

## Where things are

| Path | What it is |
|---|---|
| `src/content/videos.json` | all the data: clips, collections, where the films are served from |
| `src/lib/videos.ts` | schema of that file, show order, addresses, one clip in one language |
| `src/components/video/Player.tsx`, `player.css` | the player |
| `src/components/video/pages.tsx` | what the routes render: gallery, clip page, collection, their metadata |
| `src/components/video/Gallery.tsx`, `Tile.tsx`, `gallery-view.ts` | rows of posters, the filter, the fragment on hover |
| `src/components/video/Watch.tsx`, `Playlist.tsx` | the clip page and the collection page |
| `src/components/video/clips.ts` | the clips in show order as posters; `bestClips()` gives the best ones to other pages |
| `src/components/video/Entry.tsx` | `VideoEntry`, the block that leads into the gallery from the home page |
| `src/components/video/strings.ts` | interface texts in Russian and English |
| `src/app/video/`, `src/app/en/video/` | the routes |
| `public/assets/video/<slug>/` | files of a clip |
| `scripts/prepare-videos.mjs` | makes those files from a master |
| `tests/videos.test.ts` | data, schema, row layout, filter |

## Turning the pages off and on

The routes are the folders `src/app/video/` and `src/app/en/video/`. To build the site without the gallery, rename both to `_video`: a folder that starts with an underscore is not a route. `scripts/package-release.mjs` then also leaves `public/assets/video` out of the release. Renaming them back turns the pages on.

## Adding a clip

One record and its files.

1. Make the files from the master. For a clip with a Russian and an English version:

   ```bash
   node scripts/prepare-videos.mjs my-clip --src /path/to/master-ru.mp4 --lang ru --poster 12.5 --hover 20,4
   node scripts/prepare-videos.mjs my-clip --src /path/to/master-en.mp4 --lang en --poster 12.5 --hover 20,4
   ```

   A clip without words has one file for both languages: leave `--lang` out. `--poster` is a second of the clip or a picture file; `--hover` is where the silent fragment starts and how long it is. A second frame format of the same clip is another run with `--name 1x1`. ffmpeg with libx264 and libwebp comes from the `FFMPEG` variable or from `PATH`.

   The fragment is played on the poster in the gallery, so words in it must be in the language of the page. When the fragment shows words (titles, an interface), make it for each language: the English run writes `my-clip-hover-en.mp4`. When it shows none, one fragment serves both: leave `--hover` out of the English run.

   Without `--src` the film already in the folder is kept and only the poster or the fragment asked for is made from it: `node scripts/prepare-videos.mjs my-clip --lang en --hover 20,4` adds an English fragment to a clip prepared earlier.

   The script writes `public/assets/video/my-clip/` and prints the values for the record: size, length, file addresses and whether the poster is light in its lower left corner (`lightPoster`: the start button there turns dark).

   A master at or under 6 Mbit/s is only repacked for a fast start; a heavier one is encoded again (H.264 High, CRF 18 with more bits for dark areas, capped at 6 Mbit/s, a key frame every two seconds).

2. Add the record to `videos` in `src/content/videos.json`:

   ```json
   {
     "slug": "my-clip",
     "status": "accepted",
     "title": { "ru": "Название", "en": "Title" },
     "kind": { "ru": "Промо игры", "en": "Game promo" },
     "text": { "ru": "Одна-две строки о ролике.", "en": "A line or two about the clip." },
     "sections": ["games", "promo"],
     "date": "2026-10-03",
     "featured": 2,
     "sound": { "ru": "Velmren", "en": "Velmren" },
     "work": { "ru": "/mobile-game/", "en": "/en/mobile-game/" },
     "cuts": [
       {
         "width": 1920, "height": 1080, "duration": 62,
         "src": { "ru": "/assets/video/my-clip/my-clip-ru.mp4", "en": "/assets/video/my-clip/my-clip-en.mp4" },
         "poster": { "ru": "/assets/video/my-clip/my-clip-poster-ru.webp", "en": "/assets/video/my-clip/my-clip-poster-en.webp" },
         "posterWidths": [480, 720, 960, 1280, 1920],
         "share": { "ru": "/assets/video/my-clip/my-clip-share-ru.jpg", "en": "/assets/video/my-clip/my-clip-share-en.jpg" },
         "preview": { "ru": "/assets/video/my-clip/my-clip-hover.mp4", "en": "/assets/video/my-clip/my-clip-hover-en.mp4" }
       }
     ]
   }
   ```

   - `status`: `accepted` gives the clip its pages; `rework` keeps it in the data without pages.
   - `sections`: `promo`, `games`, `motion`, `3d`, `editing`. The first one is the home of the clip, a second one only makes the filter find it. A vertical clip also goes to the strip of vertical clips by itself. Every poster in that strip stands in one 9:16 frame, so a vertical clip of another shape (3:5, 4:5) is trimmed a little at its sides there; its own page shows the whole frame.
   - `featured`: place among the best, 1 first. Clips without it follow from new to old.
   - `sound`: who made the sound and the music. A licensed track is named here with its licence, `soundLink` leads to its page. A silent clip has no `sound`.
   - `work`: the page of the work the clip belongs to, if there is one.
   - `cuts`: frame formats of the clip. The first one is shown in the gallery; the page offers a switch when there are two. `captions: { "ru": "….vtt", "en": "….vtt" }` adds subtitles.
   - `preview`: the fragment for hover. A pair of files when it shows words, or one address for both languages when it shows none: `"preview": "/assets/video/my-clip/my-clip-hover.mp4"`.
   - `posterWidths` is written by step 3; leave it out of a new record.
   - `en` may be left out of `src`, `poster` and `share`: the English page then uses the Russian file.

3. Make the reduced posters for the gallery:

   ```bash
   node scripts/prepare-videos.mjs --tiles
   ```

   It makes the copies that are missing and writes `posterWidths` into the record (see "Posters in the gallery" below). ffmpeg needs libaom-av1 for this step.

4. Check and build:

   ```bash
   node --experimental-strip-types --test tests/videos.test.ts
   node scripts/prepare-videos.mjs --check
   npm run build
   ```

## Adding a collection

One record in `collections`, three to six clips in the order they should play:

```json
{ "slug": "for-a-game-studio", "title": { "ru": "Для игровой студии", "en": "For a game studio" },
  "text": { "ru": "Одна строка для заказчика.", "en": "A line for the client." },
  "clips": ["lumi-promo", "showreel", "cell"] }
```

Its address is `/video/c/for-a-game-studio/`. A collection opens only by its link: it is not listed in the gallery and asks search engines not to index it. It is published once every clip in it is accepted.

## Posters in the gallery

A poster is made at the size of the film and is shown so on the page of the clip and in the link preview. In the gallery, in the block on the home page and in the row of next clips it is drawn far smaller, so there the browser gets a reduced AVIF copy of it: `my-clip-poster-ru-720.avif` next to `my-clip-poster-ru.webp`. The widths are 480, 720, 960 and 1280 for a wide or square poster, 360, 540 and 720 for a vertical one, and the full width for large and dense screens. `posterWidths` in the first cut of the record lists them; a browser without AVIF shows the poster itself.

A copy must not look softer than the poster does at the same place. Each one takes the lightest quality level at which it cannot be told from the poster reduced without loss (SSIM 0.99 or more). A frame that does not get there, one full of fine detail or grain, takes the best level that keeps it within its weight allowance (1.22 bits per pixel, more per pixel for a copy smaller than 960x540) and under 60% of the weight of the poster. Colour is stored at full resolution: a copy is drawn close to its own size, where halved colour shows as soft edges.

`node scripts/prepare-videos.mjs --tiles` makes the copies for the first cut of every clip, the one the gallery shows, and keeps those already in place. `--tiles my-clip` makes the copies of that clip again. A poster made again with `--poster` renews its copies by itself. `--check` fails when an accepted clip has no copies.

Which copy is taken depends on how wide the poster is drawn: `rowTileSizes()` and `stripTileSizes()` in `gallery-view.ts` give the browser that width and repeat the layout rules of `video.css` (the page gutter, the gap between posters, the columns of the vertical strip). When those rules change, change both.

The posters of the first row of the gallery are the largest pictures of its first screen: they load at once and at high priority, everything below loads as it comes near the screen. The block on the home page loads its posters late and at low priority.

## Films are not in Git

`public/assets/video/.gitignore` keeps `*.mp4` out of the repository. Posters with their reduced copies, link previews and subtitles are committed. Before a release build the films must be in `public/assets/video/<slug>/` on the build machine: `node scripts/prepare-videos.mjs --check` lists what the accepted clips need and fails when a file is missing.

## Moving the films to their own storage

`mediaBase` in `videos.json` is where the films are served from. Empty means the site itself. To move them, upload `assets/video/**/*.mp4` to the storage under the same paths and set one line:

```json
"mediaBase": "https://media.example.com"
```

Every `src` and `preview` is then read from there, and `--check` asks the storage for them instead of looking in `public/`. Posters, link previews and subtitles stay on the site.

## The way in from other pages

`VideoEntry` is a ready block for the home page: the heading "Video" with the number of clips, a link to the gallery and the best clips as large posters with the fragment on hover.

```tsx
import { VideoEntry } from '@/components/video/Entry';

<VideoEntry locale={locale}/>           // two best clips
<VideoEntry locale={locale} count={3}/>
```

It reads the gallery data, so it is rendered on the server. A client component takes it as a ready node from its server parent, for example `<ConceptC video={<VideoEntry locale={locale}/>}/>`. It expects the `.cc-page` tokens and the site fonts around it.

A block with its own layout can take just the data: `bestClips(locale, count)` from `clips.ts` returns the first clips in show order with `href`, `title`, `kind`, `length`, `poster`, `posterSet` and `preview`, and `TileRow` from `Gallery.tsx` draws a row of them. Under the first screen of a page give it `priority="low"`.

## Addresses with parameters

- `/video/<slug>/?t=75` or `?t=1:15` opens the clip paused at that moment; `?f=1x1` opens its square cut.
- `/video/?s=promo` opens the gallery on a section (`promo`, `games`, `motion`, `3d`, `editing`, `vertical`).
- `/video/c/<slug>/?v=<clip>` opens a collection on one of its clips.

## Review builds

Two variables change what is built; a release sets neither.

- `VIDEO_EXTRA=/path/to/extra.json`: more clips and collections of the same shape, for looking at clips that are not accepted yet without putting them into the site data.
- `VIDEO_REWORK=1`: clips with `status: "rework"` get pages too.
