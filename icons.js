const paths = {
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6.1a8 8 0 0 1 13.3 3.4M4.6 14.5a8 8 0 0 0 13.3 3.4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sliders:
    '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  crosshair:
    '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  moon: '<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  grip: '<path d="M7 8h10M7 12h10M7 16h10"/>',
};
export function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute(
    "stroke-width",
    name === "check"
      ? "2.5"
      : ["arrow", "plus"].includes(name)
        ? "2.25"
        : "1.75",
  );
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = paths[name];
  return svg;
}
