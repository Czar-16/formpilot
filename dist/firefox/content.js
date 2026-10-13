(() => {
  const token = crypto.randomUUID();
  let target;
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
    formpilotAPI.runtime.sendMessage({ kind: "clear-owner", token }).catch(() => {});
  });
  function descriptor(e) {
    const root = e.getRootNode();
    const labelled = (e.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .map((id) => labelText(root.getElementById?.(id)))
      .join(" ")
      .trim();
    return {
      label: [...(e.labels || [])]
        .map((l) => labelText(l))
        .join(" ")
        .slice(0, 500),
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
      formpilotAPI.runtime
        .sendMessage({ kind: "focus-owner", token, descriptor: descriptor(e) })
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
  formpilotAPI.runtime.onMessage.addListener((m, sender, reply) => {
    if (m.kind !== "transfer" || m.token !== token) return;
    try {
      if (!target)
        throw Error("Click on a form field first, then press the arrow");
      if (!target.isConnected)
        throw Error("That field was removed. Click a form field again.");
      if (target.matches(":disabled") || target.readOnly)
        throw Error("This field is disabled or read-only.");
      let e = target;
      if (m.file) {
        const bytes = Uint8Array.from(atob(m.file.data), (c) =>
            c.charCodeAt(0),
          ),
          file = new File([bytes], m.file.name, {
            type: m.file.type,
            lastModified: m.file.lastModified,
          });
        if (!(e instanceof HTMLInputElement && e.type === "file")) {
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
          [
            "number",
            "date",
            "datetime-local",
            "month",
            "time",
            "week",
          ].includes(e.type) &&
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
      reply({ ok: true, requestId: m.requestId });
    } catch (error) {
      reply({ error: error.message, requestId: m.requestId });
    }
    return true;
  });
})();
