# CLAUDE.md

Open Exercises Dataset: exercise data, animations and taxonomy under CC BY 4.0 (LICENSE), tools and site code under MIT (LICENSE-CODE).

The code is the spec. Data rules live in schema/, taxonomy.json and tools/validate.mjs, and writing rules in docs/style-*.md. Do not write separate feature docs.

## Commands

```sh
npm install
npm run check
npm run build
npm run serve
```

`check` validates the data and runs the tests. `build` writes dist/: JSON files, media and the static site that GitHub Pages serves. `serve` builds and previews it at http://localhost:4321/.

## Layout

- `exercises/<id>.json`: language-neutral facts.
- `locales/<lang>/exercises/<id>.json`: name, aliases, steps and tips in one language. Language codes follow BCP 47. Translations carry a `source` hash of the English text they came from; `npm run validate` lists the stale ones.
- `locales/<lang>/taxonomy.json`: labels for every value in taxonomy.json.
- `media/<id>.gif`: one animation per exercise.
- `site/`: the static page, copied into dist/ by the build.

## Rules

- Ids never change and are never reused. Retire an exercise with `deprecated` and `replacedBy`.
- No code comments.
- `work/` is private scratch space and is never committed.
