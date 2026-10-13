const assert = require('node:assert/strict');

// Run against a loaded form and the actual panel in both browsers.
module.exports = async evaluate => {
  const result = await evaluate(`
    const windowId = (await formpilotAPI.windows.getCurrent()).id;
    const [tab] = await formpilotAPI.tabs.query({active:true,windowId});
    const before = await formpilotAPI.runtime.sendMessage({kind:'get-documents',tabId:tab.id});
    if (!before.documents.length) throw Error('Expected live fixture documents');
    await formpilotAPI.storage.session.remove(['documents:'+tab.id,'owner:'+tab.id]);
    await document.getElementById('fillAutomatically').onclick();
    const after = await formpilotAPI.runtime.sendMessage({kind:'get-documents',tabId:tab.id});
    const status = document.getElementById('fillResult').textContent;
    const originalReload = formpilotAPI.runtime.reload;
    let reloads = 0;
    try {
      formpilotAPI.runtime.reload = () => {reloads++;};
      await document.getElementById('refreshExtension').onclick();
      formpilotAPI.runtime.reload = () => {throw Error('Reload test failure');};
      await document.getElementById('refreshExtension').onclick();
      return {status,documents:after.documents.length,reloads,
        error:document.getElementById('fillResult').textContent,
        disabled:document.getElementById('refreshExtension').disabled};
    } finally {
      formpilotAPI.runtime.reload = originalReload;
    }
  `);
  assert.ok(result.documents > 0, 'live pages re-register after losing session registrations');
  assert.match(result.status, /[1-9]\d* fields filled/);
  assert.doesNotMatch(result.status, /No accessible form|failures\. .*inaccessible/);
  assert.equal(result.reloads, 1, 'refresh button calls extension reload');
  assert.match(result.error, /Could not refresh FormPilot.*Reload test failure/);
  assert.equal(result.disabled, false, 'failed reload can be retried');
  console.log('PASS automatic-fill reconnection and extension refresh handler');
};
