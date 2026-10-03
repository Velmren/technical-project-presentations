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
| `src/components/video/strings.ts` | interface texts in Russian and English |
| `src/app/video/`, `src/app/en/video/` | the routes |
| `public/assets/video/<slug>/` | files of a clip |
| `scripts/prepare-videos.mjs` | makes those files from a master |
| `tests/videos.test.ts` | data, schema, row layout, filter |

## Turning the pages on

Until the gallery is released the two route folders are named `src/app/_video/` and `src/app/en/_video/`: a folder that starts with an underscore is not a route, so the site builds without these pages. Renaming both to `video` turns them on.

## Adding a clip

One record and its files.

1. Make the files from the master. For a clip with a Russian and an English version:

   ```bash
   node scripts/prepare-videos.mjs my-clip --src /path/to/master-ru.mp4 --lang ru --poster 12.5 --hover 20,4
   node scripts/prepare-videos.mjs my-clip --src /path/to/master-en.mp4 --lang en --poster 12.5
   ```

   A clip without words has one file for both languages: leave `--lang` out. `--poster` is a second of the clip or a picture file; `--hover` is where the silent fragment starts and how long it is. A second frame format of the same clip is another run with `--name 1x1`. ffmpeg with libx264 and libwebp comes from the `FFMPEG` variable or from `PATH`.

   The script writes `public/assets/video/my-clip/` and prints the values for the record: size, length, file addresses and whether the poster is light in its lower left corner (`lightPoster`: the start button there turns dark).

   A master at or under 6 Mbit/s is only repacked for a fast start; a heavier one is encoded again (H.264 High, CRF 21, capped at 6 Mbit/s, a key frame every two seconds).

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
         "share": { "ru": "/assets/video/my-clip/my-clip-share-ru.jpg", "en": "/assets/video/my-clip/my-clip-share-en.jpg" },
         "preview": "/assets/video/my-clip/my-clip-hover.mp4"
       }
     ]
   }
   ```

   - `status`: `accepted` gives the clip its pages; `rework` keeps it in the data without pages.
   - `sections`: `promo`, `games`, `motion`, `3d`, `editing`. The first one is the home of the clip, a second one only makes the filter find it. A vertical clip also goes to the strip of vertical clips by itself.
   - `featured`: place among the best, 1 first. Clips without it follow from new to old.
   - `sound`: who made the sound and the music. A licensed track is named here with its licence, `soundLink` leads to its page. A silent clip has no `sound`.
   - `work`: the page of the work the clip belongs to, if there is one.
   - `cuts`: frame formats of the clip. The first one is shown in the gallery; the page offers a switch when there are two. `captions: { "ru": "….vtt", "en": "….vtt" }` adds subtitles.
   - `en` may be left out of `src`, `poster` and `share`: the English page then uses the Russian file.

3. Check and build:

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

## Films are not in Git

`public/assets/video/.gitignore` keeps `*.mp4` out of the repository. Posters, link previews and subtitles are committed. Before a release build the films must be in `public/assets/video/<slug>/` on the build machine: `node scripts/prepare-videos.mjs --check` lists what the accepted clips need and fails when a file is missing.

## Moving the films to their own storage

`mediaBase` in `videos.json` is where the films are served from. Empty means the site itself. To move them, upload `assets/video/**/*.mp4` to the storage under the same paths and set one line:

```json
"mediaBase": "https://media.example.com"
```

Every `src` and `preview` is then read from there, and `--check` asks the storage for them instead of looking in `public/`. Posters, link previews and subtitles stay on the site.

## Posters on other pages

A block that leads into the gallery, for example on the home page, takes ready posters with the fragment on hover:

```tsx
import { bestClips } from '@/components/video/clips';
import { TileRow } from '@/components/video/Gallery';
import '@/components/video/video.css';

<TileRow clips={bestClips(locale, 2)}/>
```

`bestClips(locale, count)` returns the first clips in show order; each has `href`, `title`, `kind`, `length`, `poster` and `preview`, so a block with its own layout can use the data without the row. The posters expect the `.cc-page` tokens of the site around them.

## Addresses with parameters

- `/video/<slug>/?t=75` or `?t=1:15` opens the clip paused at that moment; `?f=1x1` opens its square cut.
- `/video/?s=promo` opens the gallery on a section (`promo`, `games`, `motion`, `3d`, `editing`, `vertical`).
- `/video/c/<slug>/?v=<clip>` opens a collection on one of its clips.

## Review builds

Two variables change what is built; a release sets neither.

- `VIDEO_EXTRA=/path/to/extra.json`: more clips and collections of the same shape, for looking at clips that are not accepted yet without putting them into the site data.
- `VIDEO_REWORK=1`: clips with `status: "rework"` get pages too.
