const state = { index: null, taxonomy: null, strings: null, lang: null, exercises: [], byId: new Map(), cache: new Map() };

const $ = (id) => document.getElementById(id);

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

function t(key, vars = {}) {
  const table = state.strings[state.lang] ?? state.strings.en;
  const text = table[key] ?? state.strings.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function label(section, value) {
  return state.taxonomy.labels[state.lang]?.[section]?.[value] ?? state.taxonomy.labels[state.index.sourceLanguage][section][value] ?? value;
}

function pickLanguage() {
  const langs = state.index.languages;
  const fromUrl = new URLSearchParams(location.search).get("lang");
  if (langs.includes(fromUrl)) return fromUrl;
  const saved = localStorage.getItem("lang");
  if (langs.includes(saved)) return saved;
  for (const wanted of navigator.languages ?? []) {
    const lower = wanted.toLowerCase();
    const exact = langs.find((l) => l.toLowerCase() === lower);
    if (exact) return exact;
    const base = langs.find((l) => l.split("-")[0] === lower.split("-")[0]);
    if (base) return base;
  }
  return state.index.sourceLanguage;
}

async function loadLanguage(lang) {
  if (!state.cache.has(lang)) state.cache.set(lang, getJson(state.index.files.languages[lang]));
  const data = await state.cache.get(lang);
  state.exercises = data.exercises;
  state.byId = new Map(data.exercises.map((e) => [e.id, e]));
}

function fillSelect(select, first, options) {
  const current = select.value;
  select.replaceChildren(h("option", { value: "" }, first), ...options.map(([value, text]) => h("option", { value }, text)));
  select.value = options.some(([v]) => v === current) ? current : "";
}

function renderChrome() {
  document.documentElement.lang = state.lang;
  document.title = t("title");
  for (const el of document.querySelectorAll("[data-text]")) el.textContent = t(el.dataset.text);
  $("query").placeholder = t("search");
  $("query").setAttribute("aria-label", t("search"));
  $("lang").replaceChildren(...state.index.languages.map((l) => h("option", { value: l, selected: l === state.lang }, state.strings[l]?.languageName ?? l)));
  $("attribution").textContent = state.index.attribution;
  $("repository").href = state.index.repository;
  const files = state.index.files;
  $("downloads").replaceChildren(
    h("span", { class: "downloads-label" }, t("jsonLabel")),
    ...state.index.languages.map((l) => h("a", { href: files.languages[l] }, state.strings[l]?.languageName ?? l)),
    h("a", { href: files.all }, t("allLanguages")),
    h("a", { href: files.taxonomy }, t("taxonomy")),
    h("a", { href: "data/index.json" }, t("index")),
  );
  const used = (pick) => [...new Set(state.exercises.flatMap(pick))];
  const sorted = (section, values) => values.map((v) => [v, label(section, v)]).sort((a, b) => a[1].localeCompare(b[1], state.lang));
  fillSelect($("region"), t("allRegions"), state.taxonomy.regions.filter((r) => used((e) => e.regions).includes(r)).map((r) => [r, label("regions", r)]));
  fillSelect($("equipment"), t("allEquipment"), [["none", t("noEquipment")], ...sorted("equipment", used((e) => e.equipment))]);
  fillSelect($("category"), t("allCategories"), state.taxonomy.categories.filter((c) => used((e) => [e.category]).includes(c)).map((c) => [c, label("categories", c)]));
}

function normalize(text) {
  return text.toLowerCase().replace(/[\s\-_]+/g, " ").trim();
}

function matches(e, query, region, equipment, category) {
  if (region && !e.regions.includes(region)) return false;
  if (equipment === "none" && e.equipment.length > 0) return false;
  if (equipment && equipment !== "none" && !e.equipment.includes(equipment)) return false;
  if (category && e.category !== category) return false;
  if (!query) return true;
  return [e.name, ...e.aliases, e.id].some((s) => normalize(s).includes(query));
}

function thumb(e, big = false) {
  if (!e.media) return h("div", { class: big ? "media placeholder big" : "media placeholder" }, big ? t("noAnimation") : e.name.slice(0, 1));
  return h("img", { class: big ? "media big" : "media", src: e.media, alt: e.name, loading: "lazy", decoding: "async" });
}

function renderGrid() {
  const query = normalize($("query").value);
  const list = state.exercises.filter((e) => matches(e, query, $("region").value, $("equipment").value, $("category").value));
  list.sort((a, b) => a.name.localeCompare(b.name, state.lang));
  $("count").textContent = t("count", { n: list.length });
  $("empty").hidden = list.length > 0;
  $("grid").replaceChildren(
    ...list.map((e) =>
      h(
        "li",
        {},
        h(
          "a",
          { class: "card", href: `#/${e.id}` },
          thumb(e),
          h("span", { class: "card-name" }, e.name),
          h("span", { class: "card-meta" }, e.muscles.primary.map((m) => label("muscles", m)).join(" · ")),
          h("span", { class: "card-meta" }, e.equipment.length ? e.equipment.map((q) => label("equipment", q)).join(" · ") : t("noEquipment")),
        ),
      ),
    ),
  );
}

function fact(name, value) {
  if (!value) return null;
  return [h("dt", {}, name), h("dd", {}, value)];
}

function renderDetail(id) {
  const dialog = $("detail");
  const e = state.byId.get(id);
  if (!e) {
    if (dialog.open) dialog.close();
    return;
  }
  const variants = state.exercises.filter((v) => v.variantOf === e.id);
  const base = e.variantOf ? state.byId.get(e.variantOf) : null;
  const link = (x) => h("a", { href: `#/${x.id}` }, x.name);
  const sep = t("listSeparator");
  const join = (values) => values.join(sep);
  const list = (items) => items.map((x, i) => [i > 0 ? sep : null, link(x)]);
  dialog.replaceChildren(
    h(
      "article",
      { class: "detail" },
      h("header", { class: "detail-head" }, h("h2", {}, e.name), h("a", { class: "close", href: "#", "aria-label": t("close") }, "×")),
      e.aliases.length ? h("p", { class: "aliases" }, `${t("aliases")}${t("colon")}${join(e.aliases)}`) : null,
      thumb(e, true),
      h(
        "dl",
        { class: "facts" },
        fact(t("primary"), join(e.muscles.primary.map((m) => label("muscles", m)))),
        fact(t("secondary"), join(e.muscles.secondary.map((m) => label("muscles", m)))),
        fact(t("equipment"), e.equipment.length ? join(e.equipment.map((q) => label("equipment", q))) : t("noEquipment")),
        fact(t("category"), label("categories", e.category)),
        fact(t("mechanic"), e.mechanic && label("mechanics", e.mechanic)),
        fact(t("pattern"), e.pattern && label("patterns", e.pattern)),
        fact(t("laterality"), label("laterality", e.laterality)),
        fact(t("metrics"), e.metrics.map((m) => label("metrics", m)).join(" + ")),
        base ? [h("dt", {}, t("variantOf")), h("dd", {}, link(base))] : null,
        variants.length ? [h("dt", {}, t("variants")), h("dd", {}, list(variants))] : null,
      ),
      h("h3", {}, t("steps")),
      h("ol", { class: "steps" }, e.steps.map((s) => h("li", {}, s))),
      e.tips.length ? [h("h3", {}, t("tips")), h("ul", { class: "tips" }, e.tips.map((s) => h("li", {}, s)))] : null,
      h("p", { class: "json-link" }, h("a", { href: state.index.files.exercise.replace("{id}", e.id) }, t("exerciseJson")), " ", h("code", {}, e.id)),
    ),
  );
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

function route() {
  const id = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  renderDetail(id);
}

async function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem("lang", lang);
  const url = new URL(location.href);
  url.searchParams.set("lang", lang);
  history.replaceState(null, "", url);
  await loadLanguage(lang);
  renderChrome();
  renderGrid();
  route();
}

async function main() {
  const [index, taxonomy, strings] = await Promise.all([getJson("data/index.json"), getJson("data/taxonomy.json"), getJson("strings.json")]);
  Object.assign(state, { index, taxonomy, strings });
  $("lang").addEventListener("change", (ev) => setLanguage(ev.target.value));
  for (const id of ["query", "region", "equipment", "category"]) $(id).addEventListener("input", renderGrid);
  window.addEventListener("hashchange", route);
  $("detail").addEventListener("close", () => {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  });
  $("detail").addEventListener("click", (ev) => {
    if (ev.target === ev.currentTarget) ev.currentTarget.close();
  });
  await setLanguage(pickLanguage());
}

main();
