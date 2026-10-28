const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');

(async () => {
  const {bulkMatch} = await import('../model.js');
  const browser = await chromium.launch({headless: true,
    ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  try {
    const page = await browser.newPage();
    await page.route('https://formpilot.test/**', route => route.fulfill({
      contentType: 'text/html', body: fs.readFileSync(path.join(__dirname, 'legacy-form.html'), 'utf8'),
    }));
    await page.goto('https://formpilot.test/');
    await page.evaluate(() => {
      window.formpilotAPI = {runtime: {
        sendMessage: async message => { window.documentToken = message.token; return {ok: true}; },
        onMessage: {addListener(listener) { window.contentMessage = listener; }},
      }};
    });
    await page.addScriptTag({path: path.join(root, 'content.js')});
    const scan = await page.evaluate(() => new Promise(resolve =>
      contentMessage({kind: 'scan-fields', token: documentToken}, {}, resolve)));
    const labels = ['First name', 'Last name', 'Address line 1', 'Address line 2', 'City', 'State', 'Pin code', 'Email', 'Phone'];
    const values = ['Ada', 'Lovelace', '123 Example St', 'Unit 2', 'London', 'California', '12345', 'ada@example.org', '1234567890'];
    const items = labels.map((label, i) => ({id: String(i), label, value: values[i], type: 'text'}));
    const profile = {items, groups: [], categories: [{entries: items.map(i => ({kind: 'item', id: i.id}))}]};
    const entries = scan.fields.filter(f => f.empty).flatMap(f => {
      const match = bulkMatch(profile, f.descriptor);
      return match ? [{id: f.id, value: match.value}] : [];
    });
    assert.equal(entries.length, 8);
    assert.equal(scan.fields.find(f => f.descriptor.name === '21workphon_pr').descriptor.label, '');
    for (const name of ['unlabelled', 'wrong-label', 'nested', 'after-group'])
      assert.equal(scan.fields.find(f => f.descriptor.name === name).descriptor.label, '');
    assert.equal(scan.fields.find(f => f.descriptor.name === 'explicit').descriptor.label, '');
    const result = await page.evaluate(entries => new Promise(resolve =>
      contentMessage({kind: 'batch-fill', token: documentToken, entries}, {}, resolve)), entries);
    assert.ok(result.results.every(r => r.ok));
    for (const [name, value] of Object.entries({
      '02frstname': 'Ada', '04lastname': 'Lovelace', '10address1': '123 Example St',
      '10address2': 'Unit 2', '13adr_city': 'London', '14adrstate': 'CA',
      '16addr_zip': '12345', '24emailadr': 'ada@example.org', preserved: 'Existing',
      '21workphon_ac': '', '21workphon_pr': '', explicit: '', unlabelled: '',
    })) assert.equal(await page.locator(`[name="${name}"]`).inputValue(), value, name);
    console.log('PASS legacy captions, address/email aliases, select matching, existing values and label boundaries');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
