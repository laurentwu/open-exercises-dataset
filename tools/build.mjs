import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDataset, readJson, regionsOf } from "./lib.mjs";
import { validate } from "./validate.mjs";

function facts(e, taxonomy) {
  const { id, ...rest } = e;
  return { id, ...rest, regions: regionsOf(taxonomy, e.muscles.primary) };
}

function text(t) {
  return { name: t.name, aliases: t.aliases, steps: t.steps, tips: t.tips };
}

export function buildData(root) {
  const data = loadDataset(root);
  const { meta, taxonomy, texts } = data;
  const version = readJson(join(root, "package.json")).version;
  const ids = [...data.exercises.keys()].sort();
  const mediaPaths = new Map(data.media.map((file) => [file.replace(/\.(gif|webp)$/, ""), `media/${file}`]));
  const media = (id) => mediaPaths.get(id) ?? null;
  const byLanguage = {};
  for (const lang of meta.languages) {
    byLanguage[lang] = ids.map((id) => ({ ...facts(data.exercises.get(id), taxonomy), ...text(texts[lang].get(id)), media: media(id) }));
  }
  const all = ids.map((id) => ({
    ...facts(data.exercises.get(id), taxonomy),
    text: Object.fromEntries(meta.languages.map((lang) => [lang, text(texts[lang].get(id))])),
    media: media(id),
  }));
  const index = {
    title: meta.title,
    version,
    license: meta.license,
    attribution: meta.attribution,
    repository: meta.repository,
    sourceLanguage: meta.sourceLanguage,
    languages: meta.languages,
    count: ids.length,
    files: {
      all: "data/all.json",
      taxonomy: "data/taxonomy.json",
      languages: Object.fromEntries(meta.languages.map((lang) => [lang, `data/${lang}.json`])),
      exercise: "data/exercises/{id}.json",
      media: "media/{id}.{ext}",
    },
  };
  return { index, all, byLanguage, taxonomy: { ...taxonomy, labels: data.labels }, media: data.media };
}

export function build(root, out) {
  const errors = validate(root);
  if (errors.length > 0) throw new Error(`dataset has ${errors.length} problems, run npm run validate`);
  const result = buildData(root);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "data", "exercises"), { recursive: true });
  const write = (path, value) => writeFileSync(join(out, path), JSON.stringify(value));
  write("data/index.json", result.index);
  write("data/all.json", { version: result.index.version, license: result.index.license, attribution: result.index.attribution, exercises: result.all });
  write("data/taxonomy.json", result.taxonomy);
  for (const [lang, list] of Object.entries(result.byLanguage)) write(`data/${lang}.json`, { version: result.index.version, language: lang, exercises: list });
  for (const e of result.all) write(`data/exercises/${e.id}.json`, e);
  if (result.media.length > 0) cpSync(join(root, "media"), join(out, "media"), { recursive: true });
  for (const f of ["LICENSE", "LICENSE-CODE"]) if (existsSync(join(root, f))) cpSync(join(root, f), join(out, f));
  const site = join(root, "site");
  if (existsSync(site)) cpSync(site, out, { recursive: true });
  return result.index;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(import.meta.url), "..", "..");
  const out = process.argv[2] ?? join(root, "dist");
  const index = build(root, out);
  console.log(`built ${index.count} exercises in ${index.languages.join(", ")} to ${out}`);
}
