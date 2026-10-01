# Project structure

Dev Utilities: a static React/TypeScript app with four local tools (JSON, Colors, Hash, Base64). Generated folders (`node_modules/`, `dist/`, `artifacts/`) are not listed and are ignored by Git.

```
dev-utilities/
├── build.mjs              esbuild bundle into dist/; --portfolio copies dist/ to ../../public/projects/dev-utilities/
├── serve.mjs              local static server for dist/ on 127.0.0.1:4315
├── package.json           scripts: dev, build, check, test, test:browser, test:extra, screenshots, export:portfolio
├── tsconfig.json          strict TypeScript settings (type check only, no emit)
├── metadata.json          portfolio card data read by the main site
├── thumbnail.png          portfolio card image, captured from the real interface
├── README.md              what the app does, how to run and verify it, limits
├── src/
│   ├── index.html         page shell; sets theme and language before first paint
│   ├── app.tsx            frame: tool tabs, theme, language, About dialog, toasts
│   ├── theme.css          fonts (IBM Plex Sans/Mono, Latin and Cyrillic) and light/dark design tokens
│   ├── fonts/             OFL licence texts for IBM Plex Sans and Mono, copied to dist/fonts/ by build.mjs
│   ├── shell.css          frame and shared controls: buttons, inputs, menus, split panes, tool bar, status bar
│   ├── prefs.ts           storage prefix, interface preferences (language, theme, pane sizes), v2 consent migration
│   ├── shared.tsx         clipboard, downloads, opt-in session state
│   ├── CodeEditor.tsx     CodeMirror 6 JSON editor with themed tokens, diagnostics and Russian phrases
│   ├── i18n/              translations and formatting
│   │   ├── index.tsx      provider, translate(), plural rules, number and byte formatting
│   │   ├── en.ts          English messages (source of the message shape)
│   │   └── ru.ts          Russian messages
│   ├── ui/                reusable interface parts
│   │   ├── SplitPane.tsx  resizable panes (pointer and keyboard), one pane at a time on narrow screens
│   │   ├── Menu.tsx       accessible dropdown menu (actions or radio choices)
│   │   ├── Select.tsx     select-only combobox used for every choice list: keyboard, type-ahead, viewport-aware list
│   │   ├── ToolBoundary.tsx  keeps a failing tool from blanking the app; retry or reset its saved draft
│   │   ├── useNarrow.ts   narrow-screen breakpoint hook shared by the tools
│   │   └── useWindow.ts   windowed (virtualized) rendering for long lists
│   ├── json/              JSON tool interface
│   │   ├── JsonWorkspace.tsx  modes (inspect, convert, compare, patch, schema), worker jobs, layout, status bar
│   │   ├── TreeView.tsx       virtualized tree with keyboard navigation
│   │   ├── QueryPanel.tsx     live JSONPath query, results table, syntax guide
│   │   ├── ValueDetail.tsx    selected value: pointer breadcrumb, type, size, copy and export
│   │   ├── describe.ts        turns coded worker errors into interface text
│   │   ├── samples.ts         synthetic example documents and query examples
│   │   └── json.css           JSON tool styles
│   ├── color/             Colors tool: ColorWorkspace.tsx (editor, palette, export, contrast), perceptual.ts (OKLCH/OKLab, gamut, scales, vision simulation), errors.ts, color.css
│   ├── hash/              Hash tool: HashWorkspace.tsx (text, file queue, HMAC, list check), checksum.ts (verification, sha256sum and BSD lists, report), hash.css
│   ├── base64/            Base64 tool: Base64Workspace.tsx (codec and JWT modes), Views.tsx (hex and JWT views), inspect.ts (signatures, hex rows, JWT), errors.ts, base64.css
│   ├── json-core.ts       exact JSON analysis, formatting, pointer lookup, diff with JSON Patch, Ajv schema validation
│   ├── json-query.ts      RFC 9535 JSONPath via json-p3, mapped back to exact source tokens
│   ├── json-convert.ts    exact value tree: YAML, CSV, TypeScript, JSON Schema inference, RFC 6902 patch
│   ├── json-p3.d.ts       type declarations for json-p3 (the package ships none)
│   ├── json-worker.ts     background worker for JSON operations
│   ├── color-utils.ts     color parsing, conversion, compositing, contrast, harmonies, exports
│   ├── hash-worker.ts     streaming hashing and HMAC with hash-wasm
│   ├── base64-worker.ts   strict Base64 codec, Data URI parsing, safe previews
│   ├── favicon.svg        app icon
│   └── *.test.mjs         unit tests for color-utils and the Base64 worker
└── tests/
    ├── json.test.mjs      JSON core checks (exact numbers, pointers, diff, schema)
    ├── query.test.mjs     JSONPath checks (RFC 9535 semantics, exact values, escaping, own properties, limits)
    ├── cts.test.mjs       official JSONPath compliance suite through the app's query pipeline
    ├── convert.test.mjs   conversions and JSON Patch on exact values
    ├── perceptual.test.mjs OKLCH/OKLab round trips, gamut, scales, vision simulation
    ├── inspect.test.mjs   file signatures, hex rows, JWT decoding
    ├── fixtures/          jsonpath-cts/: pinned cts.json with its licence and source note
    ├── hash.test.mjs      hash and HMAC vectors, checksum lists, queue behaviour
    ├── browser.mjs        main Chrome/Playwright scenarios
    ├── edges.mjs          extra browser regressions (cancellation, storage recovery, Russian locale)
    ├── contrast.mjs       WCAG 2 contrast of interface token pairs in both themes
    └── capture.mjs        screenshots of real states for review
```
