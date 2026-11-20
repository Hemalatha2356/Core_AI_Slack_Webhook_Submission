const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const d=path.join(__dirname,'..','fixtures');
for(const n of ['success_01.json','success_null_email.json','failed_event.json','missing_id.json','wrong_amount_type.json']){
 test(`fixture can parse: ${n}`,()=>{const obj=JSON.parse(fs.readFileSync(path.join(d,n),'utf8'));assert.equal(typeof obj.event_id,'string');assert.equal(typeof obj.transaction,'object');});
}
test('malformed fixture intentionally cannot parse',()=>assert.throws(()=>JSON.parse(fs.readFileSync(path.join(d,'malformed.json'),'utf8'))));
