// Exercise missing/stale-background responses through the real panel button.
const assert = require('node:assert/strict');
module.exports = async evaluate => {
  const results = await evaluate(`
    const send = formpilotAPI.runtime.sendMessage.bind(formpilotAPI.runtime);
    const cases = [
      {kind:'get-owner', mode:'missing'},
      {kind:'get-documents', mode:'missing'},
      {kind:'get-documents', mode:'malformed'},
      {kind:'get-owner', mode:'rejected'},
    ];
    const originalTabsSend = formpilotAPI.tabs.sendMessage.bind(formpilotAPI.tabs);
    let writes = 0;
    formpilotAPI.tabs.sendMessage = (...args) => {writes++; return originalTabsSend(...args);};
    const results = [];
    try {
      for (const test of cases) {
        formpilotAPI.runtime.sendMessage = message => {
          if (message.kind !== test.kind) return send(message);
          if (test.mode === 'rejected') return Promise.reject(Error('Receiving end does not exist'));
          return Promise.resolve(test.mode === 'malformed' ? {} : undefined);
        };
        // Await the installed click handler so each request finishes before the next.
        await document.getElementById('fillAutomatically').onclick();
        results.push({text:document.getElementById('fillResult').textContent,
          disabled:document.getElementById('fillAutomatically').disabled,
          label:document.getElementById('fillAutomatically').textContent});
      }
      return {results,writes};
    } finally {
      formpilotAPI.runtime.sendMessage = send;
      formpilotAPI.tabs.sendMessage = originalTabsSend;
    }
  `);
  assert.equal(results.writes,0,'missing background responses never scan or write into the page');
  for (const result of results.results) {
    assert.match(result.text,/background service/);
    assert.match(result.text,/Reload or reinstall/);
    assert.doesNotMatch(result.text,/Cannot read properties/);
    assert.equal(result.disabled,false);
    assert.equal(result.label,'Fill automatically');
  }
  console.log('PASS missing, malformed and rejected background responses: actionable error, no field access, button restored');
};
