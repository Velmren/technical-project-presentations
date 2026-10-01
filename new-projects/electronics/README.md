# SONO

Bilingual landing page for a wireless speaker concept, built with React 19, TypeScript and Vite. Plain CSS, Lucide icons.

Live version: https://velmren.com/projects/electronics/

SONO is fictional. Products, prices and specifications are design targets; no manufactured product or measured audio performance is claimed.

## Running

From this directory, with Node.js and npm:

```sh
npm ci
npm run dev        # Vite dev server on 127.0.0.1
npm run build      # type check, then build into ../../public/projects/electronics/
npm run preview    # serves the build on http://127.0.0.1:5196/projects/electronics/
```

`PORT` changes the preview port. The build uses relative asset paths, so the output folder can be served from `/projects/electronics/` on any static host.

## What it does

- Two models, SONO One and One Plus, with a specification comparison and usage notes.
- Cobalt, Chalk and Graphite finishes, quantity 1 to 4 and a live total in EUR.
- A bag with an empty state, merging of identical variants, quantity changes, removal, clear and subtotal. The bag is a native dialog with focus containment, Escape and focus return.
- An enquiry form that validates name and email, moves focus to a linked error summary and shows the prepared enquiry. Nothing is sent, and there is no checkout, payment, stock or delivery logic.
- Russian and English for all text, units, prices, labels, validation messages and image alternatives, including the document language, title and description. The language menu in the header and the bag supports arrow keys, Home and End, Enter and Space, Tab, Escape and outside clicks.
- Switching language keeps the configuration, bag, comparison, typed form data and validation state.

The language is stored under `sono.language.v1` and the configuration under `sono.selection.v1` in local storage. Resetting the configuration does not reset the language. Invalid or unavailable storage falls back to defaults. The bag resets on reload, and contact details are never stored.

## Assets

- `public/speaker.webp`: the cobalt product image, 1024 px WebP. Chalk and Graphite are CSS finish variations of it, and both models share one illustrative design shown at approximate relative sizes.
- `public/thumbnail.png`: portfolio card image, captured from the running page.
- `public/project.json`: portfolio metadata.
