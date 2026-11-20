const fs=require('node:fs');
const path=require('node:path');
const filename=process.argv[2]||'success_01.json';
const port=Number(process.env.LISTENER_PORT||4100);
const file=path.join(__dirname,'..','fixtures',path.basename(filename));
if(!fs.existsSync(file)){console.error('Fixture not found:',filename);process.exit(1);}
fetch(`http://127.0.0.1:${port}/webhooks/transactions`,{method:'POST',headers:{'Content-Type':'application/json'},body:fs.readFileSync(file,'utf8')})
 .then(async r=>{console.log(r.status,await r.text());if(r.status>=500)process.exitCode=1;})
 .catch(e=>{console.error(e.message);process.exitCode=1;});
