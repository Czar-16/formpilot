// Shared by classic content/background scripts and module-based panel scripts.
// Firefox's browser namespace provides Promise-based APIs; Chrome MV3 does too.
globalThis.formpilotAPI = globalThis.browser ?? globalThis.chrome;
