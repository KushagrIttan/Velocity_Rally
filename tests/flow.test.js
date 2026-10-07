import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Game } from '../js/Game.js';
import { Course } from '../js/Course.js';
import { RallySimulation } from '../js/Simulation.js';
import { Progress } from '../js/Progress.js';
import { FixedClock } from '../js/Simulation.js';
import { InputHandler } from '../js/InputHandler.js';
import { validateReplay } from '../server/validate.js';
import { RULES_VERSION } from '../js/Stages.js';
import { HUD } from '../js/HUD.js';

test('real race lifecycle records a verifiable finish, accurate results, medals and replay-preserving retries',()=>{
    const elements=new Map();const element=()=>({hidden:false,textContent:'',value:'',inert:false,children:[],append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},focus(){},classList:{toggle(){}}});
    const oldDocument=globalThis.document,oldWindow=globalThis.window;globalThis.window={};
    globalThis.document={getElementById:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:()=>element()};
    const g=Object.create(Game.prototype),course=new Course('fern'),noop=()=>{};
    Object.assign(g,{track:{course,totalLength:course.totalLength},sim:new RallySimulation(course,'scout'),stageId:'fern',carId:'scout',state:'MENU',fixed:new FixedClock(),input:new InputHandler(),progress:new Progress({getItem:()=>null,setItem:noop}),vehicle:{position:new THREE.Vector3(),group:{},sync:noop,rearWheelPos:noop},cameraController:{},gamepad:{rumble:noop},dust:{clear:noop,kickUp:noop,update:noop},hud:{setCountdown:noop,flashMessage:noop,showCorner:noop},audio:{init:noop,resume:noop,setMuted:noop,setVolume:noop,beep:noop,checkpoint:noop,fanfare:noop},ghost:{load:noop,group:{}},rival:{load:noop,group:{}},settings:{volume:0},refreshMenu:noop,updateHUD:noop});
    try{
        g.start();assert.equal(g.state,'COUNTDOWN');for(let i=0;i<181;i++)g.tick({throttle:0});assert.equal(g.state,'RACING');assert.equal(g.sim.ticks,0);
        g.pause();for(let i=0;i<600;i++)g.tick({throttle:1});assert.equal(g.sim.elapsed,0);g.resume();
        for(let i=0;i<10000&&g.state==='RACING';i++){
            const f=g.sim.frame,t=course.getSampleAt(f.dist+Math.max(8,g.sim.speed*.65));let angle=Math.atan2(t.x-g.sim.x,t.z-g.sim.z)-g.sim.yaw;angle=Math.atan2(Math.sin(angle),Math.cos(angle));
            const c=course.getSampleAt(f.dist+35);let bend=Math.atan2(c.tx,c.tz)-Math.atan2(f.tx,f.tz);bend=Math.abs(Math.atan2(Math.sin(bend),Math.cos(bend)));const desired=bend>.45?14:bend>.2?20:26;
            g.tick({throttle:g.sim.speed<desired?1:.3,brake:g.sim.speed>desired+2?.6:0,steer:Math.max(-1,Math.min(1,angle*3.8)),handbrake:0});
        }
        assert.equal(g.state,'FINISHED');assert.equal(elements.get('results-screen').hidden,false);assert.equal(g.progress.unlocked('amber'),true);assert.equal(elements.get('res-time').textContent,HUD.fmt(g.result.time*1000));assert.ok(elements.get('res-avg').textContent.endsWith(' km/h'));
        assert.equal(validateReplay({version:RULES_VERSION,stage:g.stageId,car:g.carId,time:g.result.time,runs:g.runs}).time,g.result.time);
        const saved=g.progress.best('fern','scout');assert.equal(saved.frames.at(-1)[0],g.result.time);g.restart();assert.equal(g.track.course,course);assert.equal(g.state,'COUNTDOWN');assert.equal(g.sim.elapsed,0);assert.equal(g.bestRecord.time,saved.time);
    }finally{globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
