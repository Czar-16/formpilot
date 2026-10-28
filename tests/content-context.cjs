const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8');

(async () => {
  for (const failure of ['throw', 'reject']) {
    const listeners = {}, messages = [];
    let invalid = false;
    class Element {
      matches() { return true; }
      getRootNode() { return {}; }
      getAttribute() { return null; }
      id = 'name';
      type = 'text';
    }
    const field = new Element();
    const context = vm.createContext({
      Element,
      crypto: {randomUUID: () => 'document-token'},
      window: {addEventListener: (name, fn) => { listeners[name] = fn; }},
      document: {addEventListener: (name, fn) => { listeners[name] = fn; }},
      formpilotAPI: {runtime: {
        sendMessage(message) {
          messages.push(message);
          if (invalid) {
            const error = Error('Extension context invalidated.');
            if (failure === 'throw') throw error;
            return Promise.reject(error);
          }
          return Promise.resolve({ok: true});
        },
        onMessage: {addListener(fn) { listeners.message = fn; }},
      }},
    });
    vm.runInContext(source, context);
    const event = {composedPath: () => [field]};
    listeners.focusin(event);
    assert.equal(messages.at(-1).kind, 'focus-owner');
    assert.equal(messages.at(-1).descriptor.id, 'name');
    invalid = true;
    for (let i = 0; i < 2; i++) {
      for (const name of ['focusin', 'click', 'pageshow', 'pagehide']) {
        assert.doesNotThrow(() => listeners[name](event), `${failure}: ${name}`);
      }
    }
    const response = await new Promise(resolve => {
      assert.equal(listeners.message({kind: 'refresh-document'}, {}, resolve), true);
    });
    assert.equal(response.error, 'Extension context invalidated.');
    // Allow unhandled rejections to surface before considering the test passed.
    await new Promise(resolve => setImmediate(resolve));
    const count = messages.length;
    vm.runInContext(source, context);
    assert.equal(messages.length, count, 'duplicate injection remains a no-op');
  }
  console.log('PASS content messaging handles synchronous invalidation and rejected promises');
})().catch(error => { console.error(error); process.exitCode = 1; });
