// Keep the page hidden until its locally stored theme has been applied.
try {
  const { formpilot } = await formpilotAPI.storage.local.get("formpilot");
  if (["light", "dark"].includes(formpilot?.theme))
    document.documentElement.dataset.theme = formpilot.theme;
} catch {
  /* Startup reports storage errors in the panel. */
}
document.documentElement.classList.add("theme-ready");
