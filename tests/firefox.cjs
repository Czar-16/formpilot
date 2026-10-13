// Install selenium-webdriver externally. Uses a disposable Firefox profile.
const { Builder, By } = require(process.env.SELENIUM_MODULE || 'selenium-webdriver');
const firefox = require((process.env.SELENIUM_MODULE || 'selenium-webdriver') + '/firefox');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
(async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
      res.writeHead(error ? 404 : 200).end(error ? 'Missing' : data);
    });
  });
  await new Promise(r => server.listen(8765, r));
  let driver;
  try {
    const options = new firefox.Options().addArguments('-remote-allow-system-access');
    if (process.env.FIREFOX_HEADLESS !== 'false') options.addArguments('-headless');
    if (process.env.FIREFOX_PATH) options.setBinary(process.env.FIREFOX_PATH);
    options.setPreference('browser.download.folderList', 2);
    options.setPreference('browser.download.dir', os.tmpdir());
    options.setPreference('browser.helperApps.neverAsk.saveToDisk', 'text/plain,application/json');
    let builder = new Builder().forBrowser('firefox').setFirefoxOptions(options);
    if (process.env.GECKODRIVER_PATH)
      builder = builder.setFirefoxService(new firefox.ServiceBuilder(process.env.GECKODRIVER_PATH));
    driver = await builder.build();
    await driver.manage().setTimeouts({ script: 15000 });
    await driver.installAddon(path.join(root, 'dist/formpilot-firefox-2.2.0.zip'), true);
    await driver.setContext('chrome');
    const uuid = await driver.executeScript(`return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['formpilot@extensions.local'];`);
    const widgetId = 'formpilot_extensions_local-browser-action';
    // Place the real toolbar action in the navigation bar, then click it.
    await driver.executeScript(`window.CustomizableUI.addWidgetToArea(arguments[0], window.CustomizableUI.AREA_NAVBAR);`, widgetId);
    await driver.findElement(By.id(widgetId)).click();
    console.log('Toolbar sidebar', await driver.executeScript("return {open:window.SidebarController.isOpen,id:window.SidebarController.currentID,uri:document.getElementById('sidebar').currentURI.spec};"));
    await driver.wait(async () => driver.executeScript(`return window.SidebarController.isOpen && window.SidebarController.currentID.includes('formpilot');`), 10000);
    await driver.executeScript('window.SidebarController.hide();');
    await driver.setContext('content');
    await driver.get('http://localhost:8765/tests/fixture.html');
    await driver.findElement(By.id('full-name')).click();
    await driver.setContext('chrome');
    const shortcut = await driver.executeScript(`const keys=[...document.querySelectorAll('key')]; return keys.filter(k=>(k.getAttribute('key')||'').toLowerCase()==='f' && (k.getAttribute('modifiers')||'').includes('alt') && (k.getAttribute('modifiers')||'').includes('shift')).map(k=>({id:k.id,key:k.getAttribute('key'),modifiers:k.getAttribute('modifiers')}));`);
    console.log('Registered Firefox shortcut',shortcut);
    assert.ok(shortcut.some(k=>k.key.toLowerCase()==='f' && k.modifiers.includes('alt') && k.modifiers.includes('shift')));
    await driver.executeScript(`[...document.querySelectorAll('key')].find(k=>k.getAttribute('key')==='F' && k.getAttribute('modifiers')==='alt,shift').dispatchEvent(new Event('command',{bubbles:true}));`,shortcut[0].id);
    await driver.wait(async () => driver.executeScript(`return window.SidebarController.isOpen && window.SidebarController.currentID.includes('formpilot');`), 10000);
    console.log('PASS native Firefox toolbar and registered shortcut command');
    await driver.executeScript('window.SidebarController.hide()');
    await driver.setContext('content');
    const panelURL = `moz-extension://${uuid}/sidepanel.html`;
    await driver.get(panelURL);
    const panel = await driver.getWindowHandle();
    const js = (source, ...args) => driver.executeScript(source, ...args);
    const asyncJS = (source, ...args) => driver.executeAsyncScript(`const done=arguments[arguments.length-1]; (async()=>{${source}})().then(done,e=>done({error:e.message}));`, ...args);
    const click = selector => driver.wait(async()=>{try{await driver.findElement(By.css(selector)).click();return true}catch(e){if(e.name==='StaleElementReferenceError'||e.name==='NoSuchElementError')return false;throw e;}},10000);
    const hiddenClick = id => js('document.getElementById(arguments[0]).click()', id);
    const waitRows = () => driver.wait(async () => (await driver.findElements(By.css('.row'))).length > 0,10000);
    const saved = () => asyncJS("return (await browser.storage.local.get('formpilot')).formpilot");
    await waitRows(); console.log('PASS Firefox panel defaults');
    assert.equal((await driver.findElements(By.css('.row'))).length,15);
    await click('[aria-label="Edit First name"]');
    await driver.findElement(By.css('#dialogFields textarea, #dialogFields input[name="value"]')).sendKeys('Alex Example');
    await click('#editForm button[type="submit"]');
    await driver.wait(async () => !(await js("return document.getElementById('editor').open")),10000);
    assert.equal((await saved()).profiles[0].items.find(i=>i.label==='First name').value,'Alex Example');
    // Actual profile duplication preserves values and independent file records.
    await hiddenClick('duplicateProfile');
    await click('#editForm button[type="submit"]');
    await driver.wait(async () => (await saved()).profiles.length===2,10000);
    // Upload a dummy résumé through the UI.
    const resumePath = path.join(os.tmpdir(), 'formpilot-dummy-resume.txt');
    fs.writeFileSync(resumePath,'Dummy resume for Alex Example.\n');
    await click('[aria-label="Edit Resume"]');
    await driver.findElement(By.css('#dialogFields input[type="file"]')).sendKeys(resumePath);
    await click('#editForm button[type="submit"]');
    await driver.wait(async () => !(await js("return document.getElementById('editor').open")),10000);
    await click('[aria-label="Copy First name"]');
    assert.equal(await asyncJS('return await navigator.clipboard.readText()'),'Alex Example');
    // Export by intercepting only the final local download, leaving serialization intact.
    await js(`window.downloads=[]; window.originalAnchorClick=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){window.downloads.push({href:this.href,name:this.download})};`);
    await hiddenClick('export');
    await driver.wait(async()=> (await js('return window.downloads.length'))>0,10000);
    const backup = await asyncJS(`return await (await fetch(window.downloads[0].href)).json()`);
    assert.equal(backup.profiles.length,2);
    assert.equal(backup.files.length,1);
    assert.equal(Buffer.from(backup.files[0].data,'base64').toString(),'Dummy resume for Alex Example.\n');
    const backupPath=path.join(os.tmpdir(),'formpilot-firefox-backup.json');
    fs.writeFileSync(backupPath,JSON.stringify(backup));
    await driver.findElement(By.id('importFile')).sendKeys(backupPath);
    await driver.wait(async () => { try {return !!(await driver.switchTo().alert())}catch{return false}},10000);
    await driver.switchTo().alert().accept();
    await driver.wait(async()=> (await js("return document.getElementById('toast').textContent")).toLowerCase().includes('import'),10000);
    await click('[aria-label="Download Resume"]');
    await driver.wait(async()=> (await js('return window.downloads.length'))===2,10000);
    assert.equal(await asyncJS(`return await (await fetch(window.downloads[1].href)).text()`),'Dummy resume for Alex Example.\n');
    await js('HTMLAnchorElement.prototype.click=window.originalAnchorClick');
    // Freeze a network observation window after the test-only blob fetches.
    await js('performance.clearResourceTimings()');
    await driver.switchTo().newWindow('tab');
    const fixture=await driver.getWindowHandle();
    await driver.get('http://localhost:8765/tests/fixture.html');
    const fill = async (selector,value,file) => {
      await driver.switchTo().window(fixture);
      if(file) await js('document.querySelector(arguments[0]).focus()',selector);
      else await click(selector);
      await driver.switchTo().window(panel);
      const owner=await asyncJS(`const [tab]=await browser.tabs.query({active:true,currentWindow:true}); const tabs=await browser.tabs.query({currentWindow:true}); const page=tabs.find(t=>t.url?.includes('/tests/fixture.html')); return await browser.runtime.sendMessage({kind:'get-owner',tabId:page.id});`);
      // tabs URL access is supplied by the Firefox website permission.
      assert.ok(owner.owner,JSON.stringify(owner));
      assert.ok(Number.isInteger(owner.owner.frameId));
      return asyncJS(`const tabs=await browser.tabs.query({currentWindow:true}); const tab=tabs.find(t=>t.url?.includes('/tests/fixture.html')); return await browser.tabs.sendMessage(tab.id,{kind:'transfer',token:arguments[0].token,value:arguments[1],file:arguments[2]}, {frameId:arguments[0].frameId});`,owner.owner,value,file || null);
    };
    for(const [selector,value,property] of [['#full-name','Alex Example','value'],['#notes','Local notes','value'],['#select','Beta','value'],['#editable','Example bio','textContent']]) {
      assert.equal((await fill(selector,value)).ok,true);
      await driver.switchTo().window(fixture);
      assert.equal(await js('return document.querySelector(arguments[0])[arguments[1]]',selector,property),selector==='#select'?'b':value);
    }
    const fileMessage={name:'resume.txt',type:'text/plain',lastModified:1,data:Buffer.from('dummy resume').toString('base64')};
    assert.equal((await fill('#file','',fileMessage)).ok,true);
    await driver.switchTo().window(fixture);
    assert.equal(await js("return document.getElementById('file').files[0].name"),'resume.txt');
    // Same- and cross-origin frame routing, plus stale-token protection.
    for(let index=0;index<2;index++) {
      await driver.switchTo().window(fixture);
      await driver.switchTo().frame(index);
      await click('#frame-input');
      await driver.switchTo().defaultContent();
      await driver.switchTo().window(panel);
      const result=await asyncJS(`const tabs=await browser.tabs.query({currentWindow:true}); const tab=tabs.find(t=>t.url?.includes('/tests/fixture.html')); const {owner}=await browser.runtime.sendMessage({kind:'get-owner',tabId:tab.id}); return {owner,result:await browser.tabs.sendMessage(tab.id,{kind:'transfer',token:owner.token,value:'Frame example'}, {frameId:owner.frameId})};`);
      assert.ok(result.owner.frameId>0);
      assert.equal(result.result.ok,true);
      await driver.switchTo().window(fixture);
      await driver.switchTo().frame(index);
      assert.equal(await js("return document.getElementById('frame-input').value"),'Frame example');
      await driver.switchTo().defaultContent();
    }
    await driver.get('http://localhost:8765/tests/react.html');
    await click('#react-name');
    await driver.switchTo().window(panel);
    assert.equal((await asyncJS(`const tabs=await browser.tabs.query({currentWindow:true}); const tab=tabs.find(t=>t.url?.includes('/tests/react.html')); const {owner}=await browser.runtime.sendMessage({kind:'get-owner',tabId:tab.id}); return await browser.tabs.sendMessage(tab.id,{kind:'transfer',token:owner.token,value:'React Example'},{frameId:owner.frameId});`)).ok,true);
    await driver.switchTo().window(fixture);
    await click('#react-render');
    assert.equal(await js("return document.getElementById('react-name').value"),'React Example');
    assert.equal(await js("return document.getElementById('react-value').textContent"),'React Example');
    const stale = await (async()=>{await driver.switchTo().window(panel);return asyncJS(`const tabs=await browser.tabs.query({currentWindow:true}); const tab=tabs.find(t=>t.url?.includes('/tests/react.html')); return {tabId:tab.id,...await browser.runtime.sendMessage({kind:'get-owner',tabId:tab.id})}`)})();
    await driver.switchTo().window(fixture);
    await driver.get('http://localhost:8765/tests/fixture.html');
    await driver.switchTo().window(panel);
    assert.equal((await asyncJS(`return await browser.runtime.sendMessage({kind:'get-owner',tabId:arguments[0]})`,stale.tabId)).owner,null);
    const rejected=await asyncJS(`return await browser.tabs.sendMessage(arguments[0],{kind:'transfer',token:arguments[1],value:'wrong document'},{frameId:0})`,stale.tabId,stale.owner.token);
    assert.ok(!rejected?.ok);
    // Two browser windows keep their ownership independent.
    await driver.switchTo().window(fixture); await click('#full-name');
    await driver.switchTo().window(panel);
    const firstOwner=await asyncJS(`return await browser.runtime.sendMessage({kind:'get-owner',tabId:arguments[0]})`,stale.tabId);
    const win=await asyncJS(`return await browser.windows.create({url:'http://localhost:8765/tests/fixture.html'})`);
    const handles=await driver.getAllWindowHandles();
    const second=handles.find(h=>h!==fixture && h!==panel);
    let secondOwner;
    await driver.wait(async()=>{
      await driver.switchTo().window(second); await click('#postal');
      await driver.switchTo().window(panel);
      secondOwner=await asyncJS(`return await browser.runtime.sendMessage({kind:'get-owner',tabId:arguments[0]})`,win.tabs[0].id);
      return !!secondOwner.owner;
    },10000);

    assert.equal(firstOwner.owner.descriptor.autocomplete,'name');
    assert.equal(secondOwner.owner.descriptor.autocomplete,'postal-code');
    assert.notEqual(firstOwner.owner.token,secondOwner.owner.token);
    assert.equal((await asyncJS(`return await browser.runtime.sendMessage({kind:'get-owner',tabId:arguments[0]})`,stale.tabId)).owner.token,firstOwner.owner.token);
    await asyncJS('await browser.windows.remove(arguments[0]); return true;',win.id);
    await require('./bulk.cjs')({
      panel: async source => {await driver.switchTo().window(panel); return asyncJS(source);},
      page: async source => {await driver.switchTo().window(fixture); return js(source);},
      navigate: async file => {await driver.switchTo().window(fixture); await driver.get('http://localhost:8765/tests/' + file); await new Promise(r=>setTimeout(r,150));}
    });
    await driver.switchTo().window(panel);
    await driver.switchTo().window(fixture);
    await driver.get('http://localhost:8765/tests/bulk.html');
    await new Promise(r=>setTimeout(r,150));
    await driver.switchTo().window(panel);
    await asyncJS('await browser.tabs.update(window.bulkTest.tabId,{active:true}); return true;');
    await require('./reconnect.cjs')(source => asyncJS(source));
    await driver.switchTo().window(fixture);
    await driver.navigate().refresh();
    await new Promise(r=>setTimeout(r,150));
    await driver.switchTo().window(panel);
    await require('./background-response.cjs')(source => asyncJS(source));
    const automaticStatus = await asyncJS(`
      document.getElementById('search').value='no matching saved cards';
      document.getElementById('search').dispatchEvent(new Event('input'));
      await browser.tabs.update(window.bulkTest.tabId,{active:true});
      document.getElementById('fillAutomatically').click();
      for(let i=0;i<100 && document.getElementById('fillAutomatically').disabled;i++) await new Promise(r=>setTimeout(r,50));
      return document.getElementById('fillResult').textContent;
    `);
    assert.match(automaticStatus,/fields filled/);
    await driver.switchTo().window(fixture);
    assert.equal(await js("return document.getElementById('first').value"),'Alex Example');
    assert.equal(await js("return document.getElementById('email').value"),'existing@example.org');
    await driver.switchTo().window(panel);
    await js("document.getElementById('search').value='';document.getElementById('search').dispatchEvent(new Event('input'))");
    // Capture the actual extension page at sidebar widths, using only dummy data.
    fs.mkdirSync(path.join(root,'release/screenshots'),{recursive:true});
    for(const theme of ['light','dark']) {
      await js(`const select=document.getElementById('theme');select.value=arguments[0];select.dispatchEvent(new Event('change'));`,theme);
      await driver.wait(async()=> (await js('return document.documentElement.dataset.theme'))===theme,10000);
      for(const width of [320,380,640]) {
        await js(`document.documentElement.style.width=arguments[0]+'px';document.body.style.width=arguments[0]+'px';`,width);
        await driver.findElement(By.id('search')).sendKeys('Example');
        const metrics=await js(`const i=document.getElementById('search'),b=i.closest('.search-box'),r=i.getBoundingClientRect(),s=b.getBoundingClientRect();return {height:s.height,outline:getComputedStyle(i).outlineStyle,ring:getComputedStyle(b).outlineWidth,padding:getComputedStyle(i).padding,fits:r.top>=s.top&&r.bottom<=s.bottom&&r.right<=s.right,rows:document.querySelectorAll('.row').length}`);
        assert.equal(await js('return document.body.scrollWidth<=arguments[0]',width),true);
        assert.equal(await js("return document.getElementById('fillAutomatically').getBoundingClientRect().height"),44);
        assert.equal(await js("return document.getElementById('fillAutomatically').getAttribute('aria-describedby')"),'fillResult');
        assert.equal(metrics.height,44);assert.equal(metrics.outline,'none');assert.equal(metrics.ring,'2px');assert.equal(metrics.padding,'0px');assert.equal(metrics.fits,true);assert.ok(metrics.rows>0);
        fs.writeFileSync(path.join(root,`release/screenshots/firefox-${theme}-${width}-focused.png`),await driver.findElement(By.css('body')).takeScreenshot(), 'base64');
        await driver.findElement(By.id('search')).sendKeys(' nonexistent-93827');
        assert.equal(await js("return document.querySelectorAll('.row').length"),0);
        await driver.findElement(By.id('search')).clear();
        await js("document.getElementById('search').dispatchEvent(new Event('input'));document.getElementById('search').blur()");
        assert.equal(await js("return getComputedStyle(document.querySelector('.search-box')).outlineStyle"),'none');
        fs.writeFileSync(path.join(root,`release/screenshots/firefox-${theme}-${width}.png`),await driver.findElement(By.css('body')).takeScreenshot(),'base64');
      }
    }
    await driver.navigate().refresh(); await waitRows();
    assert.equal(await js('return document.documentElement.dataset.theme'),'dark');
    assert.deepEqual(await js("return performance.getEntriesByType('resource').filter(e=>/^https?:/.test(e.name)).map(e=>e.name)"),[]);
    console.log('PASS Firefox: installed package, native toolbar/shortcut sidebar, profiles, themes, clipboard, resume upload/download/attachment, JSON backup, native/React/frame filling, navigation tokens, two-window ownership, search at 320/380/640px and local assets.');
  } finally {
    if(driver) { console.log('Final panel status',await driver.executeScript("return {url:location.href,toast:document.getElementById('toast')?.textContent,dialog:document.getElementById('editor')?.open}").catch(()=>null));await driver.quit(); }
    await new Promise(r=>server.close(r));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
