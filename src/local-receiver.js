const http=require('node:http');
const {receiverPort}=require('./config');
const messages=[];
const server=http.createServer(async (req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET' && path==='/health') {res.end(JSON.stringify({ok:true,service:'local-notification-receiver'}));return;}
  if(req.method==='GET' && path==='/messages') {res.end(JSON.stringify({messages}));return;}
  if(req.method==='POST' && path==='/services/core-ai/alerts') {
    let raw='';for await(const ch of req){raw+=ch;if(raw.length>10000){res.writeHead(413);res.end(JSON.stringify({error:'too_large'}));return;}}
    let value;try{value=JSON.parse(raw)}catch{res.writeHead(400);res.end(JSON.stringify({error:'invalid_json'}));return;}
    if(typeof value.text!=='string' && !Array.isArray(value.blocks)){res.writeHead(422);res.end(JSON.stringify({error:'message_required'}));return;}
    messages.push({sequence:messages.length+1,receivedAt:new Date().toISOString(),payload:value});
    res.end(JSON.stringify({ok:true,sequence:messages.length}));return;
  }
  if(req.method==='POST' && path==='/services/core-ai/timeout') {setTimeout(()=>res.end(JSON.stringify({ok:true})),5000);return;}
  res.writeHead(404);res.end(JSON.stringify({error:'not_found'}));
});
if(require.main===module){server.listen(receiverPort,'127.0.0.1',()=>console.log(`Receiver http://127.0.0.1:${receiverPort}`));}
module.exports={server,messages};
