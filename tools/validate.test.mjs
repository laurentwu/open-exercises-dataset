import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { build } from "./build.mjs";
import { sourceHash, titleCaseProblem } from "./lib.mjs";
import { validate } from "./validate.mjs";

const repo = join(import.meta.dirname, "..");
const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const pushUp = {
  id: "push-up",
  category: "strength",
  mechanic: "compound",
  pattern: "horizontal-push",
  laterality: "bilateral",
  equipment: [],
  muscles: { primary: ["chest"], secondary: ["triceps", "front-delts"] },
  metrics: ["reps"],
};
const pushUpEn = { name: "Push-Up", aliases: ["Press-Up"], steps: ["Start in a high plank.", "Lower your chest to the floor and press back up."], tips: ["Keep your body in a straight line."] };
const pushUpZh = { name: "俯卧撑", aliases: [], steps: ["从高位平板支撑开始。", "胸部下放接近地面，再推起。"], tips: ["身体保持一条直线。"] };
const webp = Buffer.from("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoCAAIAAgA0JaQAA3AA/vuUAAA=", "base64");
const animatedWebp = Buffer.from("UklGRsoAAABXRUJQVlA4WAoAAAACAAAAAQAAAQAAQU5JTQYAAAD/////AABBTk1GSgAAAAAAAAAAAAEAAAEAAPQBAAJWUDggMgAAALABAJ0BKgIAAgACADQlmAJ0AQ72nkAAzj91oWJPVVOq5fyNPKxhNJOj+Zvwo+Tr/AAAQU5NRkwAAAAAAAAAAAABAAABAAD0AQAAVlA4IDQAAAC0AQCdASoCAAIAAAA0JZACdAEO+KbQAP7Pgfk/BDpqiY0OGj6I7XFzZEUfo/7v/Ul7AAAA", "base64");

function fixture({ exercises = [pushUp], en = { "push-up": pushUpEn }, zh = { "push-up": { source: sourceHash(pushUpEn), ...pushUpZh } }, media = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "oed-"));
  dirs.push(root);
  for (const f of ["meta.json", "taxonomy.json", "package.json", "schema", "locales/en/taxonomy.json", "locales/zh-Hans/taxonomy.json"]) cpSync(join(repo, f), join(root, f), { recursive: true });
  mkdirSync(join(root, "exercises"));
  for (const e of exercises) writeFileSync(join(root, "exercises", `${e.id}.json`), JSON.stringify(e));
  for (const [lang, texts] of Object.entries({ en, "zh-Hans": zh })) {
    mkdirSync(join(root, "locales", lang, "exercises"), { recursive: true });
    for (const [id, t] of Object.entries(texts)) writeFileSync(join(root, "locales", lang, "exercises", `${id}.json`), JSON.stringify(t));
  }
  if (Object.keys(media).length > 0) {
    mkdirSync(join(root, "media"));
    for (const [file, bytes] of Object.entries(media)) writeFileSync(join(root, "media", file), bytes);
  }
  return root;
}

function problems(options) {
  return validate(fixture(options)).join("\n");
}

test("the repository's own data is valid", () => {
  assert.deepEqual(validate(repo), []);
});

test("a complete exercise in both languages is valid", () => {
  assert.equal(problems(), "");
});

test("facts must use taxonomy values and match the file name", () => {
  const out = problems({ exercises: [{ ...pushUp, equipment: ["sofa"], muscles: { primary: ["chest"], secondary: ["chest"] }, metrics: ["reps", "weight"] }] });
  assert.match(out, /equipment sofa is not in taxonomy.equipment/);
  assert.match(out, /both primary and secondary/);
  assert.match(out, /metrics reps\+weight is not one of taxonomy.metricSets/);
  const renamed = fixture();
  writeFileSync(join(renamed, "exercises", "push-up.json"), JSON.stringify({ ...pushUp, id: "press-up" }));
  assert.match(validate(renamed).join("\n"), /id press-up does not match the file name/);
});

test("strength exercises need a mechanic", () => {
  const { mechanic, ...noMechanic } = pushUp;
  assert.ok(mechanic);
  assert.match(problems({ exercises: [noMechanic] }), /strength exercises need a mechanic/);
});

test("variants point at a base exercise that is not a variant itself", () => {
  const knee = { ...pushUp, id: "knee-push-up", variantOf: "push-up" };
  const wide = { ...pushUp, id: "wide-push-up", variantOf: "knee-push-up" };
  const text = (name) => ({ ...pushUpEn, name, aliases: [] });
  const en = { "push-up": pushUpEn, "knee-push-up": text("Knee Push-Up"), "wide-push-up": text("Wide Push-Up") };
  const zh = Object.fromEntries(Object.entries(en).map(([id, t], i) => [id, { ...pushUpZh, name: `俯卧撑${i}`, source: sourceHash(t) }]));
  assert.match(problems({ exercises: [pushUp, knee, wide], en, zh }), /variantOf knee-push-up is itself a variant/);
});

test("every language has text for every exercise and nothing else", () => {
  const out = problems({ zh: { "sit-up": { source: "00000000", ...pushUpZh } } });
  assert.match(out, /zh-Hans\/exercises\/push-up.json: missing/);
  assert.match(out, /zh-Hans\/exercises\/sit-up.json: no exercise with this id/);
});

test("a translation goes out of date when the source text changes", () => {
  assert.match(problems({ zh: { "push-up": { source: sourceHash({ ...pushUpEn, steps: ["Old step.", "Another."] }), ...pushUpZh } } }), /out of date/);
});

test("names follow the writing rules", () => {
  const out = problems({ en: { "push-up": { ...pushUpEn, name: "Push-up", aliases: ["push up"] } } });
  assert.match(out, /title case/);
  assert.match(out, /an alias repeats the name/);
  assert.match(problems({ en: { "push-up": { ...pushUpEn, name: "Push-Up (Male)" } } }), /brackets/);
});

test("steps are full sentences without filler", () => {
  const out = problems({ en: { "push-up": { ...pushUpEn, steps: ["Start in a high plank", "Repeat for the desired number of repetitions."] } } });
  assert.match(out, /does not end like a sentence/);
  assert.match(out, /banned pattern/);
});

test("two exercises cannot share a name or alias in one language", () => {
  const other = { ...pushUp, id: "press-up" };
  const en = { "push-up": pushUpEn, "press-up": { ...pushUpEn, name: "Press-Up", aliases: [] } };
  const zh = { "push-up": { ...pushUpZh, source: sourceHash(pushUpEn) }, "press-up": { ...pushUpZh, name: "标准俯卧撑", source: sourceHash(en["press-up"]) } };
  assert.match(problems({ exercises: [pushUp, other], en, zh }), /"Press-Up" is also used by/);
});

test("media accepts GIF87a, GIF89a and WebP", () => {
  for (const [file, bytes] of [["push-up.gif", "GIF87a"], ["push-up.gif", "GIF89a"], ["push-up.webp", webp], ["push-up.webp", animatedWebp]]) {
    assert.equal(problems({ media: { [file]: bytes } }), "");
  }
});

test("media files must use a supported name and belong to an exercise", () => {
  const out = problems({ media: { "sit-up.gif": "GIF89a", "pull-up.webp": webp, "push-up.png": "x" } });
  assert.match(out, /media\/sit-up\.gif: no exercise with this id/);
  assert.match(out, /media\/pull-up\.webp: no exercise with this id/);
  assert.match(out, /media\/push-up\.png: only <id>\.gif or <id>\.webp files belong here/);
});

test("media rejects invalid GIF and WebP contents", () => {
  assert.equal(problems({ media: { "push-up.gif": "PNG" } }), "media/push-up.gif: not a GIF");
  const wrongRiff = Buffer.from(webp);
  wrongRiff.write("NOPE", 0);
  const wrongType = Buffer.from(webp);
  wrongType.write("NOPE", 8);
  const wrongSize = Buffer.from(webp);
  wrongSize.writeUInt32LE(webp.length - 7, 4);
  const bigEndianSize = Buffer.from(webp);
  bigEndianSize.writeUInt32BE(webp.length - 8, 4);
  for (const bytes of [Buffer.alloc(0), webp.subarray(0, 3), webp.subarray(0, 11), webp.subarray(0, -1), wrongRiff, wrongType, wrongSize, bigEndianSize]) {
    assert.equal(problems({ media: { "push-up.webp": bytes } }), "media/push-up.webp: not a WebP");
  }
});

test("an exercise cannot have both a GIF and a WebP", () => {
  const root = fixture({ media: { "push-up.gif": "GIF89a", "push-up.webp": webp } });
  const errors = validate(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /media\/push-up\.gif.*media\/push-up\.webp/);
  assert.throws(() => build(root, join(root, "dist")), /dataset has 1 problems/);
});

test("title case allows small words and hyphenated parts", () => {
  assert.equal(titleCaseProblem("Push-Up on Stability Ball"), null);
  assert.equal(titleCaseProblem("45° Leg Press"), null);
  assert.match(titleCaseProblem("Barbell bench Press"), /bench/);
  assert.match(titleCaseProblem("Push-up"), /Push-up/);
  assert.match(titleCaseProblem("Row With a Band"), /With/);
  assert.equal(titleCaseProblem("Knee-to-Wall Ankle Mobilization"), null);
  assert.match(titleCaseProblem("Knee-To-Wall Ankle Mobilization"), /lowercase/);
});

test("the build writes per-language, full and per-exercise JSON with derived regions", () => {
  const root = fixture({ media: { "push-up.gif": "GIF89a...." } });
  const out = join(root, "dist");
  const index = build(root, out);
  assert.equal(index.count, 1);
  assert.equal(index.repository, JSON.parse(readFileSync(join(repo, "meta.json"), "utf8")).repository);
  assert.equal(index.files.media, "media/{id}.{ext}");
  const zh = JSON.parse(readFileSync(join(out, "data/zh-Hans.json"), "utf8"));
  assert.deepEqual(zh.exercises[0].regions, ["chest"]);
  assert.equal(zh.exercises[0].name, "俯卧撑");
  assert.equal(zh.exercises[0].media, "media/push-up.gif");
  const one = JSON.parse(readFileSync(join(out, "data/exercises/push-up.json"), "utf8"));
  assert.equal(one.text.en.name, "Push-Up");
  assert.equal(one.text["zh-Hans"].source, undefined);
  const taxonomy = JSON.parse(readFileSync(join(out, "data/taxonomy.json"), "utf8"));
  assert.equal(taxonomy.labels["zh-Hans"].muscles.chest, "胸肌");
  assert.equal(readFileSync(join(out, "media/push-up.gif"), "latin1").slice(0, 6), "GIF89a");
});

test("the build publishes mixed GIF and WebP paths and copies the media bytes", () => {
  const knee = { ...pushUp, id: "knee-push-up", variantOf: "push-up" };
  const kneeEn = { ...pushUpEn, name: "Knee Push-Up", aliases: [] };
  const en = { "push-up": pushUpEn, "knee-push-up": kneeEn };
  const zh = {
    "push-up": { ...pushUpZh, source: sourceHash(pushUpEn) },
    "knee-push-up": { ...pushUpZh, name: "跪姿俯卧撑", source: sourceHash(kneeEn) },
  };
  const root = fixture({ exercises: [pushUp, knee], en, zh, media: { "push-up.webp": animatedWebp, "knee-push-up.gif": "GIF89a...." } });
  const out = join(root, "dist");
  build(root, out);
  const read = (file) => JSON.parse(readFileSync(join(out, "data", file), "utf8"));
  assert.equal(read("index.json").files.media, "media/{id}.{ext}");
  for (const file of ["all.json", "en.json", "zh-Hans.json"]) {
    const paths = Object.fromEntries(read(file).exercises.map(({ id, media }) => [id, media]));
    assert.deepEqual(paths, { "knee-push-up": "media/knee-push-up.gif", "push-up": "media/push-up.webp" });
  }
  assert.equal(read("exercises/push-up.json").media, "media/push-up.webp");
  assert.equal(read("exercises/knee-push-up.json").media, "media/knee-push-up.gif");
  assert.deepEqual(readFileSync(join(out, "media/push-up.webp")), animatedWebp);
  assert.equal(readFileSync(join(out, "media/knee-push-up.gif"), "latin1"), "GIF89a....");
});

test("the build uses null when an exercise has no animation", () => {
  const root = fixture();
  const out = join(root, "dist");
  build(root, out);
  const read = (file) => JSON.parse(readFileSync(join(out, "data", file), "utf8"));
  assert.equal(read("all.json").exercises[0].media, null);
  assert.equal(read("en.json").exercises[0].media, null);
  assert.equal(read("zh-Hans.json").exercises[0].media, null);
  assert.equal(read("exercises/push-up.json").media, null);
});

test("the credit line names the author and links the repository", () => {
  const root = fixture();
  const meta = JSON.parse(readFileSync(join(root, "meta.json"), "utf8"));
  writeFileSync(join(root, "meta.json"), JSON.stringify({ ...meta, attribution: "Open Exercises Dataset by Laurent Wu" }));
  assert.match(validate(root).join("\n"), /attribution must link the repository/);
  writeFileSync(join(root, "meta.json"), JSON.stringify({ ...meta, repository: undefined }));
  assert.match(validate(root).join("\n"), /repository must be an https URL/);
  writeFileSync(join(root, "meta.json"), JSON.stringify({ ...meta, author: "Someone Else" }));
  assert.match(validate(root).join("\n"), /attribution must name the author/);
});

test("the build refuses invalid data", () => {
  assert.throws(() => build(fixture({ zh: {} }), join(tmpdir(), "never")), /problems/);
});
