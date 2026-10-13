# FormPilot: DESIGN.md

The visual spec for the FormPilot Chrome extension side panel. Build the UI to match this file exactly. Every value below comes from the approved mockup (light and dark themes). If a value is not listed here, pick the closest value on the scales below. Do not invent new colours, radii or font sizes.

Only the **side panel** is part of the extension. The mockup also showed a fake browser bar and a job-application page on its left. That is context only and must not be built.

---

## 1. Design principles

1. **One-tap actions.** Every saved item is a card with two buttons: **Copy** (quiet) and **Fill →** (the single loud, accent-coloured button).
2. **The arrow is the hero.** It is the only solid accent-filled control in a row, so the eye finds it instantly.
3. **State is visible.** Three row states (idle, target, filled) are told apart by background, border and button, never by colour alone.
4. **Calm and compact.** Soft cards, generous 44px touch targets, small uppercase labels, monospace values.
5. **Local and private.** The footer always says: "All data is stored only on this device".

---

## 2. Theming

Light and dark are both required. Implement with CSS custom properties on `:root`.

- Default follows the system: `@media (prefers-color-scheme: dark)`.
- The settings menu offers **System / Light / Dark**. The choice is stored in `chrome.storage.local` and applied with `data-theme="light|dark"` on `<html>`, which overrides the media query.
- All colours in the UI must come from the tokens below. No hard-coded hex values in components.

### 2.1 Colour tokens

| Token (CSS variable) | Light                           | Dark                     | Used for                                                        |
| -------------------- | ------------------------------- | ------------------------ | --------------------------------------------------------------- |
| `--panel-bg`         | `#F8F9FB`                       | `#080B12`                | Panel background                                                |
| `--card`             | `#FFFFFF`                       | `#10151F`                | Item cards, profile pill, inactive chips                        |
| `--surface`          | `#EEF0F4`                       | `#181F2C`                | Search box, Copy button, count pills                            |
| `--border`           | `#E4E7ED`                       | `#283142`                | All 1px / 1.5px borders and dividers                            |
| `--text`             | `#14161A`                       | `#F3F4F7`                | Primary text, values                                            |
| `--muted`            | `#5C6270`                       | `#A5ABB8`                | Labels, secondary text, icons                                   |
| `--accent`           | `#4F46E5`                       | `#8B93FF`                | Fill (arrow) buttons, active chip, logo mark, target row border |
| `--on-accent`        | `#FFFFFF`                       | `#0D0E13`                | Text/icons on accent                                            |
| `--accent-text`      | `#4338CA`                       | `#B0B5FF`                | Accent-coloured text ("+ Add", target icon)                     |
| `--accent-tint`      | `#EEF0FF`                       | `#171C35`                | Target row and target box background                            |
| `--accent-ring`      | `rgba(79,70,229,0.22)`          | `rgba(139,147,255,0.32)` | Glow around the target row's arrow                              |
| `--success`          | `#0F7B4F`                       | `#5FD39A`                | Check button, "Filled" text, Ready dot                          |
| `--on-success`       | `#FFFFFF`                       | `#08160E`                | Icon on success button                                          |
| `--success-tint`     | `#EAF7F0`                       | `#102219`                | Filled row background                                           |
| `--success-border`   | `#BFE6D1`                       | `#235A40`                | Filled row border                                               |
| `--card-shadow`      | `0 1px 2px rgba(20,22,26,0.05)` | `none`                   | Idle cards only                                                 |

Text/background pairs above are chosen to meet WCAG AA (4.5:1). Do not lighten `--muted`.

### 2.2 CSS starter

```css
:root {
  --panel-bg: #f8f9fb;
  --card: #ffffff;
  --surface: #eef0f4;
  --border: #e4e7ed;
  --text: #14161a;
  --muted: #5c6270;
  --accent: #4f46e5;
  --on-accent: #ffffff;
  --accent-text: #4338ca;
  --accent-tint: #eef0ff;
  --accent-ring: rgba(79, 70, 229, 0.22);
  --success: #0f7b4f;
  --on-success: #ffffff;
  --success-tint: #eaf7f0;
  --success-border: #bfe6d1;
  --card-shadow: 0 1px 2px rgba(20, 22, 26, 0.05);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* dark values */
  }
}
:root[data-theme="dark"] {
  /* dark values */
}
```

Dark values are the Dark column of the table in 2.1. Both blocks must contain the same values.

---

## 3. Typography

| Role   | Font               | Notes                                                                |
| ------ | ------------------ | -------------------------------------------------------------------- |
| UI     | **Manrope**        | weights 400, 500, 600, 700, 800                                      |
| Values | **JetBrains Mono** | weights 400, 500. Used for saved values (URLs, pin code, file names) |

**Bundle the fonts inside the extension** (`fonts/*.woff2`, loaded with `@font-face`). Extension pages cannot rely on Google Fonts, and the extension makes no network requests. Both fonts are open-licence (OFL). If the files cannot be downloaded, fall back to `system-ui, sans-serif` and `ui-monospace, monospace`, and say so in the README.

### Type scale (px / weight)

| Use                                  | Size | Weight         | Extras                                      |
| ------------------------------------ | ---- | -------------- | ------------------------------------------- |
| App title "FormPilot"                | 18   | 800            | letter-spacing -0.015em                     |
| Target field name                    | 15   | 800            | letter-spacing -0.005em                     |
| Search input, body                   | 14   | 400            |                                             |
| Profile pill, "+ Add", Attach, chips | 13   | 600 to 700     |                                             |
| Saved value (mono)                   | 13   | 400            | single line, ellipsis                       |
| Section title                        | 12   | 800            | UPPERCASE, letter-spacing 0.08em, `--muted` |
| Row label                            | 11   | 700            | UPPERCASE, letter-spacing 0.05em, `--muted` |
| Count pill, "Ready", small hints     | 11   | 700 (hint 600) |                                             |
| Footer                               | 12   | 400            | `--muted`                                   |

---

## 4. Spacing, radius, sizes

- Spacing scale: 4, 6, 8, 10, 12, 14, 16, 20.
- Panel horizontal gutter: **16px**. Designed at 380px wide; must be fluid down to 320px.
- Radii: cards and target box **14**, buttons **12**, search box **12**, logo mark **10**, chips and pills **18** (fully round), count pill **8**.
- **Touch targets: 44 x 44px minimum** for Copy, Fill, Attach, Download and "+ Add". Chips and the profile pill are 36px tall.
- Icons: stroke style, `stroke-width` 1.75 (quiet), 2.25 (Fill arrow, "+"), 2.5 (check, logo arrow); `stroke-linecap` and `stroke-linejoin` round; `fill:none`; colour `currentColor`. Mark decorative icons `aria-hidden="true"`.

---

## 5. Layout (top to bottom)

```
┌──────────────────────────────┐
│ Header                  64px │
│ Search                  44px │
│ Category chips          36px │
│ Target box              ~60px│
│ ───── scrollable list ────── │
│   LINKS (4)            + Add │
│   [card] [card] [card]       │
│   ADDRESS (3)          + Add │
│   [card] [card] [card]       │
│   DOCUMENTS (1)        + Add │
│   [resume card]              │
│ ──────────────────────────── │
│ Privacy footer          44px │
└──────────────────────────────┘
```

Only the list scrolls. Header, search, chips, target box and footer stay fixed.

---

## 6. Components

### 6.1 Header

- Height 64, padding 0 16, `justify-content: space-between`.
- Left: logo mark 32x32, radius 10, background `--accent`, white arrow icon (18px, stroke 2.5, path `M5 12h14M13 6l6 6-6 6`). 10px gap, then "FormPilot" (18/800).
- Right (8px gap):
  - **Profile pill**: height 36, radius 18, padding 0 12, 1px `--border`, background `--card`, text 13/600 (the profile name, e.g. "Frontend jobs") plus a 14px chevron-down. Opens a menu to switch, add, duplicate and rename profiles.
  - **Settings button**: 36x36 circle, 1px `--border`, background `--card`, sliders icon 16px. Opens settings: theme (System/Light/Dark), export JSON, import JSON.

### 6.2 Search

- Wrapper padding 0 16 12.
- Box: height 44, radius 12, background `--surface`, 1px `--border`, padding 0 14, gap 10. Magnifier icon 18px in `--muted`. Real `<input>` (14px, transparent, no outline on the box itself; show a 2px `--accent` focus ring on `:focus-within`). Placeholder: "Search saved items". `aria-label="Search saved items"`.
- Filters items by label or value as you type.

### 6.3 Category chips

- Row padding 0 16 12, gap 8, horizontally scrollable, scrollbar hidden.
- Chip: height 36, padding 0 14, radius 18, 13/700.
  - Active: background `--accent`, text `--on-accent`, border `--accent`.
  - Inactive: background `--card`, text `--text`, 1px `--border`.
- Order: **All, Links, Address, Personal, Projects, Documents** (then user-made categories). "All" is selected by default. Selecting a chip shows only that category.

### 6.4 Target box ("Arrow will fill into")

- Margin 0 16 8, padding 12 14, radius 14, background `--accent-tint`, row layout, gap 12.
- Left tile: 32x32, radius 10, background `--card`, crosshair icon 18px in `--accent-text`.
- Middle: small label "Arrow will fill into" (11/600, `--muted`) over the field name (15/800, `--text`), for example "GitHub URL". Take the name from the field's label, `aria-label`, placeholder or `name`.
- Right: 8px round dot plus "Ready" (11/700) in `--success`.
- No field remembered yet: dot and text turn `--muted`, text "No field selected", name line says "Click a field on the page".

### 6.5 Section header

- Height 44, padding 0 8 0 20.
- Title (12/800, uppercase, `--muted`) plus a count pill (11/700, `--muted`, background `--surface`, radius 8, padding 2 7).
- Right: "+ Add" button, height 44, padding 0 12, no background, `--accent-text`, 13/700, plus icon 14px (stroke 2.25). Adds an item to this section.

### 6.6 Item card (the main component)

Container: margin 0 16 8, padding 10 10 10 14, min-height 64, radius 14, border **1.5px**, row layout, gap 6, `align-items: center`.

- **Text block** (`flex:1; min-width:0`):
  - Label line: 11/700 uppercase `--muted`. For the filled state, append " · Filled" in `--success` after the label.
  - Value: JetBrains Mono 13, `--text`, one line with ellipsis, margin-top 3. Multi-line values (bio) show only their first line truncated.
- **Copy button**: 44x44, radius 12, 1px `--border`, background `--surface`, copy icon 18px (stroke 1.75) in `--text`. `aria-label="Copy {label}"`.
- **Fill button**: 44x44, radius 12, no border, background `--accent`, icon `--on-accent`, arrow 20px (stroke 2.25). `aria-label="Fill {label} into the page"`.
- **Filled check**: replaces the Fill button, 44x44, radius 12, background `--success`, icon `--on-success`, check 20px (stroke 2.5). `aria-label="{label} was filled"`. It is still clickable and fills again.

Three row states:

| State  | Background       | Border (1.5px)     | Shadow          | Fill button                                   |
| ------ | ---------------- | ------------------ | --------------- | --------------------------------------------- |
| Idle   | `--card`         | `--border`         | `--card-shadow` | accent arrow                                  |
| Target | `--accent-tint`  | `--accent`         | none            | accent arrow + `0 0 0 3px var(--accent-ring)` |
| Filled | `--success-tint` | `--success-border` | none            | green check, label shows "· Filled"           |

- **Target** = the item whose label best matches the currently remembered page field (match on label, name, id, placeholder, `autocomplete`; for example a field called "GitHub URL" highlights the GitHub row). If nothing matches, no row is in the target state.
- **Filled** = the item was filled on this tab. It stays until the page navigates or the tab changes.
- Clicking the text block (not the buttons) opens the Edit sheet (see 6.9).

### 6.7 Documents card (resume)

Same card shell. Text block: label "RESUME", value is the file name (mono, ellipsis). Buttons: **Download** (44x44, same style as Copy, download icon) and **Attach** (height 44, padding 0 14, radius 12, `--accent` background, "Attach" 13/700 plus arrow 18px). No Copy button on file items.

### 6.8 Footer

Height 44, 1px top border `--border`, centred, gap 8, 12px `--muted`. Lock icon 14px plus "All data is stored only on this device".

### 6.9 Components not in the mockup (derive from the tokens)

- **Toast** ("Copied", "Filled", "Click on a form field first, then press the arrow"): centred above the footer, background `--text`, text `--panel-bg`, radius 10, padding 10 14, 13/700, visible 1.6s, with a fade. Use `role="status"` so screen readers announce it.
- **Edit sheet** (add and edit an item): bottom sheet, background `--card`, 1px `--border` top and sides, radius 20 20 0 0, padding 16. Fields use the Search box style (44 high, radius 12, `--surface`). Primary "Save" button uses the Fill button colours at height 44. "Delete" is a text button in `#D92D20` (light) or `#FF8A80` (dark). Include a drag handle for reordering and a category picker.
- **Menus** (profile switcher, settings): popover background `--card`, 1px `--border`, radius 14, 8px padding, rows 44px high, 14px text.

---

## 7. States and interaction

- **Focus-visible** (keyboard): 2px outline `--accent`, 2px offset, on every button, chip and input. Never remove it.
- **Hover**: buttons lighten or darken by about 6 percent. Cards get a slightly stronger `--border`.
- **Pressed**: scale 0.97 for 80ms.
- **Fill button feedback**: show the green check state on the card and a "Filled" toast. On the page, the filled field gets a 2px outline `#0F7B4F` with a `0 0 0 3px rgba(15,123,79,0.16)` glow for about 800ms.
- **Copy button feedback**: the icon swaps to a check for 1.2s and a "Copied" toast appears.
- Respect `prefers-reduced-motion` by disabling the fade and scale.

---

## 8. Accessibility checklist

- Real `<button>`, `<input>` and `<label>` elements. Do not put click handlers on `<div>`.
- Every icon-only button has an `aria-label`.
- Colour is never the only signal: the filled state also adds the check icon and the "Filled" text.
- All text meets WCAG AA contrast in both themes.
- The whole panel is operable by keyboard (Tab order: profile, settings, search, chips, then each row's Copy and Fill).

---

## 9. Icon reference (24x24 viewBox, stroke, round caps and joins)

| Icon               | Path data                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Arrow (fill)       | `M5 12h14M13 6l6 6-6 6`                                                                                |
| Copy               | `<rect x="9" y="9" width="11" height="11" rx="2"/>` + `M5 15V6a2 2 0 0 1 2-2h9`                        |
| Check              | `M5 12.5l4.5 4.5L19 7.5`                                                                               |
| Search             | `<circle cx="11" cy="11" r="6"/>` + `M20 20l-4.2-4.2`                                                  |
| Chevron down       | `M6 9l6 6 6-6`                                                                                         |
| Plus               | `M12 5v14M5 12h14`                                                                                     |
| Sliders (settings) | `M4 7h10M18 7h2M4 17h2M10 17h10` + `<circle cx="16" cy="7" r="2"/>` + `<circle cx="8" cy="17" r="2"/>` |
| Crosshair (target) | `<circle cx="12" cy="12" r="3"/>` + `M12 3v3M12 18v3M3 12h3M18 12h3`                                   |
| Download           | `M12 4v11M7 11l5 5 5-5M5 20h14`                                                                        |
| Lock               | `<rect x="5" y="11" width="14" height="9" rx="2"/>` + `M8 11V8a4 4 0 0 1 8 0v3`                        |

Do not use emoji or an icon font. Inline SVG only.

---

## 10. Do not

- Do not use gradients, glassmorphism, coloured left-border cards or drop shadows heavier than `--card-shadow`.
- Do not use more than one filled accent button per row.
- Do not add colours, fonts or radii outside this file.
- Do not make the panel wider than the browser's side panel allows. It must stay usable at 320px.
