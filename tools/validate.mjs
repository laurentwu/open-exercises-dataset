import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TAXONOMY_SECTIONS, loadDataset, readJson, sourceHash, taxonomyValues, titleCaseProblem } from "./lib.mjs";

const BANNED_PHRASES = [/desired number of (repetitions|reps)/i, /\bv\.?\s*\d/i, /\bversion\s*\d/i, /\bpov\b/i, /\((fe)?male\)/i, /в°|Ã|â€/];
const SENTENCE_END = { en: /[.!?]$/, "zh-Hans": /[。！？]$/ };

function normalize(text) {
  return text.toLowerCase().replace(/[\s\-_]+/g, " ").trim();
}

export function schemas(root) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const load = (name) => ajv.compile(readJson(join(root, "schema", name)));
  return { exercise: load("exercise.schema.json"), text: load("text.schema.json"), labels: load("taxonomy-labels.schema.json") };
}

function schemaErrors(check, value, where) {
  if (check(value)) return [];
  return check.errors.map((e) => `${where}: ${e.instancePath || "/"} ${e.message}`);
}

function checkTaxonomy(data, errors) {
  const { taxonomy, labels, meta } = data;
  for (const section of TAXONOMY_SECTIONS) {
    const values = taxonomyValues(taxonomy, section);
    if (new Set(values).size !== values.length) errors.push(`taxonomy.json: ${section} has duplicate values`);
  }
  for (const [muscle, info] of Object.entries(taxonomy.muscles)) {
    if (!taxonomy.regions.includes(info.region)) errors.push(`taxonomy.json: muscle ${muscle} has unknown region ${info.region}`);
  }
  for (const set of taxonomy.metricSets) {
    for (const m of set) if (!taxonomy.metrics.includes(m)) errors.push(`taxonomy.json: metric set ${set.join("+")} uses unknown metric ${m}`);
  }
  for (const lang of meta.languages) {
    const where = `locales/${lang}/taxonomy.json`;
    if (!labels[lang]) {
      errors.push(`${where}: missing`);
      continue;
    }
    errors.push(...schemaErrors(data.schemas.labels, labels[lang], where));
    for (const section of TAXONOMY_SECTIONS) {
      const expected = taxonomyValues(taxonomy, section);
      const actual = Object.keys(labels[lang][section] ?? {});
      for (const v of expected) if (!actual.includes(v)) errors.push(`${where}: ${section}.${v} has no label`);
      for (const v of actual) if (!expected.includes(v)) errors.push(`${where}: ${section}.${v} is not in taxonomy.json`);
    }
  }
}

export function checkFacts(data, errors) {
  const { taxonomy, exercises } = data;
  const metricSets = new Set(taxonomy.metricSets.map((s) => s.join("+")));
  for (const [file, e] of exercises) {
    const where = `exercises/${file}.json`;
    const before = errors.length;
    errors.push(...schemaErrors(data.schemas.exercise, e, where));
    if (errors.length > before) continue;
    if (e.id !== file) errors.push(`${where}: id ${e.id} does not match the file name`);
    const inSection = (section, value, field) => {
      if (!taxonomyValues(taxonomy, section).includes(value)) errors.push(`${where}: ${field} ${value} is not in taxonomy.${section}`);
    };
    inSection("categories", e.category, "category");
    inSection("laterality", e.laterality, "laterality");
    if (e.mechanic !== undefined) inSection("mechanics", e.mechanic, "mechanic");
    if (e.pattern !== undefined) inSection("patterns", e.pattern, "pattern");
    if (e.category === "strength" && e.mechanic === undefined) errors.push(`${where}: strength exercises need a mechanic`);
    e.equipment.forEach((v) => inSection("equipment", v, "equipment"));
    [...e.muscles.primary, ...e.muscles.secondary].forEach((v) => inSection("muscles", v, "muscle"));
    if (e.muscles.primary.some((m) => e.muscles.secondary.includes(m))) errors.push(`${where}: a muscle is both primary and secondary`);
    if (!metricSets.has(e.metrics.join("+"))) errors.push(`${where}: metrics ${e.metrics.join("+")} is not one of taxonomy.metricSets`);
    if (e.variantOf !== undefined) {
      const base = exercises.get(e.variantOf);
      if (!base || e.variantOf === e.id) errors.push(`${where}: variantOf ${e.variantOf} is not another exercise`);
      else if (base.variantOf !== undefined) errors.push(`${where}: variantOf ${e.variantOf} is itself a variant`);
    }
    if (e.replacedBy !== undefined) {
      const next = exercises.get(e.replacedBy);
      if (!next || e.replacedBy === e.id) errors.push(`${where}: replacedBy ${e.replacedBy} is not another exercise`);
      else if (next.deprecated) errors.push(`${where}: replacedBy ${e.replacedBy} is deprecated`);
    }
  }
}

function checkTexts(data, errors) {
  const { meta, texts, exercises } = data;
  const source = texts[meta.sourceLanguage];
  for (const lang of meta.languages) {
    const names = new Map();
    for (const id of exercises.keys()) {
      if (!texts[lang].has(id)) errors.push(`locales/${lang}/exercises/${id}.json: missing`);
    }
    for (const [id, t] of texts[lang]) {
      const where = `locales/${lang}/exercises/${id}.json`;
      if (!exercises.has(id)) {
        errors.push(`${where}: no exercise with this id`);
        continue;
      }
      const before = errors.length;
      errors.push(...schemaErrors(data.schemas.text, t, where));
      if (errors.length > before) continue;
      if (lang === meta.sourceLanguage) {
        if (t.source !== undefined) errors.push(`${where}: source-language text must not have a source hash`);
        const problem = titleCaseProblem(t.name);
        if (problem) errors.push(`${where}: name is not in title case, ${problem}`);
      } else if (source.has(id) && t.source !== sourceHash(source.get(id))) {
        errors.push(`${where}: translation is out of date with locales/${meta.sourceLanguage}/exercises/${id}.json`);
      }
      if (/[()（）]/.test(t.name)) errors.push(`${where}: name has brackets`);
      if (t.aliases.some((a) => normalize(a) === normalize(t.name))) errors.push(`${where}: an alias repeats the name`);
      for (const line of [t.name, ...t.aliases, ...t.steps, ...t.tips]) {
        const banned = BANNED_PHRASES.find((p) => p.test(line));
        if (banned) errors.push(`${where}: "${line}" matches banned pattern ${banned}`);
      }
      const end = SENTENCE_END[lang];
      if (end) for (const line of [...t.steps, ...t.tips]) if (!end.test(line)) errors.push(`${where}: "${line}" does not end like a sentence`);
      for (const label of [t.name, ...t.aliases]) {
        const key = normalize(label);
        const owner = names.get(key);
        if (owner && owner !== id) errors.push(`${where}: "${label}" is also used by ${owner}`);
        else names.set(key, id);
      }
    }
  }
}

function checkMedia(data, errors) {
  for (const file of data.media) {
    const match = file.match(/^(.+)\.gif$/);
    if (!match) {
      errors.push(`media/${file}: only <id>.gif files belong here`);
      continue;
    }
    if (!data.exercises.has(match[1])) errors.push(`media/${file}: no exercise with this id`);
    const head = readFileSync(join(data.root, "media", file)).subarray(0, 6).toString("latin1");
    if (head !== "GIF89a" && head !== "GIF87a") errors.push(`media/${file}: not a GIF`);
  }
}

export function validate(root) {
  const errors = [];
  const data = { ...loadDataset(root), schemas: schemas(root) };
  if (!data.meta.languages.includes(data.meta.sourceLanguage)) errors.push("meta.json: languages must include sourceLanguage");
  if (!/^https:\/\/\S+$/.test(data.meta.repository ?? "")) errors.push("meta.json: repository must be an https URL");
  else if (!data.meta.attribution.includes(data.meta.repository)) errors.push("meta.json: attribution must link the repository");
  if (!data.meta.attribution.includes(data.meta.author)) errors.push("meta.json: attribution must name the author");
  checkTaxonomy(data, errors);
  checkFacts(data, errors);
  checkTexts(data, errors);
  checkMedia(data, errors);
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? join(fileURLToPath(import.meta.url), "..", "..");
  const errors = validate(root);
  for (const e of errors) console.error(e);
  if (errors.length > 0) {
    console.error(`${errors.length} problems`);
    process.exit(1);
  }
  console.log("dataset is valid");
}
