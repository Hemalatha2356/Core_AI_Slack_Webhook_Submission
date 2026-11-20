const test=require('node:test');const assert=require('node:assert/strict');const {server,messages}=require('../src/local-receiver');
test('receiver captures Slack-style payload',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const port=server.address().port;const r=await fetch(`http://127.0.0.1:${port}/services/core-ai/alerts`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Transaction confirmation'})});assert.equal(r.status,200);assert.equal(messages.length,1);}finally{await new Promise(resolve=>server.close(resolve));}
});
