(() => {
  // On-demand injection must not add duplicate listeners to live documents.
  if (globalThis.formpilotContentLoaded) return;
  globalThis.formpilotContentLoaded = true;
  const token = crypto.randomUUID();
  let target;
  const candidates = new Map();
  // Reloading the extension invalidates scripts in existing tabs. Chrome can
  // throw synchronously here; an async wrapper lets callers handle that failure
  // with the same rejection handlers used for messaging errors.
  async function sendMessage(message) {
    return formpilotAPI.runtime.sendMessage(message);
  }
  const register = () =>
    sendMessage({ kind: "register-document", token })
      .catch(() => {});
  register();
  window.addEventListener("pageshow", register);
  const compatible = (e) =>
    e instanceof Element &&
    e.matches(
      'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
    );
  function labelText(node) {
    if (!node || node.matches?.("input,textarea,select,[contenteditable]"))
      return "";
    return [...node.childNodes]
      .map((child) =>
        child.nodeType === Node.TEXT_NODE
          ? child.textContent
          : labelText(child),
      )
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  window.addEventListener("pagehide", () => {
    sendMessage({ kind: "unregister-document", token })
      .catch(() => {});
  });
  function nearbyLabel(e) {
    // Legacy forms often put a short caption and <br> before each control.
    // Stay within the same parent and never cross another field or field group.
    for (let node = e.previousSibling; node; node = node.previousSibling) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (
          compatible(node) ||
          node.querySelector("input,textarea,select,[contenteditable]") ||
          !node.matches("span,b,strong,em,i,small,br,label")
        )
          return "";
        if (node.matches("label[for]") && node.htmlFor !== e.id) return "";
      }
      const text = (node.nodeType === Node.TEXT_NODE
        ? node.textContent
        : labelText(node)).replace(/\s+/g, " ").trim();
      if (!/[\p{L}\p{N}]/u.test(text)) continue;
      return text.length <= 120 ? text : "";
    }
    return "";
  }
  function descriptor(e) {
    const root = e.getRootNode();
    const labelled = (e.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .map((id) => labelText(root.getElementById?.(id)))
      .join(" ")
      .trim();
    const label = [...(e.labels || [])]
        .map((l) => labelText(l))
        .join(" ")
        .trim();
    return {
      label: (label || (!labelled && !e.getAttribute("aria-label") &&
        !e.getAttribute("placeholder") ? nearbyLabel(e) : "")).slice(0, 500),
      accessibleName: (labelled || e.getAttribute("aria-label") || "").slice(
        0,
        500,
      ),
      placeholder: (e.getAttribute("placeholder") || "").slice(0, 500),
      name: (e.getAttribute("name") || "").slice(0, 500),
      id: e.id.slice(0, 500),
      autocomplete: e.getAttribute("autocomplete") || "",
      inputType:
        e.type ||
        (e.isContentEditable ? "contenteditable" : e.tagName.toLowerCase()),
    };
  }
  function remember(event) {
    let e = event.composedPath().find(compatible);
    if (!e) {
      e = document.activeElement;
      while (e?.shadowRoot?.activeElement) e = e.shadowRoot.activeElement;
    }
    if (compatible(e)) {
      target = e;
      sendMessage({ kind: "focus-owner", token, descriptor: descriptor(e) })
        .catch(() => {});
    }
  }
  document.addEventListener("focusin", remember, true);
  document.addEventListener(
    "click",
    (e) => {
      if (e.composedPath().some(compatible)) remember(e);
    },
    true,
  );
  const highlights = new WeakMap();
  function highlight(e) {
    let saved = highlights.get(e);
    if (saved) clearTimeout(saved.timer);
    else
      saved = {
        outline: e.style.getPropertyValue("outline"),
        outlinePriority: e.style.getPropertyPriority("outline"),
        offset: e.style.getPropertyValue("outline-offset"),
        offsetPriority: e.style.getPropertyPriority("outline-offset"),
        shadow: e.style.getPropertyValue("box-shadow"),
        shadowPriority: e.style.getPropertyPriority("box-shadow"),
      };
    e.style.setProperty("outline", "2px solid #0F7B4F", "important");
    e.style.setProperty("outline-offset", "2px", "important");
    e.style.setProperty(
      "box-shadow",
      "0 0 0 3px rgba(15,123,79,0.16)",
      "important",
    );
    saved.timer = setTimeout(() => {
      e.style.setProperty("outline", saved.outline, saved.outlinePriority);
      e.style.setProperty("outline-offset", saved.offset, saved.offsetPriority);
      e.style.setProperty("box-shadow", saved.shadow, saved.shadowPriority);
      highlights.delete(e);
    }, 800);
    highlights.set(e, saved);
  }
  function events(e, blur = false) {
    e.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
    if (blur) e.dispatchEvent(new Event("blur", { bubbles: true }));
  }
  function accepts(input, file) {
    return (
      !input.accept ||
      input.accept.split(",").some((rule) => {
        rule = rule.trim().toLowerCase();
        return rule.startsWith(".")
          ? file.name.toLowerCase().endsWith(rule)
          : rule.endsWith("/*")
            ? file.type.toLowerCase().startsWith(rule.slice(0, -1))
            : file.type.toLowerCase() === rule;
      })
    );
  }
  function visible(e) {
    if (
      !e?.isConnected ||
      e.ownerDocument !== document ||
      e.matches(":disabled") ||
      e.readOnly
    )
      return false;
    for (
      let node = e;
      node instanceof Element;
      node = node.parentElement || node.getRootNode().host
    ) {
      const style = getComputedStyle(node);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        node.hasAttribute("hidden") ||
        node.hasAttribute("inert")
      )
        return false;
    }
    return e.getClientRects().length > 0;
  }
  function supported(e) {
    return (
      compatible(e) &&
      (e.matches("input,textarea,select") || e.isContentEditable) &&
      !(
        e instanceof HTMLInputElement &&
        [
          "hidden",
          "password",
          "checkbox",
          "radio",
          "button",
          "submit",
          "reset",
          "image",
          "color",
          "range",
        ].includes(e.type)
      ) &&
      !(
        e.isContentEditable &&
        e.parentElement?.closest(
          '[contenteditable]:not([contenteditable="false"])',
        )
      )
    );
  }
  const empty = (e) =>
    e.type === "file"
      ? !e.files.length
      : e instanceof HTMLSelectElement
        ? [...e.selectedOptions].every((o) => o.value === "")
        : !(e.isContentEditable ? e.textContent : e.value).trim();
  const owningForm = (e) => e.form || e.closest("form");
  function scan(root, found = [], frames = []) {
    for (const e of root.querySelectorAll("*")) {
      if (supported(e) && visible(e)) found.push(e);
      if (e.matches("iframe,frame")) frames.push(e);
      if (e.shadowRoot) scan(e.shadowRoot, found, frames);
    }
    return found;
  }
  function write(e, m, automatic = false) {
    if (automatic && (!supported(e) || !visible(e) || !empty(e)))
      throw Error("Field changed or is no longer empty and writable.");
    if (!e) throw Error("Click on a form field first, then press the arrow");
    if (!e.isConnected)
      throw Error("That field was removed. Click a form field again.");
    if (e.matches(":disabled") || e.readOnly)
      throw Error("This field is disabled or read-only.");

    if (m.file) {
      const bytes = Uint8Array.from(atob(m.file.data), (c) => c.charCodeAt(0)),
        file = new File([bytes], m.file.name, {
          type: m.file.type,
          lastModified: m.file.lastModified,
        });
      if (!(e instanceof HTMLInputElement && e.type === "file")) {
        if (automatic) throw Error("Choose a résumé upload control.");
        const candidates = [
          ...(e.form?.querySelectorAll("input[type=file]") || []),
        ].filter((i) => !i.matches(":disabled") && accepts(i, file));
        if (candidates.length !== 1)
          throw Error("Click the upload control, then press Attach.");
        e = candidates[0];
      }
      if (!accepts(e, file))
        throw Error("This upload control does not accept this file type.");
      const dt = new DataTransfer();
      dt.items.add(file);
      e.files = dt.files;
      events(e);
    } else if (e instanceof HTMLSelectElement) {
      const options = [...e.options].filter(
        (o) => !o.disabled && !o.parentElement.disabled,
      );
      const option =
        options.find((o) => o.value === m.value || o.text === m.value) ||
        options.find(
          (o) =>
            o.value.toLowerCase() === m.value.toLowerCase() ||
            o.text.toLowerCase() === m.value.toLowerCase(),
        );
      if (!option) throw Error("No enabled option matches this value.");
      e.value = option.value;
      events(e, true);
    } else if (e.isContentEditable) {
      e.focus();
      const range = document.createRange();
      range.selectNodeContents(e);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      if (!document.execCommand("insertText", false, m.value)) {
        e.textContent = m.value;
        events(e);
      } else e.dispatchEvent(new Event("change", { bubbles: true }));
      e.dispatchEvent(new Event("blur", { bubbles: true }));
    } else if (
      e instanceof HTMLTextAreaElement ||
      (e instanceof HTMLInputElement &&
        ![
          "file",
          "checkbox",
          "radio",
          "button",
          "submit",
          "reset",
          "image",
          "hidden",
          "color",
          "range",
        ].includes(e.type))
    ) {
      const proto =
        e instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      const previous = e.value;
      setter.call(e, m.value);
      if (
        e instanceof HTMLInputElement &&
        ["number", "date", "datetime-local", "month", "time", "week"].includes(
          e.type,
        ) &&
        m.value &&
        !e.value
      ) {
        setter.call(e, previous);
        throw Error(
          `This ${e.type} field cannot accept that value. Save a value in the field’s required format.`,
        );
      }
      events(e, true);
    } else throw Error("This field cannot receive text.");
    highlight(e);
    return { ok: true, requestId: m.requestId };
  }
  formpilotAPI.runtime.onMessage.addListener((m, sender, reply) => {
    if (m.kind === "refresh-document") {
      sendMessage({ kind: "register-document", token })
        .then((result) => reply(result), (error) => reply({ error: error.message }));
      return true;
    }
    if (
      !["transfer", "scan-fields", "batch-fill"].includes(m.kind) ||
      m.token !== token
    )
      return;
    try {
      if (m.kind === "scan-fields") {
        if (
          m.selected &&
          (!target?.isConnected || target.ownerDocument !== document)
        )
          throw Error(
            "Selected field is stale. Click a field again or refresh the page.",
          );
        candidates.clear();
        const frames = [];
        const selectedForm = m.selected ? owningForm(target) : null;
        const fields = scan(document, [], frames)
          .filter((e) => !selectedForm || owningForm(e) === selectedForm)
          .map((e) => {
            const id = crypto.randomUUID();
            candidates.set(id, e);
            return {
              id,
              descriptor: descriptor(e),
              empty: empty(e),
              accept: e.type === "file" ? e.accept : undefined,
            };
          });
        reply({
          fields,
          frameCount: m.selected ? 0 : frames.length,
        });
      } else if (m.kind === "batch-fill") {
        const results = m.entries.map((entry) => {
          try {
            const e = candidates.get(entry.id);
            if (!e) throw Error("Field expired. Fill again.");
            write(e, entry, true);
            return { id: entry.id, ok: true };
          } catch (error) {
            return { id: entry.id, error: error.message };
          }
        });
        reply({ results });
      } else reply(write(target, m));
    } catch (error) {
      reply({ error: error.message, requestId: m.requestId });
    }
    return true;
  });
})();
