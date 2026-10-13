import { bestMatch, convertLegacy, bulkMatch, migrateNames } from "./model.js";
import { icon } from "./icons.js";
import { getFile, putFile, deleteFile, encode, decode } from "./db.js";
const $ = (id) => document.getElementById(id),
  uid = () => crypto.randomUUID();
let state,
  queue = Promise.resolve(),
  drag,
  toastTimer;
let selectedCategory = "all",
  owner,
  targetItemId,
  currentTabId,
  panelWindowId,
  targetRevision = 0,
  editorReturn;
const filled = new Set(),
  copied = new Set(),
  copyTimers = new Map();
function iconButton(name, label, fn, disabled) {
  const b = button("", fn, disabled);
  b.append(icon(name));
  b.setAttribute("aria-label", label);
  b.title = label;
  return b;
}
function closePopovers() {
  document.querySelectorAll(":popover-open").forEach((p) => p.hidePopover());
}
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
function isDarkTheme() {
  return (
    state?.theme === "dark" ||
    ((!state?.theme || state.theme === "system") && systemTheme.matches)
  );
}
function applyTheme() {
  if (["light", "dark"].includes(state?.theme))
    document.documentElement.dataset.theme = state.theme;
  else delete document.documentElement.dataset.theme;
  $("theme").value = state?.theme || "system";
  const dark = isDarkTheme();
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  $("themeToggle").replaceChildren(icon(dark ? "sun" : "moon"));
  $("themeToggle").setAttribute("aria-label", label);
  $("themeToggle").title = label;
}
systemTheme.addEventListener("change", () => applyTheme());
$("themeToggle").onclick = () =>
  change((s) => {
    s.theme = isDarkTheme() ? "light" : "dark";
  }).catch(() => {});
$("editor").addEventListener("close", () => {
  if ($("editor").open) return;
  if (editorReturn?.isConnected) editorReturn.focus();
  else if (editorReturn?.closest(".row")?.dataset.id)
    [...document.querySelectorAll(".row")]
      .find((n) => n.dataset.id === editorReturn.closest(".row").dataset.id)
      ?.querySelector(".info")
      ?.focus();
  else $("profileMenu").focus();
});
for (const [id, name] of [
  ["logo", "arrow"],
  ["chevron", "chevron"],
  ["settings", "sliders"],
  ["searchIcon", "search"],
  ["targetIcon", "crosshair"],
  ["lockIcon", "lock"],
  ["refreshExtension", "refresh"],
])
  $(id).append(icon(name));
$("refreshExtension").onclick = async () => {
  const button = $("refreshExtension");
  button.disabled = true;
  try {
    await queue;
    await formpilotAPI.runtime.reload();
  } catch (e) {
    $("fillResult").textContent = "Could not refresh FormPilot. " + e.message;
    button.disabled = false;
  }
};
// A newly opened panel can outlive, or be newer than, its background script.
// Missing responses must stop filling rather than discard a selected target.
async function backgroundRequest(message) {
  const reconnect = "FormPilot could not connect to its background service. Reload or reinstall the extension, refresh the webpage, and reopen the panel.";
  let result;
  try {
    result = await formpilotAPI.runtime.sendMessage(message);
  } catch {
    throw Error(reconnect);
  }
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw Error(reconnect);
  if (result.error) throw Error(result.error);
  if (message.kind === "get-documents" && !Array.isArray(result.documents))
    throw Error(reconnect);
  return result;
}
async function trackTarget(reset = false) {
  const revision = ++targetRevision;
  if (panelWindowId === undefined)
    panelWindowId = (await formpilotAPI.windows.getCurrent()).id;
  const [tab] = await formpilotAPI.tabs.query({
    active: true,
    windowId: panelWindowId,
  });
  if (revision !== targetRevision) return;
  if (reset || tab?.id !== currentTabId) filled.clear();
  currentTabId = tab?.id;
  const result = tab?.id
    ? await backgroundRequest({
        kind: "get-owner",
        tabId: tab.id,
      })
    : {};
  if (revision !== targetRevision) return;
  owner = result.owner;
  const d = owner?.descriptor;
  $("targetName").textContent = d
    ? d.label ||
      d.accessibleName ||
      d.placeholder ||
      d.name ||
      d.id ||
      d.inputType ||
      "Selected field"
    : "Click a field on the page";
  $("targetStatus").textContent = d ? "Ready" : "No field selected";
  $("targetStatus").classList.toggle("ready", Boolean(d));
  render();
}
formpilotAPI.tabs.onActivated.addListener((info) => {
  if (info.windowId === panelWindowId)
    trackTarget(true).catch((e) => toast(e.message));
});
formpilotAPI.tabs.onUpdated.addListener((id, change) => {
  if (id === currentTabId && change.status === "loading") {
    owner = null;
    trackTarget(true).catch((e) => toast(e.message));
  }
});
formpilotAPI.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes["owner:" + currentTabId])
    trackTarget().catch((e) => toast(e.message));
});
formpilotAPI.runtime.onMessage.addListener((m) => {
  if (m.kind === "ownership-cleared" && m.tabId === currentTabId)
    trackTarget(true).catch((e) => toast(e.message));
});
const names = [
  "Links",
  "Address",
  "Personal",
  "Projects",
  "Documents",
  "Education",
  "Experience",
  "Custom",
];
const categoryHues = [216, 154, 335, 264, 36, 185, 12, 85];
function colorCategory(node, category, profile = active()) {
  const preset = names.indexOf(category.name);
  const hue =
    preset >= 0
      ? categoryHues[preset]
      : (profile.categories.indexOf(category) * 137.508 + 55) % 360;
  node.style.setProperty("--category-color", `hsl(${hue} 65% 58%)`);
}
function fresh(name = "Default") {
  const categories = names.map((name) => ({
    id: uid(),
    name,
    collapsed: false,
    entries: [],
  }));
  const p = {
    id: uid(),
    name,
    categories,
    items: [],
    groups: [],
    nameFieldsVersion: 1,
  };
  for (const [label, cat, type] of [
    ["First name", "Personal", "text"],
    ["Last name", "Personal", "text"],
    ["Email", "Personal", "text"],
    ["Phone", "Personal", "text"],
    ["Street address", "Address", "text"],
    ["City", "Address", "text"],
    ["State", "Address", "text"],
    ["Pin code", "Address", "text"],
    ["Country", "Address", "text"],
    ["Website", "Links", "url"],
    ["LinkedIn", "Links", "url"],
    ["GitHub", "Links", "url"],
    ["Portfolio", "Links", "url"],
    ["Bio", "Personal", "multiline"],
    ["Resume", "Documents", "file"],
  ]) {
    const c = categories.find((c) => c.name === cat),
      item = {
        id: uid(),
        category: c.id,
        label,
        value: "",
        type: type || "text",
      };
    p.items.push(item);
    c.entries.push({ kind: "item", id: item.id });
  }
  return p;
}
const active = () => state.profiles.find((p) => p.id === state.activeProfileId);
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 1600);
}
function serialize(job) {
  const next = queue.then(job);
  queue = next.catch(() => {});
  return next;
}
async function commit(next) {
  await formpilotAPI.storage.local.set({ formpilot: next });
  state = next;
  applyTheme();
  render();
}
function change(mutator) {
  return serialize(async () => {
    const next = structuredClone(state);
    await mutator(
      next,
      next.profiles.find((p) => p.id === next.activeProfileId),
    );
    await commit(next);
  }).catch((e) => {
    toast("Could not save. Check device storage: " + e.message);
    throw e;
  });
}
function button(label, fn, disabled = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.disabled = disabled;
  b.addEventListener("click", () =>
    Promise.resolve()
      .then(fn)
      .catch((e) => toast(e.message)),
  );
  return b;
}
function element(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function edit(title, fields, save) {
  $("dialogTitle").textContent = title;
  closePopovers();
  editorReturn = document.activeElement;
  $("editorActions").replaceChildren();
  const root = $("dialogFields");
  root.replaceChildren();
  const controls = {};
  for (const f of fields) {
    const label = element("label", f.label);
    let input;
    if (f.options) {
      input = element("select");
      for (const [value, text] of f.options) {
        const o = element("option", text);
        o.value = value;
        input.append(o);
      }
    } else input = element(f.multiline ? "textarea" : "input");
    input.setAttribute("aria-label", f.label);
    input.value = f.value ?? "";
    input.required = f.required ?? false;
    if (f.key) input.id = "edit-" + f.key;
    controls[f.key] = input;
    label.append(input);
    root.append(label);
  }
  let saving = false;
  $("editForm").onsubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    saving = true;
    const submit = $("editForm").querySelector('[type="submit"]');
    submit.disabled = true;
    const values = Object.fromEntries(
      Object.entries(controls).map(([k, v]) => [k, v.value]),
    );
    try {
      await save(values);
      $("editor").close();
    } catch (error) {
      toast(error.message);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  };
  $("editor").showModal();
  Object.values(controls)[0]?.focus();
}
$("cancel").onclick = () => $("editor").close();
function categoryOptions(p = active()) {
  return p.categories.map((c) => [c.id, c.name]);
}
function itemEditor(item, category) {
  // Keep the selected file scoped to this editor, including across async saves.
  const uploadControl = element("input");
  uploadControl.type = "file";
  uploadControl.setAttribute("aria-label", "Upload file");
  edit(
    item ? "Edit item" : "Add item",
    [
      { key: "label", label: "Label", value: item?.label, required: true },
      {
        key: "value",
        label: "Value",
        value: item?.type === "file" ? "" : item?.value,
        multiline: true,
      },
      {
        key: "type",
        label: "Type",
        value: item?.type || "text",
        options: [
          ["text", "Text"],
          ["multiline", "Multi-line"],
          ["url", "URL"],
          ["file", "File"],
        ],
      },
      {
        key: "category",
        label: "Category",
        value: item?.category || category || active().categories[0]?.id,
        options: categoryOptions(),
      },
    ],
    async (v) => {
      if (!v.category) throw Error("Create a category first.");
      const oldKey = item?.type === "file" ? item.value : null;
      const selectedFile = v.type === "file" ? uploadControl.files[0] : null;
      if (
        v.type === "file" &&
        !selectedFile &&
        !(item?.type === "file" && item.value)
      )
        throw Error("Choose a file to upload before saving.");
      await serialize(async () => {
        const stagedKey = selectedFile ? uid() : null;
        if (selectedFile)
          await putFile({
            id: stagedKey,
            blob: selectedFile,
            name: selectedFile.name,
            type: selectedFile.type,
            lastModified: selectedFile.lastModified,
          });
        try {
          const s = structuredClone(state),
            p = s.profiles.find((p) => p.id === s.activeProfileId);
          const c = p.categories.find((c) => c.id === v.category);
          if (item) {
            const current = p.items.find((i) => i.id === item.id);
            if (current.category !== v.category) {
              const group = p.groups.find((g) => g.fields.includes(item.id));
              if (group)
                throw Error("Move the project using its Move control.");
              p.categories.find((c) => c.id === current.category).entries =
                p.categories
                  .find((c) => c.id === current.category)
                  .entries.filter((e) => e.id !== item.id);
              c.entries.push({ kind: "item", id: item.id });
            }
            Object.assign(current, {
              label: v.label,
              category: v.category,
              type: v.type,
              value:
                v.type === "file"
                  ? item.type === "file"
                    ? stagedKey || item.value
                    : stagedKey || ""
                  : v.value,
            });
          } else {
            const i = {
              id: uid(),
              category: v.category,
              label: v.label,
              type: v.type,
              value: v.type === "file" ? stagedKey || "" : v.value,
            };
            p.items.push(i);
            c.entries.push({ kind: "item", id: i.id });
          }
          await commit(s);
        } catch (error) {
          if (stagedKey) await deleteFile(stagedKey);
          throw error;
        }
      });
      await refreshFiles();
      if (
        oldKey &&
        (v.type !== "file" || selectedFile) &&
        !state.profiles.some((p) =>
          p.items.some((i) => i.value === oldKey && i.type === "file"),
        )
      )
        await deleteFile(oldKey);
    },
  );
  const valueLabel = $("edit-value").parentElement;
  const uploadLabel = element("label", "Upload file");
  uploadLabel.append(uploadControl);
  const uploadHint = element(
    "p",
    item?.type === "file" && item.value
      ? `Saved file: ${fileNames.get(item.value) || "File"}. Choose a new file to replace it, then Save.`
      : "Choose your file, then press Save to keep it on this device.",
    "upload-hint",
  );
  uploadLabel.append(uploadHint);
  $("dialogFields").append(uploadLabel);
  // Uploads are staged as part of Save, so Cancel leaves files untouched.
  const updateType = () => {
    const isFile = $("edit-type").value === "file";
    valueLabel.hidden = isFile;
    uploadLabel.hidden = !isFile;
    uploadControl.disabled = !isFile;
    uploadControl.required = isFile && !(item?.type === "file" && item.value);
  };
  $("edit-type").onchange = updateType;
  updateType();
  if (item?.type === "file") uploadControl.focus();
  if (item) {
    const field = active().groups.some((g) => g.fields.includes(item.id));
    moves($("editorActions"), field ? "field" : "entry", item.id);
    sheetDrag(field ? "field" : "entry", item.id);
    const del = button("Delete", async () => {
      await removeItem(item.id);
      if (!active().items.some((i) => i.id === item.id)) $("editor").close();
    });
    del.className = "delete";
    $("editorActions").append(del);
  }
}
async function removeItem(id) {
  if (!confirm("Delete this item?")) return;
  const item = active().items.find((i) => i.id === id);
  await change((s, p) => {
    p.items = p.items.filter((i) => i.id !== id);
    p.categories.forEach(
      (c) => (c.entries = c.entries.filter((e) => e.id !== id)),
    );
    p.groups.forEach((g) => (g.fields = g.fields.filter((f) => f !== id)));
  });
  await garbage([item]);
}
async function garbage(items) {
  for (const i of items)
    if (
      i.type === "file" &&
      i.value &&
      !state.profiles.some((p) =>
        p.items.some((j) => j.type === "file" && j.value === i.value),
      )
    )
      await deleteFile(i.value).catch((e) =>
        toast("Saved, but old file cleanup failed: " + e.message),
      );
}
function reorder(kind, id, delta) {
  return change((s, p) => {
    const list =
      kind === "category"
        ? p.categories
        : kind === "field"
          ? p.groups.find((g) => g.fields.includes(id)).fields
          : p.categories.find((c) => c.entries.some((e) => e.id === id))
              .entries;
    const n = list.findIndex((e) => (typeof e === "string" ? e : e.id) === id),
      to = n + delta;
    if (to >= 0 && to < list.length) [list[n], list[to]] = [list[to], list[n]];
  });
}
function moves(parent, kind, id) {
  parent.append(
    button("Move up", () => reorder(kind, id, -1)),
    button("Move down", () => reorder(kind, id, 1)),
  );
  parent.lastChild.setAttribute("aria-label", "Move down");
  parent.children[parent.children.length - 2].setAttribute(
    "aria-label",
    "Move up",
  );
}
function sheetDrag(kind, id) {
  const handle = iconButton("grip", "Drag to reorder", () =>
    toast("Drag to a saved card, or use Move up and Move down"),
  );
  handle.draggable = true;
  handle.addEventListener("dragstart", (e) => {
    drag = { kind, id };
    e.dataTransfer.setData("text/plain", id);
    $("editor").close();
  });
  handle.addEventListener("dragend", () => {
    drag = null;
  });
  $("editorActions").prepend(handle);
}
function draggable(node, kind, id) {
  node.draggable = true;
  node.addEventListener("dragstart", (e) => {
    drag = { kind, id };
    e.dataTransfer.setData("text/plain", id);
    e.stopPropagation();
  });
  node.addEventListener("dragend", () => {
    drag = null;
  });
  node.addEventListener("dragover", (e) => {
    if (drag?.kind === kind) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
  node.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (drag?.kind !== kind || drag.id === id) return;
    const from = drag.id;
    drag = null;
    change((s, p) => {
      const list =
        kind === "category"
          ? p.categories
          : kind === "field"
            ? p.groups.find((g) => g.fields.includes(id)).fields
            : p.categories.find((c) => c.entries.some((e) => e.id === id))
                .entries;
      const n = list.findIndex(
        (e) => (typeof e === "string" ? e : e.id) === from,
      );
      if (n < 0)
        throw Error("Use Move to transfer between categories or projects.");
      const entry = list.splice(n, 1)[0],
        to = list.findIndex((e) => (typeof e === "string" ? e : e.id) === id);
      list.splice(to, 0, entry);
    });
  });
}
async function transfer(item) {
  const [tab] = await formpilotAPI.tabs.query({
    active: true,
    windowId: panelWindowId,
  });
  if (!tab?.id) throw Error("Open a webpage first.");
  if (
    /^(chrome|edge|about|chrome-extension|moz-extension|resource|view-source):/i.test(
      tab.url || "",
    ) ||
    /^https:\/\/(addons\.mozilla\.org|chromewebstore\.google\.com|chrome\.google\.com\/webstore)(?:[/?#]|$)/i.test(
      tab.url || "",
    )
  )
    throw Error(
      "Browser internal pages and add-on stores cannot be filled. Open a webpage and click a field.",
    );
  const ownership = await backgroundRequest({
    kind: "get-owner",
    tabId: tab.id,
  });
  const owner = ownership.owner;
  if (!owner) throw Error("Click on a form field first, then press the arrow");
  const message = {
    kind: "transfer",
    token: owner.token,
    requestId: uid(),
    value: item.value,
  };
  if (item.type === "file") {
    const f = await getFile(item.value);
    if (!f) throw Error("Saved file is missing. Upload it again.");
    message.file = {
      data: await encode(f.blob),
      name: f.name,
      type: f.type,
      lastModified: f.lastModified,
    };
  }
  let result;
  try {
    result = await formpilotAPI.tabs.sendMessage(
      tab.id,
      message,
      !formpilotAPI.sidebarAction && owner.documentId
        ? { documentId: owner.documentId }
        : { frameId: owner.frameId },
    );
  } catch {
    throw Error(
      "Cannot reach the field. Refresh the webpage and click a field. Browser internal pages, add-on stores and other protected pages cannot be filled; check website access in extension settings. Large files may exceed message limits.",
    );
  }
  if (!result)
    throw Error("The field’s frame navigated. Click the field again.");
  if (result.error) throw Error(result.error);
  if (tab.id === currentTabId) {
    filled.add(item.id);
    render();
  }
  toast("Filled");
}

const route = (doc) =>
  !formpilotAPI.sidebarAction && doc.documentId
    ? { documentId: doc.documentId }
    : { frameId: doc.frameId };
$("fillAutomatically").onclick = async () => {
  const button = $("fillAutomatically"),
    status = $("fillResult");
  button.disabled = true;
  button.textContent = "Filling…";
  const counts = { fields: 0, files: 0, unmatched: 0, failures: 0 };
  const explanations = new Set();
  try {
    const profile = structuredClone(active());
    const [tab] = await formpilotAPI.tabs.query({
      active: true,
      windowId: panelWindowId,
    });
    if (!tab?.id) throw Error("Open a webpage first.");
    const ownership = await backgroundRequest({
      kind: "get-owner",
      tabId: tab.id,
    });
    const selected = ownership.owner;
    let registry = await backgroundRequest({
      kind: "get-documents",
      tabId: tab.id,
    });
    if (!selected && !registry.documents.length) {
      // Open pages can predate installation/reload, or lose their registration
      // when a website navigates without replacing its document.
      try {
        const result = await formpilotAPI.tabs.sendMessage(tab.id, {
          kind: "refresh-document",
        });
        if (!result?.ok) throw Error("Document is disconnected.");
      } catch {
        if (!formpilotAPI.scripting)
          throw Error("Refresh the webpage to reconnect FormPilot, then try Fill automatically again.");
        try {
          await formpilotAPI.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            files: ["browser-api.js", "content.js"],
          });
          await formpilotAPI.tabs.sendMessage(tab.id, { kind: "refresh-document" });
        } catch {
          throw Error("Could not connect to this webpage. Open FormPilot using its toolbar icon to allow access, or refresh the webpage. Check website access in extension settings; browser internal pages and add-on stores cannot be filled.");
        }
      }
      registry = await backgroundRequest({ kind: "get-documents", tabId: tab.id });
    }
    const documents = selected ? [selected] : registry.documents;
    if (!documents?.length)
      throw Error(
        "No accessible form found. Refresh the webpage and check website access in extension settings.",
      );
    let frameCount = 0;
    for (const doc of documents) {
      try {
        const scan = await formpilotAPI.tabs.sendMessage(
          tab.id,
          {
            kind: "scan-fields",
            token: doc.token,
            selected: Boolean(selected),
          },
          route(doc),
        );
        if (!scan || scan.error)
          throw Error(
            scan?.error ||
              "Document changed. Click a field again or refresh the page.",
          );
        frameCount += scan.frameCount || 0;
        const entries = [],
          matches = new Map();
        for (const field of scan.fields.filter((f) => f.empty)) {
          const match = bulkMatch(profile, field.descriptor);
          if (!match) {
            counts.unmatched++;
            continue;
          }
          try {
            const entry = { id: field.id };
            if (match.type === "file") {
              const file = await getFile(match.value);
              if (!file)
                throw Error("Saved résumé is missing. Upload it again.");
              const accepts =
                !field.accept ||
                field.accept.split(",").some((r) => {
                  r = r.trim().toLowerCase();
                  return r.startsWith(".")
                    ? file.name.toLowerCase().endsWith(r)
                    : r.endsWith("/*")
                      ? file.type.toLowerCase().startsWith(r.slice(0, -1))
                      : file.type.toLowerCase() === r;
                });
              if (!accepts) {
                counts.unmatched++;
                continue;
              }
              entry.file = {
                data: await encode(file.blob),
                name: file.name,
                type: file.type,
                lastModified: file.lastModified,
              };
            } else entry.value = match.value;
            entries.push(entry);
            matches.set(field.id, match);
          } catch (e) {
            counts.failures++;
            explanations.add(e.message);
          }
        }
        if (entries.length) {
          const result = await formpilotAPI.tabs.sendMessage(
            tab.id,
            { kind: "batch-fill", token: doc.token, entries },
            route(doc),
          );
          if (!result?.results) {
            counts.failures += entries.length;
            explanations.add(
              "Document changed before filling. Click a field again or refresh the page.",
            );
            continue;
          }
          for (const resultEntry of result.results) {
            if (resultEntry.ok) {
              const match = matches.get(resultEntry.id);
              counts[match.type === "file" ? "files" : "fields"]++;
              if (tab.id === currentTabId && profile.id === active().id)
                match.ids.forEach((id) => filled.add(id));
            } else {
              counts.failures++;
              explanations.add(resultEntry.error);
            }
          }
        }
      } catch (e) {
        counts.failures++;
        explanations.add(
          selected
            ? "Selected document is unavailable. Click a field again or refresh the page. " +
                e.message
            : "A frame was inaccessible. Check website access or refresh the page.",
        );
      }
    }
    if (!selected && frameCount > documents.length - 1)
      explanations.add(
        "Some frames were inaccessible; only accessible documents were processed.",
      );
    status.textContent =
      `${counts.fields} fields filled · ${counts.files} files attached · ${counts.unmatched} unmatched · ${counts.failures} failures. ` +
      (!counts.fields && !counts.files
        ? "Nothing could be filled: fields may already contain values or lack a confident saved match. "
        : "") +
      [...explanations].join(" ") +
      " Click again for newly revealed fields or the next step.";
    render();
  } catch (e) {
    status.textContent = e.message;
  } finally {
    button.disabled = false;
    button.textContent = "Fill automatically";
  }
};

function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = element("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const fileNames = new Map();
function row(item, field = false) {
  const isFilled = filled.has(item.id);
  const node = element(
    "div",
    undefined,
    "row" + (isFilled ? " filled" : targetItemId === item.id ? " target" : ""),
  );
  node.dataset.id = item.id;
  const info = button("", () => itemEditor(item));
  info.className = "info";
  info.draggable = true;
  info.setAttribute("aria-label", "Edit " + item.label);
  const label = element("div", item.label, "label");
  if (isFilled) label.append(element("span", " · Filled", "filled-label"));
  info.append(
    label,
    element(
      "div",
      item.type === "file"
        ? fileNames.get(item.value) || "No file uploaded"
        : item.value.split(/\r?\n/)[0] || "No value saved",
      "preview",
    ),
  );
  node.append(info);
  const actions = element("div", undefined, "actions");
  if (item.type === "file") {
    if (!item.value) {
      const upload = iconButton("upload", "Upload " + item.label, () =>
        itemEditor(item),
      );
      upload.prepend(document.createTextNode("Upload"));
      upload.classList.add("fill", "attach");
      actions.append(upload);
    } else {
      const dl = iconButton(
        "download",
        "Download " + item.label,
        async () => {
          const f = await getFile(item.value);
          if (!f) throw Error("Saved file is missing. Upload it again.");
          download(f.blob, f.name);
        },
        !item.value,
      );
      const attach = iconButton(
        isFilled ? "check" : "arrow",
        isFilled
          ? item.label + " was filled"
          : "Attach " + item.label + " into the page",
        () => transfer(item),
        !item.value,
      );
      attach.classList.add("fill", "attach");
      attach.prepend(document.createTextNode("Attach"));
      actions.append(dl, attach);
    }
  } else {
    const copy = iconButton(
      copied.has(item.id) ? "check" : "copy",
      "Copy " + item.label,
      async () => {
        await navigator.clipboard.writeText(item.value);
        copied.add(item.id);
        copy.replaceChildren(icon("check"));
        toast("Copied");
        clearTimeout(copyTimers.get(item.id));
        copyTimers.set(
          item.id,
          setTimeout(() => {
            copied.delete(item.id);
            copyTimers.delete(item.id);
            if (copy.isConnected) copy.replaceChildren(icon("copy"));
          }, 1200),
        );
      },
      !item.value,
    );
    const fill = iconButton(
      isFilled ? "check" : "arrow",
      isFilled
        ? item.label + " was filled"
        : "Fill " + item.label + " into the page",
      () => transfer(item),
      !item.value,
    );
    fill.classList.add("fill");
    actions.append(copy, fill);
  }
  node.append(actions);
  draggable(node, field ? "field" : "entry", item.id);
  return node;
}

function moveEntry(id) {
  edit(
    "Move to category",
    [{ key: "category", label: "Destination", options: categoryOptions() }],
    (v) =>
      change((s, p) => {
        const source = p.categories.find((c) =>
            c.entries.some((e) => e.id === id),
          ),
          entry = source.entries.find((e) => e.id === id);
        source.entries = source.entries.filter((e) => e.id !== id);
        p.categories.find((c) => c.id === v.category).entries.push(entry);
        if (entry.kind === "item")
          p.items.find((i) => i.id === id).category = v.category;
        else {
          const g = p.groups.find((g) => g.id === id);
          g.category = v.category;
          g.fields.forEach(
            (id) => (p.items.find((i) => i.id === id).category = v.category),
          );
        }
      }),
  );
}
function groupNode(group, query) {
  const n = element("div", undefined, "group"),
    title = element("div", undefined, "group-title");
  const editGroup = button(group.name, () => {
    edit(
      "Edit project",
      [{ key: "name", label: "Name", value: group.name, required: true }],
      (v) =>
        change(
          (s, p) => (p.groups.find((g) => g.id === group.id).name = v.name),
        ),
    );
    moves($("editorActions"), "entry", group.id);
    sheetDrag("entry", group.id);
    $("editorActions").append(
      button("Move", () => {
        $("editor").close();
        moveEntry(group.id);
      }),
    );
    const del = button("Delete", async () => {
      if (!confirm("Delete this project and all of its fields?")) return;
      const items = active().items.filter((i) => group.fields.includes(i.id));
      await change((s, p) => {
        p.groups = p.groups.filter((g) => g.id !== group.id);
        p.items = p.items.filter((i) => !group.fields.includes(i.id));
        p.categories.forEach(
          (c) => (c.entries = c.entries.filter((e) => e.id !== group.id)),
        );
      });
      await garbage(items);
      $("editor").close();
    });
    del.className = "delete";
    $("editorActions").append(del);
  });
  editGroup.setAttribute("aria-label", "Edit project " + group.name);
  title.append(editGroup);
  n.append(title);
  draggable(n, "entry", group.id);
  for (const id of group.fields) {
    const i = active().items.find((i) => i.id === id);
    if (!query || matches(i, query) || group.name.toLowerCase().includes(query))
      n.append(row(i, true));
  }
  return n;
}

function matches(i, q) {
  return (
    i.label +
    " " +
    (i.type === "file" ? fileNames.get(i.value) || "" : i.value)
  )
    .toLowerCase()
    .includes(q);
}
function render() {
  if (!state) return;
  const p = active(),
    q = $("search").value.trim().toLowerCase();
  const focused = document.activeElement;
  const focusedItem = focused?.closest(".row")?.dataset.id;
  const focusedLabel = focused?.getAttribute("aria-label");
  if (!p.categories.some((c) => c.id === selectedCategory))
    selectedCategory = "all";
  $("profileName").textContent = p.name;
  $("profileMenu").title = p.name;
  $("profileList").replaceChildren(
    ...state.profiles.map((profile) => {
      const b = button(profile.name, async () => {
        closePopovers();
        selectedCategory = "all";
        await change((s) => (s.activeProfileId = profile.id));
      });
      b.setAttribute("aria-current", String(profile.id === p.id));
      return b;
    }),
  );
  const chipCategories = names
    .map((name) => p.categories.find((c) => c.name === name))
    .filter(Boolean);
  chipCategories.push(...p.categories.filter((c) => !names.includes(c.name)));
  $("chips").replaceChildren(
    ...[{ id: "all", name: "All" }, ...chipCategories].map((c) => {
      const b = button(c.name, () => {
        selectedCategory = c.id;
        render();
        [...$("chips").children]
          .find((b) => b.dataset.category === c.id)
          ?.focus();
      });
      b.dataset.category = c.id;
      b.className = "chip";
      if (c.id !== "all") colorCategory(b, c, p);
      b.setAttribute("aria-pressed", String(selectedCategory === c.id));
      return b;
    }),
  );
  targetItemId = bestMatch(p, owner?.descriptor)?.id;
  $("categories").replaceChildren();
  for (const c of p.categories) {
    if (selectedCategory !== "all" && selectedCategory !== c.id) continue;
    const entries = c.entries.filter(
      (e) =>
        !q ||
        (e.kind === "item"
          ? matches(
              p.items.find((i) => i.id === e.id),
              q,
            )
          : (() => {
              const g = p.groups.find((g) => g.id === e.id);
              return (
                g.name.toLowerCase().includes(q) ||
                g.fields.some((id) =>
                  matches(
                    p.items.find((i) => i.id === id),
                    q,
                  ),
                )
              );
            })()),
    );
    if (q && !entries.length) continue;
    const section = element("section");
    section.dataset.id = c.id;
    colorCategory(section, c, p);
    const head = element("div", undefined, "section-header");
    const title = button(c.name, () => categoryEditor(c));
    title.className = "section-title";
    title.setAttribute("aria-label", "Edit category " + c.name);
    head.append(
      title,
      element(
        "span",
        String(
          c.entries.reduce(
            (n, e) =>
              n +
              (e.kind === "item"
                ? 1
                : p.groups.find((g) => g.id === e.id).fields.length),
            0,
          ),
        ),
        "count",
      ),
    );
    const add = button("Add", () =>
      c.name === "Projects"
        ? $("addProject").click()
        : itemEditor(undefined, c.id),
    );
    add.prepend(icon("plus"));
    add.className = "add";
    add.setAttribute("aria-label", "Add to " + c.name);
    head.append(add);
    section.append(head);
    for (const e of entries)
      section.append(
        e.kind === "item"
          ? row(p.items.find((i) => i.id === e.id))
          : groupNode(
              p.groups.find((g) => g.id === e.id),
              q,
            ),
      );
    draggable(section, "category", c.id);
    $("categories").append(section);
  }
  if (!$("categories").children.length)
    $("categories").append(
      element(
        "p",
        q ? "No saved items match your search." : "Add a category to begin.",
        "empty",
      ),
    );
  if (focusedItem && focusedLabel)
    [...$("categories").querySelectorAll(".row")]
      .find((n) => n.dataset.id === focusedItem)
      ?.querySelector(`[aria-label="${CSS.escape(focusedLabel)}"]`)
      ?.focus();
}
function categoryEditor(c) {
  edit(
    "Edit category",
    [{ key: "name", label: "Name", value: c.name, required: true }],
    (v) =>
      change((s, p) => (p.categories.find((x) => x.id === c.id).name = v.name)),
  );
  moves($("editorActions"), "category", c.id);
  sheetDrag("category", c.id);
  const del = button("Delete", () => {
    $("editor").close();
    deleteCategory(c);
  });
  del.className = "delete";
  $("editorActions").append(del);
}

async function refreshFiles() {
  fileNames.clear();
  for (const p of state.profiles)
    for (const i of p.items)
      if (i.type === "file" && i.value) {
        const f = await getFile(i.value);
        if (f) fileNames.set(i.value, f.name);
      }
  render();
}
function deleteCategory(c) {
  if (c.entries.length) {
    const options = categoryOptions().filter(([id]) => id !== c.id);
    if (!options.length) {
      toast(
        "Create a destination category before deleting this populated category.",
      );
      return;
    }
    edit(
      "Delete category and move its entries",
      [
        {
          key: "destination",
          label: "Move all items and projects to",
          options,
        },
      ],
      (v) =>
        change((s, p) => {
          const dest = p.categories.find((x) => x.id === v.destination),
            source = p.categories.find((x) => x.id === c.id);
          dest.entries.push(...source.entries);
          p.items
            .filter((i) => i.category === c.id)
            .forEach((i) => (i.category = dest.id));
          p.groups
            .filter((g) => g.category === c.id)
            .forEach((g) => (g.category = dest.id));
          p.categories = p.categories.filter((x) => x.id !== c.id);
        }),
    );
  } else if (confirm("Delete this category?"))
    change(
      (s, p) => (p.categories = p.categories.filter((x) => x.id !== c.id)),
    );
}
$("search").oninput = render;
$("addItem").onclick = () => itemEditor();
$("addCategory").onclick = () =>
  edit("Add category", [{ key: "name", label: "Name", required: true }], (v) =>
    change((s, p) =>
      p.categories.push({
        id: uid(),
        name: v.name,
        collapsed: false,
        entries: [],
      }),
    ),
  );
$("addProject").onclick = () =>
  edit(
    "Add project",
    [
      { key: "name", label: "Project name", required: true },
      {
        key: "category",
        label: "Category",
        value: active().categories.find((c) => c.name === "Projects")?.id,
        options: categoryOptions(),
      },
    ],
    (v) =>
      change((s, p) => {
        if (!v.category) throw Error("Create a category first.");
        const g = { id: uid(), name: v.name, category: v.category, fields: [] };
        for (const label of ["Title", "Link", "Description"]) {
          const i = {
            id: uid(),
            category: v.category,
            label,
            value: "",
            type:
              label === "Link"
                ? "url"
                : label === "Description"
                  ? "multiline"
                  : "text",
          };
          p.items.push(i);
          g.fields.push(i.id);
        }
        p.groups.push(g);
        p.categories
          .find((c) => c.id === v.category)
          .entries.push({ kind: "group", id: g.id });
      }),
  );
$("manageProfiles").onclick = () =>
  edit(
    "Manage profiles",
    [
      {
        key: "action",
        label: "Action",
        options: [
          ["new", "Create"],
          ["rename", "Rename active profile"],
          ["duplicate", "Duplicate active profile"],
          ["delete", "Delete active profile"],
        ],
      },
      { key: "name", label: "Profile name", value: active().name },
    ],
    async (v) => {
      if (v.action === "delete") {
        if (state.profiles.length === 1)
          throw Error("The final profile cannot be deleted.");
        if (!confirm("Delete the active profile and its files?")) return;
        const items = active().items;
        await change((s, p) => {
          s.profiles = s.profiles.filter((x) => x.id !== p.id);
          s.activeProfileId = s.profiles[0].id;
        });
        await garbage(items);
      } else if (v.action === "duplicate")
        await duplicate(v.name || active().name + " copy");
      else {
        if (!v.name.trim()) throw Error("Enter a profile name.");
        await change((s, p) => {
          if (v.action === "rename") p.name = v.name;
          else {
            const n = fresh(v.name);
            s.profiles.push(n);
            s.activeProfileId = n.id;
          }
        });
      }
    },
  );
async function duplicate(name) {
  await serialize(async () => {
    const p = structuredClone(active()),
      staged = [];
    try {
      const map = new Map();
      for (const e of [p, ...p.categories, ...p.items, ...p.groups]) {
        map.set(e.id, uid());
      }
      p.id = map.get(p.id);
      p.name = name;
      for (const c of p.categories) {
        c.id = map.get(c.id);
        c.entries.forEach((e) => (e.id = map.get(e.id)));
      }
      for (const i of p.items) {
        i.id = map.get(i.id);
        i.category = map.get(i.category);
        if (i.type === "file" && i.value) {
          const f = await getFile(i.value);
          if (!f) throw Error("A saved file is missing.");
          const key = uid();
          await putFile({ ...f, id: key });
          staged.push(key);
          i.value = key;
        }
      }
      for (const g of p.groups) {
        g.id = map.get(g.id);
        g.category = map.get(g.category);
        g.fields = g.fields.map((id) => map.get(id));
      }
      const next = structuredClone(state);
      next.profiles.push(p);
      next.activeProfileId = p.id;
      await commit(next);
    } catch (e) {
      await Promise.all(staged.map(deleteFile));
      throw e;
    }
  });
  await refreshFiles();
}
const exportBackup = () =>
  serialize(async () => {
    const snapshot = structuredClone(state),
      files = [];
    snapshot.theme = state.theme || "system";
    for (const key of new Set(
      snapshot.profiles.flatMap((p) =>
        p.items.filter((i) => i.type === "file" && i.value).map((i) => i.value),
      ),
    )) {
      const f = await getFile(key);
      if (!f)
        throw Error("A saved file is missing. Replace it before exporting.");
      files.push({
        id: key,
        name: f.name,
        type: f.type,
        lastModified: f.lastModified,
        data: await encode(f.blob),
      });
    }
    download(
      new Blob([JSON.stringify({ ...snapshot, files }, null, 2)], {
        type: "application/json",
      }),
      "formpilot.json",
    );
    toast("Exported");
  }).catch((e) => toast("Export failed: " + e.message));
function validate(data, withFiles = true) {
  const fail = () => {
    throw Error(
      "Invalid import: unsupported version, duplicate IDs, invalid types or broken references.",
    );
  };
  if (
    !data ||
    ![1, 2].includes(data.version) ||
    !Array.isArray(data.profiles) ||
    !data.profiles.length
  )
    fail();
  if (
    (data.version === 2 || data.theme !== undefined) &&
    !["system", "light", "dark"].includes(data.theme)
  )
    fail();
  const all = new Set(),
    add = (id) => {
      if (typeof id !== "string" || !id || all.has(id)) fail();
      all.add(id);
    },
    string = (v) => {
      if (typeof v !== "string") fail();
    };
  const files = new Map(),
    referencedFiles = new Set();
  if (withFiles) {
    if (!Array.isArray(data.files)) fail();
    for (const f of data.files) {
      add(f.id);
      string(f.name);
      string(f.type);
      if (!Number.isFinite(f.lastModified)) fail();
      files.set(f.id, {
        ...f,
        blob: new Blob([decode(f.data)], { type: f.type }),
      });
    }
  }
  for (const p of data.profiles) {
    add(p.id);
    string(p.name);
    if (p.nameFieldsVersion !== undefined && p.nameFieldsVersion !== 1) fail();
    if (
      !Array.isArray(p.categories) ||
      !Array.isArray(p.items) ||
      !Array.isArray(p.groups)
    )
      fail();
    const cats = new Map(),
      items = new Map(),
      groups = new Map(),
      used = new Set();
    for (const c of p.categories) {
      add(c.id);
      string(c.name);
      if (typeof c.collapsed !== "boolean" || !Array.isArray(c.entries)) fail();
      cats.set(c.id, c);
    }
    for (const i of p.items) {
      add(i.id);
      string(i.label);
      string(i.value);
      if (
        !["text", "multiline", "url", "file"].includes(i.type) ||
        !cats.has(i.category) ||
        (withFiles && i.type === "file" && i.value && !files.has(i.value))
      )
        fail();
      if (i.type === "file" && i.value) referencedFiles.add(i.value);
      items.set(i.id, i);
    }
    for (const g of p.groups) {
      add(g.id);
      string(g.name);
      if (!cats.has(g.category) || !Array.isArray(g.fields)) fail();
      groups.set(g.id, g);
      for (const id of g.fields) {
        if (
          used.has(id) ||
          !items.has(id) ||
          items.get(id).category !== g.category
        )
          fail();
        used.add(id);
      }
    }
    const groupUsed = new Set();
    for (const c of p.categories)
      for (const e of c.entries) {
        if (e.kind === "item") {
          if (
            !items.has(e.id) ||
            used.has(e.id) ||
            items.get(e.id).category !== c.id
          )
            fail();
          used.add(e.id);
        } else if (e.kind === "group") {
          if (
            !groups.has(e.id) ||
            groupUsed.has(e.id) ||
            groups.get(e.id).category !== c.id
          )
            fail();
          groupUsed.add(e.id);
        } else fail();
      }
    if (used.size !== items.size || groupUsed.size !== groups.size) fail();
  }
  if (!data.profiles.some((p) => p.id === data.activeProfileId)) fail();
  if (withFiles && files.size !== referencedFiles.size) fail();
  return files;
}
$("import").onclick = () => $("importFile").click();
$("importFile").onchange = async () => {
  const input = $("importFile"),
    file = input.files[0];
  input.value = "";
  if (!file) return;
  let committed = false;
  try {
    const data = JSON.parse(await file.text()),
      files = validate(data);
    if (
      !confirm(
        "Import will replace ALL profiles and their saved files. Continue?",
      )
    )
      return;
    await serialize(async () => {
      const staged = [],
        old = state.profiles.flatMap((p) => p.items);
      try {
        const mapping = new Map();
        for (const [id, f] of files) {
          const key = uid();
          await putFile({
            id: key,
            blob: f.blob,
            name: f.name,
            type: f.type,
            lastModified: f.lastModified,
          });
          staged.push(key);
          mapping.set(id, key);
        }
        for (const p of data.profiles)
          for (const i of p.items)
            if (i.type === "file" && i.value) i.value = mapping.get(i.value);
        const imported = convertLegacy(data);
        await commit({
          version: 2,
          theme: imported.theme,
          activeProfileId: imported.activeProfileId,
          profiles: imported.profiles,
        });
        filled.clear();
        committed = true;
      } catch (e) {
        await Promise.all(staged.map(deleteFile));
        throw e;
      }
      await garbage(old);
    });
    await refreshFiles();
    toast("All profiles imported");
  } catch (e) {
    toast(
      (committed
        ? "Import saved, but file display could not refresh: "
        : "Import failed; existing profiles preserved: ") + e.message,
    );
  }
};
window.addEventListener("unhandledrejection", (e) => {
  e.preventDefault();
  toast(e.reason?.message || "Operation failed.");
});
formpilotAPI.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.formpilot) {
    if (!changes.formpilot.newValue) return;
    state = changes.formpilot.newValue;
    applyTheme();
    refreshFiles().catch((e) => toast(e.message));
  }
});
for (const [id, action, title] of [
  ["newProfile", "new", "Add profile"],
  ["renameProfile", "rename", "Rename profile"],
  ["duplicateProfile", "duplicate", "Duplicate profile"],
  ["deleteProfile", "delete", "Delete profile"],
]) {
  $(id).onclick = () => {
    $("manageProfiles").click();
    $("edit-action").value = action;
    $("edit-action").parentElement.hidden = true;
    $("dialogTitle").textContent = title;
    if (action === "new") $("edit-name").value = "";
    if (action === "duplicate") $("edit-name").value = active().name + " copy";
    if (action === "delete") $("edit-name").parentElement.hidden = true;
  };
}
$("export").onclick = exportBackup;
$("resetExport").onclick = exportBackup;
$("theme").onchange = () => change((s) => (s.theme = $("theme").value));
$("reset").onclick = () => {
  closePopovers();
  $("resetDialog").showModal();
};
async function cancelReset() {
  if (state.version === 1) await change((s) => (s.resetPromptSeen = true));
  $("resetDialog").close();
}
$("resetCancel").onclick = () => cancelReset().catch((e) => toast(e.message));
$("resetDialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  cancelReset().catch((e) => toast(e.message));
});
$("resetConfirm").onclick = () =>
  serialize(async () => {
    const old = state.profiles.flatMap((p) => p.items),
      p = fresh();
    await commit({
      version: 2,
      theme: state.theme || "system",
      activeProfileId: p.id,
      profiles: [p],
    });
    filled.clear();
    selectedCategory = "all";
    $("resetDialog").close();
    await garbage(old);
    await refreshFiles();
    toast("Started fresh");
  }).catch((e) =>
    toast("Reset failed; existing profiles preserved: " + e.message),
  );
$("manageCategories").onclick = () => {
  edit(
    "Manage categories",
    [{ key: "category", label: "Category", options: categoryOptions() }],
    (v) => {
      setTimeout(
        () =>
          categoryEditor(active().categories.find((c) => c.id === v.category)),
        0,
      );
    },
  );
};
try {
  const saved = (await formpilotAPI.storage.local.get("formpilot")).formpilot;
  if (saved) {
    validate(saved, false);
    state = saved;
    if (saved.profiles.some((p) => p.nameFieldsVersion !== 1))
      await commit(migrateNames(saved));
    else applyTheme();
  } else {
    const p = fresh();
    await commit({
      version: 2,
      theme: "system",
      activeProfileId: p.id,
      profiles: [p],
    });
  }
  await refreshFiles();
  await trackTarget();
  if (state.version === 1 && !state.resetPromptSeen)
    $("resetDialog").showModal();
} catch (e) {
  toast("Storage unavailable or data invalid: " + e.message);
  document
    .querySelectorAll("button,input,select")
    .forEach((e) => (e.disabled = true));
}
