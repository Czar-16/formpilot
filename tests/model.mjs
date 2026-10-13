import assert from "node:assert/strict";
import { bestMatch, convertLegacy, orderedItems } from "../model.js";
const items = [
  "GitHub",
  "Pin code",
  "Full name",
  "Bio",
  "Phone",
  "Website",
  "GitHub",
].map((label, n) => ({
  id: String(n),
  label,
  type: "text",
  value: n === 3 ? "line1\nline2" : "",
  category: "c",
}));
const p = {
  categories: [
    { id: "c", entries: items.map((i) => ({ kind: "item", id: i.id })) },
  ],
  items,
  groups: [],
};
for (const [descriptor, id] of [
  [{ label: "GitHub URL" }, "0"],
  [{ autocomplete: "shipping postal-code" }, "1"],
  [{ name: "fullName" }, "2"],
  [{ label: "Tell us your bio" }, "3"],
  [{ autocomplete: "tel" }, "4"],
  [{ autocomplete: "url" }, "5"],
])
  assert.equal(bestMatch(p, descriptor)?.id, id);
assert.equal(bestMatch(p, { label: "Unrelated vacancy" }), null);
assert.equal(bestMatch(p, {}), null);
assert.equal(bestMatch(p, { label: "GitHub URL", inputType: "url" }).id, "0");
assert.equal(bestMatch(p, { inputType: "text" }), null);
const legacy = { version: 1, profiles: [p], activeProfileId: "p" };
const converted = convertLegacy(legacy);
assert.equal(converted.version, 2);
assert.equal(converted.theme, "system");
assert.equal(converted.profiles[0].items[0].type, "url");
assert.equal(converted.profiles[0].items[3].type, "multiline");
assert.equal(legacy.version, 1);
assert.equal(converted.profiles[0].items[3].value, items[3].value);
p.categories[0].entries.reverse();
assert.equal(bestMatch(p, { label: "github" }).id, "6");
assert.equal(orderedItems(p)[0].id, "6");
console.log(
  "PASS: exact/containment/token matching, aliases, zero matches, saved-order ties and lossless legacy conversion",
);

const { bulkMatch, migrateNames } = await import("../model.js");
const profile = structuredClone(p);
profile.items.forEach((i) => (i.value = i.label));
profile.items.push(
  {
    id: "first",
    label: "Given name",
    value: "Ada",
    type: "text",
    category: "c",
  },
  {
    id: "last",
    label: "Surname",
    value: "Lovelace",
    type: "text",
    category: "c",
  },
);
profile.categories[0].entries.push(
  { kind: "item", id: "first" },
  { kind: "item", id: "last" },
);
assert.equal(bulkMatch(profile, { autocomplete: "given-name" }).value, "Ada");
assert.equal(
  bulkMatch(profile, { autocomplete: "family-name" }).value,
  "Lovelace",
);
assert.equal(bulkMatch(profile, { label: "GitHub" }), null);
assert.equal(bulkMatch(profile, { label: "Phone interview" }), null);
assert.equal(
  bulkMatch(profile, { label: "Your full name here" }).value,
  "Full name",
);
profile.items.find((i) => i.label === "Full name").value = "";
assert.equal(
  bulkMatch(profile, { autocomplete: "name" }).value,
  "Ada Lovelace",
);
profile.groups.push({ id: "project", fields: ["first"] });
assert.equal(bulkMatch(profile, { autocomplete: "given-name" }), null);
let id = 0;
const migration = migrateNames(legacy, () => `new-${++id}`);
assert.equal(migration.profiles[0].items.length, items.length + 2);
assert.deepEqual(
  migration.profiles[0].items.slice(0, items.length),
  legacy.profiles[0].items,
);
assert.deepEqual(migrateNames(migration), migration);
migration.profiles[0].items.pop();
assert.deepEqual(migrateNames(migration), migration);
console.log(
  "PASS bulk name aliases, combined names, confidence, ties, project exclusion and idempotent name migration",
);

const resumeProfile = {
  groups: [],
  items: [{ id: "r", label: "Resume", type: "file", value: "file-id" }],
  categories: [{ entries: [{ kind: "item", id: "r" }] }],
};
assert.equal(
  bulkMatch(resumeProfile, {
    inputType: "file",
    label: "Upload your résumé file",
  }).id,
  "r",
);
assert.equal(
  bulkMatch(resumeProfile, {
    inputType: "file",
    label: "Resume or cover letter",
  }),
  null,
);
assert.equal(
  bulkMatch(resumeProfile, { inputType: "file", label: "Supporting document" }),
  null,
);
