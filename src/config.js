const fs = require('node:fs');
const path = require('node:path');
function loadLocalEnv() {
  const file=path.join(__dirname,'..','.env');
  if(!fs.existsSync(file)) return;
  for(const row of fs.readFileSync(file,'utf8').split(/\r?\n/)) {
    const m=row.match(/^([A-Z_]+)=(.*)$/);
    if(m && process.env[m[1]]===undefined) process.env[m[1]]=m[2];
  }
}
loadLocalEnv();
module.exports={
  listenerPort: Number(process.env.LISTENER_PORT || 4100),
  receiverPort: Number(process.env.RECEIVER_PORT || 4101),
  destinationUrl: process.env.SLACK_WEBHOOK_URL || 'http://127.0.0.1:4101/services/core-ai/alerts',
  timeoutMs: Number(process.env.FORWARD_TIMEOUT_MS || 1500),
  webhookSecret: process.env.WEBHOOK_SHARED_SECRET || ''
};
