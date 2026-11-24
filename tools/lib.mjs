import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const TAXONOMY_SECTIONS = ["regions", "muscles", "equipment", "categories", "mechanics", "patterns", "laterality", "metrics"];

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor", "of", "on", "onto", "or", "the", "to", "vs", "with"]);

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function jsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

export function sourceHash(text) {
  const payload = JSON.stringify({ name: text.name, steps: text.steps, tips: text.tips });
  return createHash("sha256").update(payload).digest("hex").slice(0, 8);
}

export function taxonomyValues(taxonomy, section) {
  const value = taxonomy[section];
  return Array.isArray(value) ? value : Object.keys(value);
}

export function regionsOf(taxonomy, muscles) {
  return [...new Set(muscles.map((m) => taxonomy.muscles[m]?.region).filter(Boolean))];
}

export function titleCaseProblem(name) {
  const words = name.split(" ");
  for (const [i, word] of words.entries()) {
    const edge = i === 0 || i === words.length - 1;
    if (!edge && SMALL_WORDS.has(word.toLowerCase())) {
      if (word !== word.toLowerCase()) return `"${word}" should be lowercase`;
      continue;
    }
    for (const [j, part] of word.split("-").entries()) {
      if (j > 0 && SMALL_WORDS.has(part.toLowerCase())) {
        if (part !== part.toLowerCase()) return `"${word}" should write "${part}" in lowercase`;
      } else if (part.split("/").some((p) => /^\p{Ll}/u.test(p))) return `"${word}" should start each part with a capital letter`;
    }
  }
  return null;
}

export function loadDataset(root) {
  const meta = readJson(join(root, "meta.json"));
  const taxonomy = readJson(join(root, "taxonomy.json"));
  const labels = {};
  const texts = {};
  for (const lang of meta.languages) {
    const labelPath = join(root, "locales", lang, "taxonomy.json");
    labels[lang] = existsSync(labelPath) ? readJson(labelPath) : null;
    texts[lang] = new Map(jsonFiles(join(root, "locales", lang, "exercises")).map((f) => [f.slice(0, -5), readJson(join(root, "locales", lang, "exercises", f))]));
  }
  const exerciseDir = join(root, "exercises");
  const exercises = new Map(jsonFiles(exerciseDir).map((f) => [f.slice(0, -5), readJson(join(exerciseDir, f))]));
  const mediaDir = join(root, "media");
  const media = existsSync(mediaDir) ? readdirSync(mediaDir).sort() : [];
  return { root, meta, taxonomy, labels, texts, exercises, media };
}
