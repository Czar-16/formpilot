// Shared real-browser checks; all data is synthetic.
const assert = require("node:assert/strict");
module.exports = async ({ panel, page, navigate }) => {
  await navigate("bulk.html");
  const scan = await panel(`
    const tabs = await formpilotAPI.tabs.query({});
    let tab, docs; const debug=[];
    for (const candidate of tabs) {
      const registry = await formpilotAPI.runtime.sendMessage({kind:'get-documents',tabId:candidate.id});
      debug.push({id:candidate.id,url:candidate.url,registry});
      if (registry.documents?.length === 3) {tab=candidate; docs=registry.documents; break;}
    }
    if (!tab) throw Error('Bulk fixture documents missing '+JSON.stringify(debug));
    const results = [];
    for (const doc of docs) results.push({doc, scan:await formpilotAPI.tabs.sendMessage(tab.id,{kind:'scan-fields',token:doc.token},{frameId:doc.frameId})});
    window.bulkTest = {tabId:tab.id, results}; return results;
  `);
  assert.equal(
    scan.length,
    3,
    "main, same-origin and cross-origin documents registered",
  );
  const main = scan.find((s) => s.doc.frameId === 0).scan;
  assert.ok(
    main.fields.some((f) => f.descriptor.id === "email"),
    JSON.stringify(main),
  );
  assert.ok(
    main.fields.every((f) => !Object.hasOwn(f, "value")),
    "scan never exposes existing values",
  );
  for (const id of [
    "hidden",
    "disabled",
    "readonly",
    "password",
    "checkbox",
    "radio",
    "nested",
  ])
    assert.ok(!main.fields.some((f) => f.descriptor.id === id), id);
  assert.equal(
    main.fields.find((f) => f.descriptor.id === "email").empty,
    false,
  );
  assert.equal(
    main.fields.find((f) => f.descriptor.id === "preserved").empty,
    false,
  );
  await page(`document.getElementById('changed').value='Changed after scan';`);
  const results = await panel(`
    const {bulkMatch} = await import('./model.js');
    const items = [ ['First name','Ada'], ['Last name','Lovelace'], ['Phone','12345'], ['Country','United Kingdom'], ['City','London'], ['Resume','file'] ].map(([label,value],i)=>({id:String(i),label,value,type:label==='Resume'?'file':'text',category:'c'}));
    const profile = {items,groups:[],categories:[{id:'c',entries:items.map(i=>({kind:'item',id:i.id}))}]};
    const output=[];
    for(const {doc,scan} of window.bulkTest.results) {
      const entries=[];
      for(const field of scan.fields.filter(f=>f.empty)) {
        const match=bulkMatch(profile,field.descriptor); if(!match) continue;
        entries.push({id:field.id,...match.type==='file'?{file:{name:'resume.txt',type:'text/plain',lastModified:1,data:btoa('dummy resume')}}:{value:match.value}});
      }
      output.push(await formpilotAPI.tabs.sendMessage(window.bulkTest.tabId,{kind:'batch-fill',token:doc.token,entries},{frameId:doc.frameId}));
    } return output;
  `);
  assert.equal(
    results.flatMap((r) => r.results).filter((r) => r.error).length,
    3,
    "select mismatch, rejected file and changed field fail independently",
  );
  const values = await page(
    `return {first:document.getElementById('first').value,last:document.getElementById('last').value,full:document.getElementById('full').value,email:document.getElementById('email').value,phone:document.getElementById('phone').value,country:document.getElementById('country').value,preserved:document.getElementById('preserved').value,resume:document.getElementById('resume').files.length,unrelated:document.getElementById('unrelated').files.length,changed:document.getElementById('changed').value,other:document.getElementById('other-first').value,shadow:document.getElementById('shadow').shadowRoot.querySelector('input').value,editable:document.getElementById('editable').textContent.trim(),submits:window.submits};`,
  );
  assert.deepEqual(values, {
    first: "Ada",
    last: "Lovelace",
    full: "Ada Lovelace",
    email: "existing@example.org",
    phone: "12345",
    country: "UK",
    preserved: "US",
    resume: 1,
    unrelated: 0,
    changed: "Changed after scan",
    other: "Ada",
    shadow: "Ada",
    editable: "Ada",
    submits: 0,
  });
  await navigate("bulk.html");
  await page(`document.getElementById('first').focus();`);
  const isolation = await panel(`
    const {owner} = await formpilotAPI.runtime.sendMessage({kind:'get-owner',tabId:window.bulkTest.tabId});
    const scan = await formpilotAPI.tabs.sendMessage(window.bulkTest.tabId,{kind:'scan-fields',token:owner.token,selected:true},{frameId:owner.frameId});
    window.bulkOwner=owner; return scan;
  `);
  assert.ok(isolation.fields.some((f) => f.descriptor.id === "first"));
  assert.ok(isolation.fields.some((f) => f.descriptor.id === "form-editable"));
  assert.ok(
    !isolation.fields.some((f) =>
      ["other-first", "shadow-first", "editable"].includes(f.descriptor.id),
    ),
  );
  await page(`document.getElementById('first').remove();`);
  const stale = await panel(
    `return await formpilotAPI.tabs.sendMessage(window.bulkTest.tabId,{kind:'scan-fields',token:window.bulkOwner.token,selected:true},{frameId:window.bulkOwner.frameId});`,
  );
  assert.match(stale.error, /stale/);
  await navigate("react.html");
  const react = await panel(`
    const docs = (await formpilotAPI.runtime.sendMessage({kind:'get-documents',tabId:window.bulkTest.tabId})).documents;
    const doc = docs.find(d=>d.frameId===0);
    const scan = await formpilotAPI.tabs.sendMessage(window.bulkTest.tabId,{kind:'scan-fields',token:doc.token},{frameId:0});
    const field = scan.fields.find(f=>f.descriptor.id==='react-name');
    return await formpilotAPI.tabs.sendMessage(window.bulkTest.tabId,{kind:'batch-fill',token:doc.token,entries:[{id:field.id,value:'Automatic React'}]},{frameId:0});
  `);
  assert.equal(react.results[0].ok, true);
  assert.equal(
    await page(
      `document.getElementById('react-render').click(); return document.getElementById('react-name').value;`,
    ),
    "Automatic React",
  );
  console.log(
    "PASS automatic scanning, confident matching, preservation, selects, open shadows, contenteditable, résumé, same/cross-origin frames, partial failures and selected-form isolation",
  );
};
