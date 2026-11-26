# Open Exercises Dataset

[简体中文](README.zh-Hans.md)

A free exercise library: what each exercise trains, what it needs, how to log it, how to do it, and an animation, in several languages.

- Browse it on the website: https://laurentwu.github.io/open-exercises-dataset/
- Data, animations and taxonomy: [CC BY 4.0](LICENSE). Tools and site code: [MIT](LICENSE-CODE).

## Use the data

The website serves ready-made JSON files:

| File | Content |
|---|---|
| `data/index.json` | Version, license, languages, count and file paths |
| `data/<language>.json` | Every exercise with its text in one language, for example `data/zh-Hans.json` |
| `data/all.json` | Every exercise with its text in all languages |
| `data/exercises/<id>.json` | One exercise with its text in all languages |
| `data/taxonomy.json` | Every allowed value and its label in each language |
| `media/<id>.gif` or `media/<id>.webp` | The GIF or WebP animation for one exercise |

Each release on GitHub also attaches these files as a zip.

One exercise in `data/en.json`:

```json
{
  "id": "barbell-bench-press",
  "category": "strength",
  "mechanic": "compound",
  "pattern": "horizontal-push",
  "laterality": "bilateral",
  "equipment": ["barbell", "bench"],
  "muscles": { "primary": ["chest"], "secondary": ["front-delts", "triceps"] },
  "metrics": ["weight", "reps"],
  "regions": ["chest"],
  "name": "Barbell Bench Press",
  "aliases": ["Bench Press"],
  "steps": ["..."],
  "tips": ["..."],
  "media": "media/barbell-bench-press.gif"
}
```

- `id` never changes and is never reused. A retired exercise stays in the data with `deprecated` and `replacedBy`.
- `equipment` lists everything the exercise needs. An empty list means no equipment.
- `metrics` says what to log for one set.
- `regions` is derived from the primary muscles.
- `variantOf`, when present, points to the base exercise.
- Labels for every value are in `data/taxonomy.json` under `labels.<language>`.

## Credit

CC BY 4.0 lets you use the data for any purpose, including commercial use, as long as you give credit. For example:

> Open Exercises Dataset (https://github.com/laurentwu/open-exercises-dataset) by Laurent Wu, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

Keep both links: this repository and the license. Say if you changed the data. Where links can be clickable, a shorter line works too: [Open Exercises Dataset](https://github.com/laurentwu/open-exercises-dataset) by Laurent Wu, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Languages

Language codes follow BCP 47. English (`en`) is the source language, and every other language is translated from it. Each translation records a hash of the English text it came from, so the validator can find translations that are out of date.

## Repository layout

| Path | Content |
|---|---|
| `exercises/<id>.json` | Language-neutral facts |
| `locales/<language>/exercises/<id>.json` | Name, aliases, steps and tips in one language |
| `locales/<language>/taxonomy.json` | Labels for the taxonomy values |
| `taxonomy.json` | Allowed values for every field |
| `media/<id>.gif` or `media/<id>.webp` | GIF or WebP animations |
| `schema/` | JSON Schema for the files above |
| `docs/` | Writing guides for each language |
| `site/` | The website |

```sh
npm install
npm run check
npm run build
npm run serve
```

`check` validates the data and runs the tests. `build` writes the website and the JSON files to `dist/`. `serve` builds and previews the site at http://localhost:4321/.
