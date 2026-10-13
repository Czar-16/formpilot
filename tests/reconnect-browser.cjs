// Simulate a webpage opened before extension installation: no static content script.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
(async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'formpilot-reconnect-'));
  const extension = path.join(temporary, 'extension');
  fs.mkdirSync(extension);
  for (const name of ['background.js', 'browser-api.js', 'content.js', 'sidepanel.html',
    'sidepanel.css', 'sidepanel.js', 'theme.js', 'model.js', 'icons.js', 'db.js', 'fonts', 'icons'])
    fs.cpSync(path.join(root, name), path.join(extension, name), {recursive:true});
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  manifest.content_scripts = [];
  // Grant the test site's access, equivalent to opening the toolbar action's activeTab grant.
  manifest.host_permissions = ['http://localhost/*'];
  fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<label>First name<input id="first" autocomplete="given-name"></label>' +
      '<label>Email<input id="email" value="existing@example.org"></label>');
  });
  let context;
  try {
    await new Promise(resolve => server.listen(0, resolve));
    context = await chromium.launchPersistentContext(path.join(temporary, 'profile'), {
      headless:true,
      ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),
      args:[`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = worker.url().split('/')[2];
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${id}/sidepanel.html`);
    await panel.waitForSelector('.row');
    await panel.evaluate(async () => {
      const {formpilot} = await chrome.storage.local.get('formpilot');
      formpilot.profiles[0].items.find(item => item.label === 'First name').value = 'Ada';
      await chrome.storage.local.set({formpilot});
    });
    await panel.reload();
    await panel.waitForSelector('.row');
    const webpage = await context.newPage();
    await webpage.goto(`http://localhost:${server.address().port}/`);
    await webpage.bringToFront();
    const fill = () => panel.evaluate(() => document.getElementById('fillAutomatically').onclick());
    await fill();
    assert.equal(await webpage.locator('#first').inputValue(), 'Ada');
    assert.equal(await webpage.locator('#email').inputValue(), 'existing@example.org');
    assert.match(await panel.locator('#fillResult').textContent(), /1 fields filled/);
    // Repeated injection leaves the original token and listeners intact.
    const tokens = await panel.evaluate(async () => {
      const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
      const documents = () => chrome.runtime.sendMessage({kind:'get-documents',tabId:tab.id});
      const before = await documents();
      await chrome.scripting.executeScript({target:{tabId:tab.id},files:['browser-api.js','content.js']});
      await chrome.tabs.sendMessage(tab.id,{kind:'refresh-document'});
      return [before.documents[0].token,(await documents()).documents[0].token];
    });
    assert.equal(tokens[0], tokens[1]);
    await fill();
    assert.match(await panel.locator('#fillResult').textContent(), /0 fields filled/);
    assert.equal(await webpage.locator('#first').inputValue(), 'Ada');
    console.log('PASS on-demand injection, preserved answers and duplicate-injection guard');
  } finally {
    if (context) await context.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporary, {recursive:true,force:true});
  }
})().catch(error => {console.error(error);process.exitCode = 1;});
