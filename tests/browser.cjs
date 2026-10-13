// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict"),
  http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const root = path.resolve(__dirname, "..");
(async () => {
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (e, data) => {
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".woff2")
              ? "font/woff2"
              : "text/html",
      );
      res.writeHead(e ? 404 : 200);
      res.end(e ? "Missing" : data);
    });
  });
  await new Promise((r) => server.listen(8765, r));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "formpilot-test-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      ...(process.env.CHROME_PATH
        ? { executablePath: process.env.CHROME_PATH }
        : {}),
      args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
    });
    const errors = [];
    context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker"));
    const id = worker.url().split("/")[2],
      panel = await context.newPage();
    const network = [];
    panel.on("request", (r) => {
      if (/^https?:/.test(r.url())) network.push(r.url());
    });
    await panel.goto(`chrome-extension://${id}/sidepanel.html`);
    await panel.waitForSelector(".row");
    assert.equal(await panel.locator(".row").count(), 15);
    assert.equal(await panel.locator("#categories > section").count(), 8);
    const saved = () =>
      panel.evaluate(
        async () => (await chrome.storage.local.get("formpilot")).formpilot,
      );
    const clickHidden = (id) =>
      panel.evaluate((id) => document.getElementById(id).click(), id);
    async function saveDialog() {
      await panel.locator("#editForm button[type=submit]").click();
      await panel.waitForFunction(
        () => !document.getElementById("editor").open,
      );
    }
    async function manage(action, name) {
      await clickHidden("manageProfiles");
      await panel.getByLabel("Action", { exact: true }).selectOption(action);
      if (name)
        await panel.getByLabel("Profile name", { exact: true }).fill(name);
      await saveDialog();
    }
    await panel
      .getByRole("button", { name: "Edit First name", exact: true })
      .click();
    await panel.getByLabel("Value", { exact: true }).fill("Ada Lovelace");
    await saveDialog();
    assert.equal(
      (await saved()).profiles[0].items.find((i) => i.label === "First name")
        .value,
      "Ada Lovelace",
    );
    await panel.locator("#search").fill("Ada");
    assert.equal(await panel.locator(".row").count(), 1);
    await panel.getByRole("button", { name: "Links", exact: true }).click();
    assert.equal(await panel.locator(".row").count(), 0);
    await panel.getByRole("button", { name: "All", exact: true }).click();
    await panel.locator("#search").fill("");
    await panel
      .getByRole("button", { name: "Copy First name", exact: true })
      .click();
    await panel.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Copy First name"] path')
          ?.getAttribute("d") === "M5 12.5l4.5 4.5L19 7.5",
    );
    await panel.waitForTimeout(1250);
    assert.match(
      await panel.getByRole("button", { name: "Copy First name" }).innerHTML(),
      /rect/,
    );
    await panel.waitForTimeout(450);
    assert.equal(
      await panel
        .locator("#toast")
        .evaluate((e) => e.classList.contains("show")),
      false,
    );
    await clickHidden("addProject");
    await panel.getByLabel("Project name").fill("Engine");
    await saveDialog();
    assert.deepEqual(
      (await saved()).profiles[0].items.slice(-3).map((i) => i.type),
      ["text", "url", "multiline"],
    );
    assert.equal(await panel.locator(".group .row").count(), 3);
    const first = (await saved()).profiles[0].categories[0].id;
    await panel.getByRole("button", { name: "Edit category Links" }).click();
    await panel.getByRole("button", { name: "Move down", exact: true }).click();
    await panel.waitForTimeout(100);
    assert.equal((await saved()).profiles[0].categories[1].id, first);
    await panel.locator("#cancel").click();
    // Real drag ordering in the same category.
    const linkIds = (await saved()).profiles[0].categories
      .find((c) => c.id === first)
      .entries.map((e) => e.id);
    await panel
      .locator(`[data-id="${linkIds[0]}"]`)
      .dragTo(panel.locator(`[data-id="${linkIds[2]}"]`));
    await panel.waitForTimeout(100);
    assert.equal(
      (await saved()).profiles[0].categories.find((c) => c.id === first)
        .entries[0].id,
      linkIds[1],
    );
    await clickHidden("addCategory");
    await panel.getByLabel("Name", { exact: true }).fill("Temporary");
    await saveDialog();
    const temp = (await saved()).profiles[0].categories.find(
      (c) => c.name === "Temporary",
    );
    await clickHidden("addItem");
    await panel.getByLabel("Label", { exact: true }).fill("Temporary item");
    await panel
      .getByLabel("Value", { exact: true })
      .fill("<script>alert(1)</script>");
    await panel.getByLabel("Category", { exact: true }).selectOption(temp.id);
    await saveDialog();
    assert.equal(await panel.locator("#categories script").count(), 0);
    await panel
      .getByRole("button", { name: "Edit category Temporary" })
      .click();
    await panel.getByRole("button", { name: "Delete", exact: true }).click();
    await panel
      .getByLabel("Move all items and projects to")
      .selectOption(first);
    await saveDialog();
    assert.equal(
      (await saved()).profiles[0].items.find(
        (i) => i.label === "Temporary item",
      ).category,
      first,
    );
    panel.once("dialog", (d) => d.accept());
    await panel.getByRole("button", { name: "Edit Temporary item" }).click();
    await panel.getByRole("button", { name: "Delete", exact: true }).click();
    await panel.waitForTimeout(100);
    assert.equal(
      (await saved()).profiles[0].items.some(
        (i) => i.label === "Temporary item",
      ),
      false,
    );
    await panel
      .getByRole("button", { name: "Upload Resume", exact: true })
      .click();
    await panel.locator("#editForm button[type=submit]").click();
    assert.equal(await panel.locator("#editor").evaluate((e) => e.open), true);
    await panel.getByLabel("Upload file", { exact: true }).setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nresume fixture\n%%EOF"),
    });
    await saveDialog();
    await panel.getByText("resume.pdf", { exact: true }).waitFor();
    const originalResumeKey = (await saved()).profiles[0].items.find(
      (i) => i.label === "Resume",
    ).value;
    const fileDownload = panel.waitForEvent("download");
    await panel
      .getByRole("button", { name: "Download Resume", exact: true })
      .click();
    assert.equal(
      fs.readFileSync(await (await fileDownload).path(), "utf8"),
      "%PDF-1.7\nresume fixture\n%%EOF",
    );
    await panel
      .getByRole("button", { name: "Edit Resume", exact: true })
      .click();
    await saveDialog();
    assert.equal(
      (await saved()).profiles[0].items.find((i) => i.label === "Resume").value,
      originalResumeKey,
    );
    await panel
      .getByRole("button", { name: "Edit Resume", exact: true })
      .click();
    await panel.getByLabel("Upload file", { exact: true }).setInputFiles({
      name: "resume.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("saved file"),
    });
    await saveDialog();
    await panel.getByText("resume.txt", { exact: true }).waitFor();
    assert.equal(
      await panel.evaluate(async (key) => {
        const { getFile } = await import("./db.js");
        return (await getFile(key)) === undefined;
      }, originalResumeKey),
      true,
    );
    const beforeCancel = await saved();
    await panel
      .getByRole("button", { name: "Edit Resume", exact: true })
      .click();
    await panel.getByLabel("Upload file", { exact: true }).setInputFiles({
      name: "canceled.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("canceled"),
    });
    await panel.locator("#cancel").click();
    assert.deepEqual(await saved(), beforeCancel);
    await panel.reload();
    await panel.getByText("resume.txt", { exact: true }).waitFor();
    await clickHidden("manageProfiles");
    await panel.getByLabel("Action", { exact: true }).selectOption("delete");
    await panel.locator("#editForm button[type=submit]").click();
    await panel
      .getByText("The final profile cannot be deleted.", { exact: true })
      .waitFor();
    await panel.locator("#cancel").click();
    await manage("duplicate", "Copy");
    assert.equal((await saved()).profiles.length, 2);
    let collection = await saved();
    assert.notEqual(
      ...collection.profiles.map(
        (p) => p.items.find((i) => i.type === "file").value,
      ),
    );
    await manage("new", "Another");
    assert.equal((await saved()).profiles.length, 3);
    assert.equal((await saved()).profiles.at(-1).items.length, 15);
    await manage("rename", "Renamed");
    assert.equal((await saved()).profiles.at(-1).name, "Renamed");
    panel.once("dialog", (d) => d.accept());
    await manage("delete");
    assert.equal((await saved()).profiles.length, 2);
    collection = await saved();
    const exp = panel.waitForEvent("download");
    await clickHidden("export");
    const exported = JSON.parse(
      fs.readFileSync(await (await exp).path(), "utf8"),
    );
    assert.equal(exported.version, 2);
    assert.equal(exported.files.length, 2);
    let acceptImport = false;
    panel.on("dialog", (d) => (acceptImport ? d.accept() : d.dismiss()));
    async function importData(data) {
      await panel.locator("#importFile").setInputFiles({
        name: "test.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(data)),
      });
      await panel.waitForTimeout(150);
    }
    await importData(exported);
    assert.deepEqual(await saved(), collection);
    acceptImport = true;
    await importData(exported);
    await panel.getByText("All profiles imported", { exact: true }).waitFor();
    collection = await saved();
    const badTheme = structuredClone(exported);
    badTheme.theme = "invalid";
    await importData(badTheme);
    assert.deepEqual(await saved(), collection);
    const invalid = structuredClone(exported);
    invalid.profiles[0].categories[0].entries.push({
      kind: "item",
      id: "missing",
    });
    await importData(invalid);
    assert.deepEqual(await saved(), collection);
    await panel.evaluate(() => {
      window.originalSet = chrome.storage.local.set;
      chrome.storage.local.set = async () => {
        throw Error("Simulated quota failure");
      };
    });
    await importData(exported);
    assert.deepEqual(await saved(), collection);
    assert.equal(
      await panel.evaluate(async () => {
        const { database } = await import("./db.js");
        const db = await database();
        return new Promise((resolve) => {
          const tx = db.transaction("files");
          const r = tx.objectStore("files").count();
          r.onsuccess = () => resolve(r.result);
          tx.oncomplete = () => db.close();
        });
      }),
      2,
    );
    await clickHidden("reset");
    await clickHidden("resetConfirm");
    await panel.waitForTimeout(100);
    assert.deepEqual(await saved(), collection);
    assert.equal(
      await panel.locator("#resetDialog").evaluate((e) => e.open),
      true,
    );
    await panel.evaluate(() => (chrome.storage.local.set = window.originalSet));
    await clickHidden("resetCancel");
    assert.deepEqual(await saved(), collection);
    const v1 = structuredClone(exported);
    v1.version = 1;
    delete v1.theme;
    v1.profiles.forEach((p) =>
      p.items.forEach((i) => {
        if (i.type !== "file") i.type = "text";
      }),
    );
    await importData(v1);
    assert.equal((await saved()).version, 2);
    assert.equal(
      (await saved()).profiles[0].items.find((i) => i.label === "GitHub").type,
      "url",
    );
    // Existing-install confirmation: cancel once, retain values, retry and reset.
    const old = await saved();
    old.version = 1;
    delete old.theme;
    await panel.evaluate(
      (old) => chrome.storage.local.set({ formpilot: old }),
      old,
    );
    await panel.reload();
    await panel.locator("#resetDialog[open]").waitFor();
    await clickHidden("resetCancel");
    assert.equal(
      (await saved()).profiles[0].items.find((i) => i.label === "First name")
        .value,
      "Ada Lovelace",
    );
    await panel.reload();
    await panel.waitForSelector(".row");
    assert.equal(
      await panel.locator("#resetDialog").evaluate((e) => e.open),
      false,
    );
    await clickHidden("reset");
    await clickHidden("resetConfirm");
    await panel.waitForTimeout(150);
    assert.equal((await saved()).profiles.length, 1);
    assert.equal((await saved()).profiles[0].items.length, 15);
    for (const [label, value] of [
      ["GitHub", "https://github.com/ada"],
      ["First name", "Ada Lovelace"],
    ]) {
      await panel
        .getByRole("button", { name: "Edit " + label, exact: true })
        .click();
      await panel.getByLabel("Value", { exact: true }).fill(value);
      await saveDialog();
    }
    const web = await context.newPage();
    await web.goto("http://localhost:8765/tests/fixture.html");
    const tabId = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      return tabs[0].id;
    });
    async function transfer(value, file) {
      return panel.evaluate(
        async ({ tabId, value, file }) => {
          const { owner } = await chrome.runtime.sendMessage({
            kind: "get-owner",
            tabId,
          });
          return chrome.tabs.sendMessage(tabId, {
            kind: "transfer",
            token: owner.token,
            requestId: crypto.randomUUID(),
            value,
            file,
          });
        },
        { tabId, value, file },
      );
    }
    await web.locator("#github").focus();
    await panel.waitForFunction(
      () => document.getElementById("targetName").textContent === "GitHub URL",
    );
    assert.equal(
      await panel.locator(".row.target .label").textContent(),
      "GitHub",
    );
    assert.equal(await panel.locator("#targetStatus").textContent(), "Ready");
    const descriptor = await worker.evaluate(
      async (tabId) =>
        (await chrome.storage.session.get("owner:" + tabId))["owner:" + tabId]
          .descriptor,
      tabId,
    );
    assert.deepEqual(
      Object.keys(descriptor).sort(),
      [
        "accessibleName",
        "autocomplete",
        "id",
        "inputType",
        "label",
        "name",
        "placeholder",
      ].sort(),
    );
    await web.locator("#github").evaluate((e) => {
      e.style.setProperty("outline", "1px dotted red", "important");
      e.style.setProperty("box-shadow", "0 0 2px blue", "important");
    });
    await panel.evaluate(() =>
      document
        .querySelector('[aria-label="Fill GitHub into the page"]')
        .click(),
    );
    await panel.waitForSelector(".row.filled");
    assert.equal(
      await web.locator("#github").inputValue(),
      "https://github.com/ada",
    );
    assert.equal(await panel.locator(".row.target").count(), 0);
    assert.match(
      await panel.locator(".row.filled .label").textContent(),
      /Filled/,
    );
    await panel.evaluate(() =>
      document.querySelector('[aria-label="GitHub was filled"]').click(),
    );
    await web.waitForTimeout(850);
    assert.deepEqual(
      await web
        .locator("#github")
        .evaluate((e) => [
          e.style.outline,
          e.style.getPropertyPriority("outline"),
          e.style.boxShadow,
          e.style.getPropertyPriority("box-shadow"),
        ]),
      ["red dotted 1px", "important", "blue 0px 0px 2px", "important"],
    );
    await web.locator("#postal").focus();
    await panel.waitForFunction(
      () =>
        document.querySelector(".row.target .label")?.textContent ===
        "Pin code",
    );
    assert.equal(await panel.locator(".row.filled").count(), 1);
    await web.locator("#text").focus();
    await panel.waitForTimeout(100);
    assert.equal(await panel.locator(".row.target").count(), 0);
    assert.equal((await transfer("Ada")).ok, true);
    assert.equal(await web.locator("#text").inputValue(), "Ada");
    await panel.bringToFront();
    await panel.waitForTimeout(100);
    assert.equal(await panel.locator(".row.filled").count(), 0);
    await panel.evaluate(() =>
      document
        .querySelector('[aria-label="Fill GitHub into the page"]')
        .click(),
    );
    await panel.waitForFunction(() =>
      /Chrome internal pages|Click on a form field first/.test(
        document.getElementById("toast").textContent,
      ),
    );
    assert.equal((await transfer("Repeated")).ok, true);
    assert.equal(await web.locator("#text").inputValue(), "Repeated");
    await web.waitForTimeout(850);
    assert.equal(
      await web.locator("#text").evaluate((e) => e.style.outline),
      "",
    );
    await web.locator("#notes").focus();
    assert.equal((await transfer("Notes")).ok, true);
    await web.locator("#select").focus();
    assert.equal((await transfer("beta")).ok, true);
    assert.equal(await web.locator("#select").inputValue(), "b");
    assert.match((await transfer("missing")).error, /No enabled option/);
    await web.locator("#editable").focus();
    assert.equal((await transfer("New bio")).ok, true);
    assert.equal(await web.locator("#editable").textContent(), "New bio");
    await web.locator("#shadow-input").focus();
    assert.equal((await transfer("Shadow")).ok, true);
    assert.equal(await web.locator("#shadow-input").inputValue(), "Shadow");
    await web.bringToFront();
    for (const frame of web.frames().slice(1)) {
      await frame.locator("#frame-input").focus();
      await panel.waitForTimeout(100);
      assert.equal((await transfer("Frame " + frame.url())).ok, true);
      assert.equal(
        await frame.locator("#frame-input").inputValue(),
        "Frame " + frame.url(),
      );
    }
    await web.locator("#text").focus();
    assert.match(
      (
        await transfer("", {
          name: "a.txt",
          type: "text/plain",
          lastModified: 1,
          data: "YQ==",
        })
      ).error,
      /upload control/,
    );
    await web.locator("#file").evaluate((e) => e.focus());
    assert.equal(
      (
        await transfer("", {
          name: "a.txt",
          type: "text/plain",
          lastModified: 1,
          data: "YQ==",
        })
      ).ok,
      true,
    );
    assert.equal(
      await web.locator("#file").evaluate((e) => e.files[0].name),
      "a.txt",
    );
    assert.match(
      (
        await transfer("", {
          name: "a.pdf",
          type: "application/pdf",
          lastModified: 1,
          data: "YQ==",
        })
      ).error,
      /does not accept/,
    );
    await web.locator("#number").focus();
    assert.match((await transfer("not a number")).error, /required format/);
    assert.equal(await web.locator("#number").inputValue(), "42");
    await web.locator("#readonly").focus();
    assert.match((await transfer("x")).error, /read-only/);
    await web.locator("#text").focus();
    await web.locator("#text").evaluate((e) => e.remove());
    assert.match((await transfer("x")).error, /removed/);
    await web.reload();
    await web.waitForTimeout(100);
    assert.equal(
      await worker.evaluate(
        async (tabId) =>
          (await chrome.storage.session.get("owner:" + tabId))[
            "owner:" + tabId
          ],
        tabId,
      ),
      undefined,
    );
    await web.goto("http://localhost:8765/tests/react.html");
    await web.locator("#react-name").focus();
    assert.equal((await transfer("React Ada")).ok, true);
    await web.waitForFunction(
      () => document.getElementById("react-value").textContent === "React Ada",
    );
    await web.locator("#react-render").click();
    assert.equal(await web.locator("#react-name").inputValue(), "React Ada");
    await panel.waitForFunction(
      () =>
        document.querySelector(".row.target .label")?.textContent ===
        "First name",
    );
    await panel.evaluate(() =>
      document
        .querySelector('[aria-label="Fill First name into the page"]')
        .click(),
    );
    await panel.waitForSelector(".row.filled");
    await web.reload();
    await panel.waitForTimeout(150);
    assert.equal(await panel.locator(".row.filled").count(), 0);
    // Window ownership: activity in a second window must not steer the first panel.
    const secondPanelPromise = context.waitForEvent("page");
    const secondWindow = await worker.evaluate(
      (url) => chrome.windows.create({ url, focused: true }),
      `chrome-extension://${id}/sidepanel.html`,
    );
    const secondPanel = await secondPanelPromise;
    await secondPanel.waitForSelector(".row");
    const secondWebPromise = context.waitForEvent("page");
    await worker.evaluate(
      (windowId) =>
        chrome.tabs.create({
          windowId,
          url: "http://localhost:8765/tests/fixture.html",
          active: true,
        }),
      secondWindow.id,
    );
    const secondWeb = await secondWebPromise;
    await secondWeb.waitForSelector("#postal");
    await secondWeb.locator("#postal").focus();
    await secondPanel.waitForFunction(
      () => document.getElementById("targetName").textContent === "Postal code",
    );
    assert.equal(
      await panel.locator("#targetName").textContent(),
      "Click a field on the page",
    );
    await web.bringToFront();
    await web.locator("#react-name").focus();
    await panel.waitForFunction(
      () => document.getElementById("targetName").textContent === "Full name",
    );
    assert.equal(
      await secondPanel.locator("#targetName").textContent(),
      "Postal code",
    );
    await web.locator('#react-name').fill('');
    await web.locator('#react-name').evaluate(e => e.setAttribute('autocomplete','given-name'));
    await secondWeb.bringToFront();
    await panel.evaluate(() => document.getElementById('fillAutomatically').click());
    await panel.waitForFunction(() => document.getElementById('fillResult').textContent.includes('fields filled'));
    assert.equal(await web.locator('#react-name').inputValue(), 'Ada Lovelace');
    assert.equal(await secondWeb.locator('#full-name').inputValue(), '');
    await worker.evaluate(
      (windowId) => chrome.windows.remove(windowId),
      secondWindow.id,
    );
    await require('./bulk.cjs')({
      panel: source => panel.evaluate(source => new Function('return (async()=>{' + source + '})()')(), source),
      page: source => web.evaluate(source => new Function(source)(), source),
      navigate: async file => {await web.goto('http://localhost:8765/tests/' + file); await web.waitForTimeout(150);}
    });
    // Exercise the actual one-click button with no selected field and active search.
    await web.goto("http://localhost:8765/tests/bulk.html"); await web.waitForTimeout(150);
    await require('./reconnect.cjs')(source => panel.evaluate(source => new Function('return (async()=>{' + source + '})()')(), source));
    await web.reload(); await web.waitForTimeout(150);
    await require('./background-response.cjs')(source => panel.evaluate(source => new Function('return (async()=>{' + source + '})()')(), source));
    await panel.locator('#search').fill('no saved matches');
    await panel.evaluate(() => document.getElementById('fillAutomatically').click());
    await panel.waitForFunction(() => document.getElementById('fillResult').textContent.includes('fields filled'));
    assert.equal(await web.locator('#first').inputValue(), 'Ada Lovelace');
    assert.equal(await web.locator('#email').inputValue(), 'existing@example.org');
    await panel.locator('#search').fill('');
    await panel.emulateMedia({ colorScheme: "dark" });
    await panel.setViewportSize({ width: 320, height: 800 });
    assert.equal(
      await panel.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const tokens = [
      ...fs
        .readFileSync(path.join(root, "DESIGN.md"), "utf8")
        .matchAll(/^\|\s*`(--[\w-]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`/gm),
    ];
    assert.equal(tokens.length, 16);
    for (const width of [320, 380, 640]) {
      await panel.setViewportSize({ width, height: 800 });
      for (const theme of ["system", "light", "dark"]) {
        await panel.evaluate((theme) => {
          document.getElementById("theme").value = theme;
          document.getElementById("theme").dispatchEvent(new Event("change"));
        }, theme);
        await panel.waitForTimeout(100);
        await panel.locator("#search").focus();
        const search = await panel.evaluate(() => {
          const input = document.getElementById("search");
          const box = input.closest(".search-box");
          const i = input.getBoundingClientRect(), b = box.getBoundingClientRect();
          return { height: b.height, outline: getComputedStyle(input).outlineStyle,
            ring: getComputedStyle(box).outlineWidth,
            padding: getComputedStyle(input).padding, fits: i.top >= b.top && i.bottom <= b.bottom && i.right <= b.right };
        });
        assert.equal(search.height, 44);
        assert.equal(search.outline, "none");
        assert.equal(search.ring, "2px");
        assert.equal(search.padding, "0px");
        assert.equal(search.fits, true);
        await panel.locator("#search").fill("no such saved item 92837");
        assert.equal(await panel.locator(".row").count(), 0);
        await panel.locator("#search").fill("");
        await panel.locator("#search").evaluate((e) => e.blur());
        assert.equal(await panel.locator(".search-box").evaluate((e) => getComputedStyle(e).outlineStyle), "none");
        const categoryColors = await panel
          .locator("#categories > section")
          .evaluateAll((sections) =>
            sections.map(
              (section) => getComputedStyle(section).backgroundColor,
            ),
          );
        assert.equal(new Set(categoryColors).size, categoryColors.length);
        assert.equal(
          await panel.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        assert.equal(
          await panel.evaluate(() =>
            getComputedStyle(document.documentElement)
              .getPropertyValue("--accent")
              .trim()
              .toUpperCase(),
          ),
          theme === "light" ? "#4F46E5" : "#8B93FF",
        );
        for (const [, token, light, dark] of tokens) {
          const value = await panel.evaluate(
            (token) =>
              getComputedStyle(document.documentElement)
                .getPropertyValue(token)
                .trim(),
            token,
          );
          assert.equal(
            value.toLowerCase().replace(/\s/g, ""),
            (theme === "light" ? light : dark).toLowerCase().replace(/\s/g, ""),
            token,
          );
        }
        assert.equal(
          await panel.evaluate(() =>
            getComputedStyle(document.documentElement)
              .getPropertyValue("--delete")
              .trim()
              .toUpperCase(),
          ),
          theme === "light" ? "#D92D20" : "#FF8A80",
        );
        assert.equal(
          await panel
            .locator("footer")
            .evaluate((e) => e.getBoundingClientRect().bottom),
          800,
        );
        await panel.locator("#categories").evaluate((e) => (e.scrollTop = 200));
        assert.equal(
          await panel
            .locator("header")
            .evaluate((e) => e.getBoundingClientRect().top),
          0,
        );
        await panel.locator("#categories").evaluate((e) => (e.scrollTop = 0));
        assert.equal(await panel.locator('#fillAutomatically').evaluate(e=>e.getBoundingClientRect().height),44);
        assert.equal(await panel.locator('#fillAutomatically').getAttribute('aria-describedby'),'fillResult');
        await panel.locator('#fillAutomatically').focus();
        assert.equal(await panel.locator('#fillAutomatically').evaluate(e=>document.activeElement===e),true);
        fs.mkdirSync(path.join(root,'release/screenshots'),{recursive:true});
        await panel.screenshot({path:path.join(root,'release/screenshots',`chrome-${theme}-${width}.png`)});
        await panel.screenshot({
          path: path.join(os.tmpdir(), `formpilot-${theme}-${width}.png`),
        });
      }
    }
    await panel.getByRole("button", { name: "Switch to light mode" }).click();
    await panel.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    assert.equal((await saved()).theme, "light");
    await panel.reload();
    await panel.getByRole("button", { name: "Switch to dark mode" }).waitFor();
    assert.equal(await panel.locator("#theme").inputValue(), "light");
    await panel.getByRole("button", { name: "Switch to dark mode" }).click();
    await panel.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    assert.equal((await saved()).theme, "dark");
    assert.equal(
      await panel.evaluate(async () => {
        await document.fonts.ready;
        return (
          [...document.fonts].filter((f) => f.status === "loaded").length >=
            2 &&
          document.fonts.check("800 18px Manrope") &&
          document.fonts.check('400 13px "JetBrains Mono"')
        );
      }),
      true,
    );
    await panel
      .getByRole("button", { name: "Edit GitHub", exact: true })
      .click();
    await panel.locator("#cancel").click();
    assert.equal(
      await panel.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      ),
      "Edit GitHub",
    );
    assert.equal(
      await panel
        .locator("button:not([hidden])")
        .evaluateAll(
          (nodes) =>
            nodes.filter(
              (n) => !n.textContent.trim() && !n.getAttribute("aria-label"),
            ).length,
        ),
      0,
    );
    await panel.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await panel
        .locator("#toast")
        .evaluate((e) => getComputedStyle(e).transitionDuration),
      "0s",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(network, []);
    console.log(
      "PASS: defaults, CRUD, ordering, files, profiles, v1/v2 import/export and rollback, reset cancellation/failure, matching, filled/copy feedback, native/React/select/contenteditable/shadow/iframe filling, uploads, navigation, two-window ownership, all theme tokens, fonts, fixed 320/380px layouts, keyboard focus, reduced motion and no network requests.",
    );
  } finally {
    await context?.close();
    await new Promise((r) => server.close(r));
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
