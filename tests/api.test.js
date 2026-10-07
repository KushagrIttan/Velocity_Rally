import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { RULES_VERSION } from '../js/Stages.js';
import { drive } from './helpers.js';

test('HTTP competition verifies input, persists standings, returns ghosts and rejects tampering',async()=>{
    const directory=await mkdtemp(path.join(os.tmpdir(),'rally-api-'));
    async function launch(){const child=spawn(process.execPath,['server/index.js'],{cwd:process.cwd(),env:{...process.env,PORT:'0',RALLY_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
        const address=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('server did not start')),10000);child.once('error',reject);child.once('exit',code=>reject(Error('server exited '+code)));child.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timeout);resolve('http://127.0.0.1:'+match[1]);}});});return {child,address};}
    let server;
    try{
        server=await launch();const {sim,runs}=drive('fern');const payload={name:'Test Driver',stage:'fern',car:'scout',version:RULES_VERSION,time:sim.elapsed,runs};
        const post=async(body,origin)=>fetch(server.address+'/api/submit',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
        const response=await post(payload);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.placed,true);assert.ok(saved.id);
        const board=await (await fetch(server.address+'/api/leaderboard?stage=fern&car=scout')).json();assert.equal(board.entries[0].name,'Test Driver');assert.equal(board.entries[0].time,sim.elapsed);
        const ghost=await (await fetch(server.address+'/api/replay/'+saved.id)).json();assert.equal(ghost.frames.length>10,true);assert.equal(ghost.frames.at(-1)[0],sim.elapsed);
        assert.equal((await post({...payload,time:1})).status,400);assert.equal((await post(payload,'https://unrelated.example')).status,403);
        assert.equal((await fetch(server.address+'/api/replay/missing')).status,404);
        server.child.kill('SIGTERM');await once(server.child,'exit');server=await launch();
        const restored=await (await fetch(server.address+'/api/leaderboard?stage=fern&car=scout')).json();assert.equal(restored.entries[0].id,saved.id);
    }finally{if(server?.child.exitCode===null){server.child.kill('SIGTERM');await once(server.child,'exit');}await rm(directory,{recursive:true,force:true});}
});
