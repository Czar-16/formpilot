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
  return migrateNames(next);
}

Object.assign(aliases, {
  "given name": "first name",
  firstname: "first name",
  fname: "first name",
  forename: "first name",
  "family name": "last name",
  lastname: "last name",
  lname: "last name",
  surname: "last name",
  "e mail": "email",
  "email address": "email",
  "phone number": "phone",
  "mobile number": "phone",
  mobile: "phone",
  "mobile phone": "phone",
  address: "street address",
  "address line 1": "street address",
  "zip postal code": "pin code",
  "personal website": "website",
  "linkedin url": "linkedin",
  "github url": "github",
  résumé: "resume",
  cv: "resume",
  "curriculum vitae": "resume",
});
const semanticTokens = new Set([
  "given-name",
  "family-name",
  "name",
  "email",
  "tel",
  "street-address",
  "address-line1",
  "address-level2",
  "address-level1",
  "postal-code",
  "country",
  "country-name",
  "url",
]);
export function bulkMatch(profile, descriptor) {
  const grouped = new Set(profile.groups.flatMap((g) => g.fields));
  const items = orderedItems(profile).filter(
    (i) =>
      !grouped.has(i.id) &&
      i.value.trim() &&
      (descriptor.inputType === "file"
        ? i.type === "file" && canonical(i.label) === "resume"
        : i.type !== "file"),
  );
  const auto = String(descriptor.autocomplete || "")
    .split(/\s+/)
    .find((t) => semanticTokens.has(t));
  const terms = ["label", "accessibleName", "placeholder", "name", "id"]
    .map((k) => canonical(descriptor[k]))
    .filter(Boolean);
  if (descriptor.inputType === "file") {
    const uploadWords = new Set([
      ...stop,
      "upload",
      "attach",
      "file",
      "document",
      "optional",
      "required",
    ]);
    const resumeTerms = terms.map((term) =>
      canonical(
        term
          .split(" ")
          .filter((word) => !uploadWords.has(word))
          .join(" "),
      ),
    );
    if (!resumeTerms.some((term) => term === "resume")) return null;
    terms.push("resume");
  }
  const candidates = items.map((i) => ({ ...i, ids: [i.id] }));
  if (!items.some((i) => canonical(i.label) === "full name")) {
    const first = items.filter((i) => canonical(i.label) === "first name");
    const last = items.filter((i) => canonical(i.label) === "last name");
    if (first.length === 1 && last.length === 1)
      candidates.push({
        label: "Full name",
        type: "text",
        value: first[0].value.trim() + " " + last[0].value.trim(),
        ids: [first[0].id, last[0].id],
      });
  }
  let best = null,
    score = 0,
    tied = false;
  for (const item of candidates) {
    const label = canonical(item.label);
    let current = auto ? (canonical(auto) === label ? 4000 : 0) : 0;
    if (!auto)
      for (const term of terms) {
        if (term === label) current = Math.max(current, 3000);
        else if (
          label.split(" ").filter((t) => !stop.has(t)).length >= 2 &&
          (" " + term + " ").includes(" " + label + " ")
        )
          current = Math.max(current, 2000);
      }
    if (current > score) {
      best = item;
      score = current;
      tied = false;
    } else if (current && current === score) tied = true;
  }
  return tied ? null : best;
}
export function migrateNames(data, makeId = () => crypto.randomUUID()) {
  const next = structuredClone(data);
  for (const p of next.profiles) {
    if (p.nameFieldsVersion === 1) continue;
    const grouped = new Set(p.groups.flatMap((g) => g.fields));
    const ordinary = p.items.filter(
      (i) => !grouped.has(i.id) && i.type !== "file",
    );
    const missing = ["First name", "Last name"].filter(
      (label) => !ordinary.some((i) => canonical(i.label) === canonical(label)),
    );
    if (missing.length) {
      const full = ordinary.find((i) => canonical(i.label) === "full name");
      let category =
        p.categories.find((c) => c.id === full?.category) ||
        p.categories.find((c) => c.name === "Personal");
      if (!category) {
        category = {
          id: makeId(),
          name: "Personal",
          collapsed: false,
          entries: [],
        };
        p.categories.push(category);
      }
      let index = full
        ? category.entries.findIndex(
            (e) => e.kind === "item" && e.id === full.id,
          ) + 1
        : category.entries.length;
      for (const label of missing) {
        const item = {
          id: makeId(),
          label,
          type: "text",
          value: "",
          category: category.id,
        };
        p.items.push(item);
        category.entries.splice(index++, 0, { kind: "item", id: item.id });
      }
    }
    p.nameFieldsVersion = 1;
  }
  return next;
}
