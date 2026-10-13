const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const adapter = fs.readFileSync(require('node:path').join(__dirname,'../browser-api.js'),'utf8');
const background = fs.readFileSync(require('node:path').join(__dirname,'../background.js'),'utf8');
(async()=>{
  for(const firefox of [true,false]) {
    const calls=[], listeners={}, storage={};
    let inGesture=false;
    const event = name => ({addListener(fn){listeners[name]=fn;}});
    const api={
      runtime:{onMessage:event('message'),sendMessage:async()=>{}},
      action:{onClicked:event('toolbar')}, commands:{onCommand:event('command')},
      tabs:{onRemoved:event('removed'),onUpdated:event('updated')},
      storage:{session:{set:async value=>Object.assign(storage,value),get:async key=>({[key]:storage[key]}),remove:async key=>{delete storage[key]}}},
      ...(firefox?{sidebarAction:{open(){assert.ok(inGesture,'sidebar open must retain user gesture');calls.push('sidebar');return Promise.resolve()}}}:{sidePanel:{setPanelBehavior:async()=>calls.push('behavior'),open:async v=>calls.push(v.windowId)}})
    };
    const context=vm.createContext({console,...firefox?{browser:api,chrome:{}}:{chrome:api}});
    vm.runInContext(adapter,context);assert.equal(context.formpilotAPI,api);
    vm.runInContext(background,context);
    inGesture=true;if(firefox) listeners.toolbar();listeners.command('open-panel',{windowId:12});inGesture=false;
    assert.deepEqual(calls,firefox?['sidebar','sidebar']:['behavior',12]);
    const message = (m,s={})=>new Promise(resolve=>{assert.equal(listeners.message(m,s,resolve),true)});
    const first=await message({kind:'focus-owner',token:'doc-one',descriptor:{label:'Name'}},{tab:{id:10},frameId:4});assert.equal(first.ok,true);
    assert.equal(storage['owner:10'].frameId,4);
    assert.equal(Object.hasOwn(storage['owner:10'],'documentId'),false);
    await message({kind:'focus-owner',token:'doc-two',descriptor:{label:'Email'}},{tab:{id:10},frameId:4});
    await message({kind:'clear-owner',token:'doc-one'},{tab:{id:10}});
    assert.equal((await message({kind:'get-owner',tabId:10})).owner.token,'doc-two');
    await message({kind:'focus-owner',token:'other-tab',descriptor:{}},{tab:{id:11},frameId:0,documentId:'chrome-document'});
    assert.equal(storage['owner:11'].documentId,'chrome-document');
    listeners.updated(10,{status:'loading'});
    assert.equal((await message({kind:'get-owner',tabId:10})).owner,undefined);
    assert.equal((await message({kind:'get-owner',tabId:11})).owner.token,'other-tab');
    listeners.removed(11);assert.equal((await message({kind:'get-owner',tabId:11})).owner,undefined);
  }
  console.log('PASS: API namespace preference, direct sidebar gestures, Chrome opening, frame fallback, stale clear protection, per-tab owners and navigation/removal cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
