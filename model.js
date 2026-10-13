export function orderedItems(profile) {
  return profile.categories.flatMap((c) =>
    c.entries.flatMap((e) =>
      e.kind === "item"
        ? [profile.items.find((i) => i.id === e.id)]
        : profile.groups
            .find((g) => g.id === e.id)
            .fields.map((id) => profile.items.find((i) => i.id === id)),
    ),
  );
}
const normalize = (value) =>
  String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\bgit hub\b/g, "github")
    .replace(/\blinked in\b/g, "linkedin");
const aliases = {
  "postal code": "pin code",
  zip: "pin code",
  "zip code": "pin code",
  tel: "phone",
  telephone: "phone",
  name: "full name",
  "address line1": "street address",
  "street address": "street address",
  "address level2": "city",
  "address level1": "state",
  "country name": "country",
  url: "website",
  "organization title": "title",
  "about me": "bio",
  "bio about me": "bio",
};
const canonical = (value) => {
  const n = normalize(value);
  return aliases[n] || n;
};
const stop = new Set([
  "url",
  "link",
  "your",
  "the",
  "a",
  "an",
  "enter",
  "please",
  "input",
  "field",
]);
export function bestMatch(profile, descriptor) {
  if (!descriptor) return null;
  const fields = ["label", "accessibleName", "placeholder", "name", "id"].map(
    (k) => descriptor[k],
  );
  const autocomplete = String(descriptor.autocomplete || "")
    .split(/\s+/)
    .filter((v) => !/^(section-|shipping$|billing$|on$|off$)/.test(v))
    .at(-1);
  fields.push(autocomplete);
  const terms = fields.map(canonical).filter(Boolean);
  let best = null,
    score = 0;
  for (const item of orderedItems(profile)) {
    const label = canonical(item.label),
      tokens = label.split(" ").filter((t) => !stop.has(t));
    let current = 0;
    for (const term of terms) {
      if (term === label) current = Math.max(current, 3000);
      else if (
        (" " + term + " ").includes(" " + label + " ") ||
        (" " + label + " ").includes(" " + term + " ")
      ) {
        if (term.split(" ").some((t) => !stop.has(t)))
          current = Math.max(current, 2000);
      } else {
        const other = new Set(term.split(" ").filter((t) => !stop.has(t)));
        const overlap = tokens.filter((t) => other.has(t)).length;
        if (overlap)
          current = Math.max(
            current,
            1000 + overlap / Math.max(tokens.length, other.size),
          );
      }
    }
    if (current > score) {
      best = item;
      score = current;
    }
  }
  return best;
}
export function convertLegacy(data) {
  const next = structuredClone(data);
  if (next.version === 1) {
    for (const p of next.profiles)
      for (const i of p.items) {
        if (i.type === "text")
          i.type = /^(website|linkedin|github|portfolio|link)$/i.test(i.label)
            ? "url"
            : /\n/.test(i.value) ||
                /^(bio|bio\/about me|description)$/i.test(i.label)
              ? "multiline"
              : "text";
      }
  }
  next.version = 2;
  next.theme = next.theme || "system";
  delete next.resetPromptSeen;
  return next;
}
