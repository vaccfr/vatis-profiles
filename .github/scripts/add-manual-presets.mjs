// Adds the reserved `Manual` preset to every station of the vATIS profiles.
//
//   bun run add-manual-presets.mjs <directory holding the profile files>
//
// Text is inserted in place rather than re-serialised, because the files do not
// share one layout, so the diff holds the new presets and the new serial only.
// Safe to run again: a station that already has `Manual` is left alone.
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MANUAL = "Manual";
const DIVIDER = "--- Custom ---";
const DIVIDER_TEMPLATE = "IF YOU SEE THIS. YOU HAVE SELECTED THE WRONG PROFILE! ";

/** The index just past the JSON string starting at `at`. */
function skipString(text, at) {
  let i = at + 1;
  while (text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
  return i + 1;
}

function skipSpace(text, at) {
  let i = at;
  while (/\s/.test(text[i])) i += 1;
  return i;
}

/** The index just past the JSON value starting at `at`. */
function skipValue(text, at) {
  const first = text[at];
  if (first === '"') return skipString(text, at);
  if (first !== "{" && first !== "[") {
    let i = at;
    while (!/[,\]}\s]/.test(text[i])) i += 1;
    return i;
  }
  let depth = 0;
  let i = at;
  while (true) {
    const c = text[i];
    if (c === '"') {
      i = skipString(text, i);
      continue;
    }
    if (c === "{" || c === "[") depth += 1;
    if (c === "}" || c === "]") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
}

/** Where the value of each key of the object at `at` starts. */
function objectKeys(text, at) {
  const keys = new Map();
  let i = skipSpace(text, at + 1);
  while (text[i] !== "}") {
    const end = skipString(text, i);
    const key = JSON.parse(text.slice(i, end));
    i = skipSpace(text, end) + 1; // the colon
    i = skipSpace(text, i);
    keys.set(key, i);
    i = skipSpace(text, skipValue(text, i));
    if (text[i] === ",") i = skipSpace(text, i + 1);
  }
  return keys;
}

/** The start and end of each element of the array at `at`. */
function arrayItems(text, at) {
  const items = [];
  let i = skipSpace(text, at + 1);
  while (text[i] !== "]") {
    const end = skipValue(text, i);
    items.push([i, end]);
    i = skipSpace(text, end);
    if (text[i] === ",") i = skipSpace(text, i + 1);
  }
  return items;
}

const isDivider = (name) => name.trim().startsWith("---");

const TIME = /\[TIME\]|\$TIME/;
const ITEM = /\[|\$[A-Za-z]/;

/** Replace what a template states about operations with the conditions item. */
function manualTemplate(template) {
  const time = TIME.exec(template);
  if (!time) return { template: null, stated: "" };
  const afterTime = time.index + time[0].length;
  const rest = template.slice(afterTime);
  const next = ITEM.exec(rest);
  const spanEnd = next ? next.index : rest.length;
  const span = rest.slice(0, spanEnd);
  const lead = /^[.,]?\s*/.exec(span)[0];
  const lines = lead.includes("\n");
  const newline = template.includes("\r\n") ? "\r\n" : "\n";
  // Before the join below, so an item on its own line takes that line with it.
  const tail = rest
    .slice(spanEnd)
    .replace(/^[ \t]*(?:\[ARPT_COND\]|\$ARPT_COND)\.?[ \t]*\r?\n/gm, "")
    .replace(/(?:\[ARPT_COND\]|\$ARPT_COND)\.?[ \t]*/g, "");
  return {
    template: `${template.slice(0, afterTime)}${lead || " "}[ARPT_COND]${lines ? newline : " "}${tail}`,
    stated: span.slice(lead.length).trim(),
  };
}

function nextSerial(serial) {
  const now = new Date();
  const day = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  return Math.max(serial + 1, day * 100 + 1);
}

const dir = process.argv[2];
const report = [];
for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
  const path = join(dir, file);
  let text = readFileSync(path, "utf8");
  const parsed = JSON.parse(text);
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const root = objectKeys(text, skipSpace(text, 0));
  const stations = arrayItems(text, root.get("stations"));
  const inserts = [];
  stations.forEach(([start], index) => {
    const station = parsed.stations[index];
    if (station.presets.some((preset) => preset.name === MANUAL)) {
      report.push({ file, station: station.identifier, status: "already has Manual" });
      return;
    }
    const real = station.presets.filter((preset) => !isDivider(preset.name));
    const base = real.find((preset) => /ARPT_COND/.test(preset.template ?? "")) ?? real[0];
    const made = base ? manualTemplate(base.template ?? "") : { template: null, stated: "" };
    if (!made.template) {
      report.push({ file, station: station.identifier, status: "NEEDS HAND-EDITING", base: base?.name });
      return;
    }
    const ordinals = station.presets.map((preset) => preset.ordinal).filter(Number.isFinite);
    const ordinal = ordinals.length ? Math.max(...ordinals) : 0;
    const generator = base.externalGenerator ?? { enabled: false };
    const entries = [
      { id: randomUUID(), ordinal: ordinal + 1, name: DIVIDER, airportConditions: "", notams: "", template: DIVIDER_TEMPLATE, externalGenerator: generator },
      { id: randomUUID(), ordinal: ordinal + 2, name: MANUAL, airportConditions: "", notams: "", template: made.template, externalGenerator: generator },
    ];
    const presets = arrayItems(text, objectKeys(text, start).get("presets"));
    const [lastStart, lastEnd] = presets[presets.length - 1];
    const lineStart = text.lastIndexOf("\n", lastStart) + 1;
    const pad = text.slice(lineStart, lastStart);
    const unit = /^( +)\S/m.exec(text.slice(skipSpace(text, 0) + 1))?.[1].length ?? 2;
    const body = entries
      .map((entry) =>
        JSON.stringify(entry, null, unit)
          .split("\n")
          .map((line, at) => (at === 0 ? line : pad + line))
          .join(newline),
      )
      .map((entry) => `,${newline}${pad}${entry}`)
      .join("");
    inserts.push([lastEnd, body]);
    report.push({
      file,
      station: station.identifier,
      status: "added",
      base: base.name,
      hadConditionsItem: /ARPT_COND/.test(base.template ?? ""),
      stated: made.stated,
      template: made.template,
    });
  });
  if (inserts.length === 0) continue;
  // From the end, so earlier positions stay right.
  for (const [at, body] of inserts.sort((a, b) => b[0] - a[0])) {
    text = text.slice(0, at) + body + text.slice(at);
  }
  const serial = nextSerial(parsed.updateSerial);
  text = text.replace(/"updateSerial":\s*\d+/, (found) => found.replace(/\d+$/, String(serial)));
  JSON.parse(text);
  writeFileSync(path, text);
  report.push({ file, status: "serial", from: parsed.updateSerial, to: serial });
}
console.log(JSON.stringify(report, null, 1));
