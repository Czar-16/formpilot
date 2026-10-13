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
