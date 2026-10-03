# Project structure

VELMREN portfolio: Next.js 16 (App Router), TypeScript, static export to `out/`. Generated and local folders (`node_modules/`, `.next/`, `out/`, `output/`, `.playwright-cli/`) are not listed.

```
.
├── README.md                  what the site is, projects, commands, credits
├── PROJECT_STRUCTURE.md       this map
├── package.json               scripts: dev, build, test, typecheck, package:release
├── next.config.ts             static export, trailing slashes, unoptimised images
├── tsconfig.json              TypeScript settings, @/* alias for src/*
├── src/
│   ├── app/
│   │   ├── layout.tsx         root layout: Golos Text, metadata and social preview, frame of the classic case pages
│   │   ├── page.tsx           home page in Russian
│   │   ├── [slug]/page.tsx    case page built from src/content/projects/<slug>.json (classic or case layout)
│   │   ├── en/                English home page (/en/) and case pages (/en/<slug>/)
│   │   ├── video/, en/video/  the video gallery, clip pages and collections in Russian and English
│   │   ├── concepts/          styles of the current design: concepts.css (live previews), c/concept-c.css (home, header,
│   │   │                      footer, buttons), c/case.css (case pages); c/page.tsx redirects the old prototype URL to /
│   │   ├── globals.css, editorial.css  styles of the classic case layout
│   │   ├── not-found.tsx      404 page
│   │   └── robots.ts, sitemap.ts
│   ├── components/
│   │   ├── Sections.tsx, ProjectMedia.tsx, Icon.tsx, VideoPlayer.tsx  sections and media of the classic case layout
│   │   ├── SiteFrame.tsx      header and footer of the classic case layout
│   │   ├── video/             the site player, gallery, clip and collection pages, the block for the home page, interface
│   │   │                      texts, README with how to add a clip
│   │   └── concepts/          home page (ConceptC, ConceptCView), live work previews, header and footer (Chrome),
│   │                          language switch, case page (CasePage) with scroll depth (Depth), looping clips (LoopVideo),
│   │                          redirects from old URLs (Redirect)
│   ├── content/
│   │   ├── home.json          works on the home page: status, placement, texts, previews, facts, links
│   │   ├── videos.json        video gallery data: clips, collections, where the films are served from
│   │   └── projects/*.json    case page data, one file per slug
│   └── lib/
│       ├── schema.ts          Zod schema of case pages
│       ├── projects.ts        reads and validates src/content/projects/
│       ├── home.ts            Zod schema of home page data
│       ├── home-view.ts       which works are shown and how they are filtered, without the validator
│       ├── videos.ts          Zod schema of the gallery data and helpers
│       ├── catalog.ts         filters for case page data (covered by tests)
│       ├── i18n.ts            Russian and English: interface strings, translated works and pages, first-visit language
│       ├── social.ts          social preview images
│       ├── color.ts           main button colour of a case page and its text contrast
│       ├── fonts-c.ts         display fonts (Tektur, Sofia Sans Condensed)
│       └── concepts/          WebGL mosaic of the home page hero
├── public/
│   ├── assets/
│   │   ├── home/              home page previews, work screens for the mosaic and their outline maps
│   │   ├── forma/, godot/, encounter/, java/, dev-utilities/, electronics-store/, orbit/, sono/, khrum/, lacuna/, lumi/,
│   │   │   falz/, shopify/, motion/, assembly/, tilda-interior/, tilda-webinar/, tilda-tour/, tilda-dental/, studio-concepts/
│   │   │                      screenshots, videos and downloads of each work
│   │   │                      godot/web/: Category Spark browser build, not in Git, built by a script
│   │   │                      java/: Encounter State plugin JAR, source ZIP, source viewer and its manifest
│   │   ├── video/             posters and link previews of the gallery clips; the films are not in Git
│   │   └── brands/            Godot logo, its licence and credit page
│   ├── projects/              static builds of individual works, served under /projects/<name>/
│   │   ├── admin-dashboard/   ORBIT, store operations panel
│   │   ├── assembly/          Veresta, a residential quarter that assembles as you scroll
│   │   ├── dev-utilities/     Dev Utilities, developer tools
│   │   ├── electronics/       SONO, speaker landing page
│   │   ├── game-concept/      LACUNA, game interface concept
│   │   ├── khrum/             Khrum, a boar character on an SVG rig, and his site (built from a separate repository)
│   │   ├── mobile-game/       Lumi, playable web build (source kept in a separate private repository)
│   │   ├── motion/            motion section: live Lottie and Canvas examples
│   │   ├── shopify/           Sheaf, static demo of the Shopify product configurator
│   │   └── npc-system/        North Harbor, Minecraft NPC scenario
│   └── favicon-v2.svg, favicon-v2.ico, apple-touch-icon-v2.png  site icons (the head links these names); favicon.svg, favicon.ico same icons at the default paths; og.png
├── new-projects/              sources of individual works; each has its own README
│   ├── admin-dashboard/       ORBIT: React, Vite
│   ├── assembly/              Veresta: scroll-driven image sequence on a canvas, no dependencies
│   ├── dev-utilities/         Dev Utilities: React, esbuild
│   ├── electronics/           SONO: React, Vite
│   ├── electronics-store/     VELMREN tech: Next.js, PostgreSQL, MinIO (server app, deployed separately)
│   ├── game-concept/          LACUNA: three.js
│   ├── minecraft-npc-system/  Minecraft NPC System: Bukkit/Spigot plugin with the Tidehaven demo world
│   └── npc-system/            North Harbor: NPC scenario plugin and web page
├── demos/forma/               FORMA catalogue build, copied to /forma/live/ on export
├── scripts/
│   ├── prepare-export.mjs     post-processes out/: FORMA build, draft media, Windows segment file names
│   ├── package-release.mjs    packs a release with a SHA-256 manifest; leaves public/assets/video out while the gallery
│   │                          routes are private (src/app/_video)
│   ├── deploy-release.sh      installs a release on the server
│   ├── portfolio.caddy        Caddy site config for velmren.com: compression, wasm type, cache headers, 404
│   ├── prepare-encounter-viewer.mjs  embeds the Encounter State source files in the source viewer
│   ├── prepare-videos.mjs     prepares web video, poster, link preview and hover fragment of a clip; --check verifies
│   │                          the files before a release
│   └── build-category-spark-web.mjs  builds the Category Spark browser version from its source ZIP (GODOT=<path to Godot 4.7.2>)
├── tests/
│   ├── model.test.ts          case page data and catalogue filters
│   ├── home.test.ts           home page data: statuses, "other projects" threshold, filters
│   ├── i18n.test.ts           completeness of English texts
│   └── videos.test.ts         gallery data, schema, row layout and filter
└── docs/
    └── THIRD-PARTY.md         third-party assets, fonts and licences
```
