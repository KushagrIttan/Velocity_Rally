import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { RULES_VERSION, utcDay, getStage } from '../js/Stages.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dev=process.argv.includes('--dev');
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||8080);
const dataDir=process.env.RALLY_DATA_DIR||path.join(root,'server/data');
await fs.mkdir(dataDir,{recursive:true});
const file=path.join(dataDir,'records.json');let records=[];
try{const data=JSON.parse(await fs.readFile(file,'utf8'));if(Array.isArray(data))records=data.filter(r=>r.version===RULES_VERSION&&typeof r.id==='string'&&Array.isArray(r.frames));}catch(e){if(e.code!=='ENOENT')console.warn('Could not read saved standings:',e.message);}
let vite=null;if(dev){const {createServer}=await import('vite');vite=await createServer({root,server:{middlewareMode:true},appType:'spa'});}
const limits=new Map();let workers=0;let writeQueue=Promise.resolve();
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
function rateLimit(ip){const now=Date.now();for(const [key,value]of limits)if(now-value.start>600000)limits.delete(key);let value=limits.get(ip);if(!value){value={start:now,count:0};limits.set(ip,value);}return ++value.count<=15;}
async function readBody(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw Object.assign(Error('Replay too large'),{status:413});chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Invalid JSON');}}
async function verify(body){
    if(workers>=2)throw Object.assign(Error('Replay checker busy. Try again in a moment.'),{status:429});workers++;
    try{return await new Promise((resolve,reject)=>{const worker=new Worker(new URL('./worker.js',import.meta.url),{workerData:body});const timeout=setTimeout(()=>{worker.terminate();reject(Error('Replay verification timed out'));},8000);worker.once('message',message=>{clearTimeout(timeout);message.error?reject(Error(message.error)):resolve(message.result);});worker.once('error',error=>{clearTimeout(timeout);reject(error);});worker.once('exit',code=>{clearTimeout(timeout);if(code!==0)reject(Error('Replay verification failed'));});});}finally{workers--;}
}
function persist(){const snapshot=JSON.stringify(records);writeQueue=writeQueue.catch(()=>{}).then(async()=>{await fs.writeFile(file+'.tmp',snapshot);await fs.rename(file+'.tmp',file);});return writeQueue;}
function prune(){const cutoff=new Date(Date.now()-14*86400000).toISOString().slice(0,10);records=records.filter(r=>!r.stage.startsWith('daily-')||r.stage.slice(6)>=cutoff);const counts=new Map();records.sort((a,b)=>a.time-b.time);records=records.filter(r=>{const key=r.stage+':'+r.car;const n=(counts.get(key)||0)+1;counts.set(key,n);return n<=10;});}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
    try{
        const url=new URL(req.url,'http://localhost');
        if(url.pathname==='/api/leaderboard'&&req.method==='GET'){
            const stage=url.searchParams.get('stage'),car=url.searchParams.get('car');getStage(stage);
            return json(res,200,{version:RULES_VERSION,entries:records.filter(r=>r.stage===stage&&r.car===car).sort((a,b)=>a.time-b.time).slice(0,10).map(({id,name,time})=>({id,name,time}))});
        }
        if(url.pathname.startsWith('/api/replay/')&&req.method==='GET'){
            const id=url.pathname.slice('/api/replay/'.length);const replay=records.find(r=>r.id===id);return replay?json(res,200,replay):json(res,404,{error:'Replay no longer on this board'});
        }
        if(url.pathname==='/api/submit'&&req.method==='POST'){
            const origin=req.headers.origin;
            if(origin&&new URL(origin).host!==req.headers.host)return json(res,403,{error:'Submit runs from the game page'});
            if(!rateLimit(req.socket.remoteAddress))return json(res,429,{error:'Too many submissions. Try again in ten minutes.'});
            const body=await readBody(req);
            if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>20||/[\u0000-\u001f\u007f]/.test(body.name))throw Error('Use a driver name of 1–20 visible characters');
            const result=await verify(body);const record={...result,id:randomUUID(),name:body.name.trim(),created:new Date().toISOString()};
            records.push(record);prune();const placed=records.some(r=>r.id===record.id);await persist();return json(res,200,{id:placed?record.id:null,placed,time:record.time});
        }
        if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Unknown API route'});
        if(vite)return vite.middlewares(req,res);
        if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed'});
        const requested=decodeURIComponent(url.pathname);const target=path.resolve(root,'dist','.'+(requested==='/'?'/index.html':requested));
        if(!target.startsWith(path.join(root,'dist')+path.sep))return json(res,403,{error:'Invalid file path'});
        try{const content=await fs.readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);}catch{return json(res,404,{error:'File unavailable. Run npm run build first.'});}
    }catch(error){json(res,error.status||400,{error:error.message||'Request failed'});}
});
server.requestTimeout=10000;server.headersTimeout=10000;
server.listen(port,host,()=>console.log(`Velocity Rally ${dev?'development':'production'}: http://${host}:${server.address().port} · daily date ${utcDay()}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{server.close();await vite?.close();await writeQueue;process.exit(0);});
