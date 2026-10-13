// Chrome loads the adapter in its worker; Firefox loads it first via scripts.
if (typeof importScripts === "function") importScripts("browser-api.js");
if (formpilotAPI.sidebarAction) {
  // Call synchronously while the toolbar/keyboard user gesture is active.
  formpilotAPI.action.onClicked.addListener(() => {
    formpilotAPI.sidebarAction.open().catch(console.error);
  });
} else {
  formpilotAPI.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);
}
formpilotAPI.commands.onCommand.addListener((command, tab) => {
  if (command !== "open-panel") return;
  if (formpilotAPI.sidebarAction)
    formpilotAPI.sidebarAction.open().catch(console.error);
  else if (tab?.windowId !== undefined)
    formpilotAPI.sidePanel
      .open({ windowId: tab.windowId })
      .catch(console.error);
});
let ownershipWrites = Promise.resolve();
function enqueueOwnership(job) {
  const next = ownershipWrites.then(job);
  ownershipWrites = next.catch(() => {});
  return next;
}
formpilotAPI.runtime.onMessage.addListener((message, sender, reply) => {
  if (
    ["register-document", "unregister-document", "get-documents"].includes(
      message.kind,
    )
  ) {
    enqueueOwnership(async () => {
      const tabId =
        message.kind === "get-documents" ? message.tabId : sender.tab?.id;
      if (tabId === undefined) throw Error("Document tab is unavailable.");
      const key = "documents:" + tabId;
      const stored = await formpilotAPI.storage.session.get(key);
      const documents = stored[key] || {};
      if (message.kind === "get-documents")
        return { documents: Object.values(documents) };
      if (message.kind === "register-document")
        documents[sender.frameId] = {
          frameId: sender.frameId,
          token: message.token,
          ...(sender.documentId ? { documentId: sender.documentId } : {}),
        };
      else if (documents[sender.frameId]?.token === message.token) {
        delete documents[sender.frameId];
        const ownerKey = "owner:" + tabId;
        const saved = await formpilotAPI.storage.session.get(ownerKey);
        if (saved[ownerKey]?.token === message.token)
          await formpilotAPI.storage.session.remove(ownerKey);
      }
      await formpilotAPI.storage.session.set({ [key]: documents });
      return { ok: true };
    }).then(reply, (e) => reply({ error: e.message }));
    return true;
  }
  if (message.kind === "focus-owner" && sender.tab) {
    enqueueOwnership(() =>
      formpilotAPI.storage.session.set({
        ["owner:" + sender.tab.id]: {
          frameId: sender.frameId,
          token: message.token,
          ...(sender.documentId ? { documentId: sender.documentId } : {}),
          descriptor: message.descriptor,
        },
      }),
    ).then(
      () => reply({ ok: true }),
      (e) => reply({ error: e.message }),
    );
    return true;
  }
  if (message.kind === "clear-owner" && sender.tab) {
    enqueueOwnership(async () => {
      const key = "owner:" + sender.tab.id,
        result = await formpilotAPI.storage.session.get(key);
      if (result[key]?.token === message.token) {
        await formpilotAPI.storage.session.remove(key);
        formpilotAPI.runtime
          .sendMessage({ kind: "ownership-cleared", tabId: sender.tab.id })
          .catch(() => {});
      }
    }).then(
      () => reply({ ok: true }),
      (e) => reply({ error: e.message }),
    );
    return true;
  }
  if (message.kind === "get-owner") {
    enqueueOwnership(() =>
      formpilotAPI.storage.session.get("owner:" + message.tabId),
    ).then(
      (result) => reply({ owner: result["owner:" + message.tabId] }),
      (e) => reply({ error: e.message }),
    );
    return true;
  }
});
formpilotAPI.tabs.onRemoved.addListener((id) =>
  enqueueOwnership(() =>
    formpilotAPI.storage.session.remove(["owner:" + id, "documents:" + id]),
  ),
);
formpilotAPI.tabs.onUpdated.addListener((id, change) => {
  if (change.status === "loading")
    enqueueOwnership(async () => {
      await formpilotAPI.storage.session.remove([
        "owner:" + id,
        "documents:" + id,
      ]);
      formpilotAPI.runtime
        .sendMessage({ kind: "ownership-cleared", tabId: id })
        .catch(() => {});
    });
});
