import test from 'node:test';
import assert from 'node:assert/strict';
import { Course } from '../js/Course.js';
import { RallySimulation, FixedClock } from '../js/Simulation.js';
import { STAGES,CARS,getStage,medalFor,RULES_VERSION } from '../js/Stages.js';
import { InputHandler } from '../js/InputHandler.js';
import { Progress } from '../js/Progress.js';
import { validateReplay } from '../server/validate.js';
import { drive } from './helpers.js';

test('30/60/120 FPS produce identical simulation and race time',()=>{
    const states=[];
    for(const fps of [30,60,120]){const sim=new RallySimulation(new Course('fern'),'scout'),clock=new FixedClock();for(let i=0;i<fps*10;i++)clock.advance(1/fps,()=>sim.step({throttle:1}));states.push([sim.ticks,sim.x,sim.z,sim.elapsed,sim.gate]);}
    assert.deepEqual(states[0],states[1]);assert.deepEqual(states[1],states[2]);assert.equal(states[0][0],600);
});
test('long stalls stop the clock instead of creating a competitive time advantage',()=>{const clock=new FixedClock();let ticks=0;assert.equal(clock.advance(1,()=>ticks++),false);assert.equal(ticks,0);clock.reset();clock.advance(1/60,()=>ticks++);assert.equal(ticks,1);});
test('brake and handbrake never propel a stopped car',()=>{for(const input of [{brake:1},{handbrake:1}]){const sim=new RallySimulation(new Course('fern'),'scout');for(let i=0;i<300;i++)sim.step(input);assert.equal(sim.speed,0);assert.equal(sim.z,0);}});
test('braking moving car stops without reversing',()=>{const sim=new RallySimulation(new Course('fern'),'scout');for(let i=0;i<120;i++)sim.step({throttle:1});for(let i=0;i<240;i++)sim.step({brake:1});assert.equal(sim.speed,0);assert.ok(sim.z>0);});
test('reverse is deliberate and speed limited',()=>{const sim=new RallySimulation(new Course('fern'),'scout');for(let i=0;i<300;i++)sim.step({reverse:true});assert.ok(sim.z<0);assert.ok(sim.speed<=7);});
test('left and right steer correctly',()=>{for(const steer of [-1,1]){const sim=new RallySimulation(new Course('fern'),'scout');for(let i=0;i<60;i++)sim.step({throttle:1,steer});assert.equal(Math.sign(sim.yaw),steer);assert.equal(Math.sign(sim.x),steer);}});
test('course, visible surfaces, and daily challenge are deterministic',()=>{const a=new Course('daily-2026-10-07'),b=new Course('daily-2026-10-07');assert.deepEqual(a.samples,b.samples);assert.deepEqual(a.zones,b.zones);assert.equal(a.definition.car,'comet');assert.notDeepEqual(getStage('daily-2026-10-08').blocks,a.definition.blocks);assert.throws(()=>getStage('daily-2026-02-31'));for(const z of a.zones)assert.equal(a.surfaceAt((z.start+z.end)/2),z.surface);});
test('road projection interpolates actual road height and lateral position',()=>{const c=new Course('amber');for(let d=0;d<c.totalLength;d+=13){const p=c.getSampleAt(d),f=c.project(p.x+p.tz*2,p.z-p.tx*2,p.index);assert.ok(Math.abs(f.y-p.y)<.03);assert.ok(Math.abs(f.lateral-2)<.05);}});
test('recover banks only crossed gates, synchronizes state, and adds five seconds',()=>{const sim=new RallySimulation(new Course('fern'),'scout');sim.x=20;sim.z=100;sim.vx=10;sim.damage=.2;sim.reset();assert.equal(sim.frame.dist,0);assert.equal(sim.speed,0);assert.equal(sim.penalty,5);assert.equal(sim.damage,.2);assert.deepEqual(sim.previous,{x:sim.x,y:sim.y,z:sim.z,yaw:sim.yaw});});
test('a finish cannot be awarded by teleporting to the last gate',()=>{const c=new Course('fern'),sim=new RallySimulation(c,'scout'),end=c.getSampleAt(c.totalLength-2);sim.x=end.x;sim.z=end.z;sim.frame=c.project(end.x,end.z);sim.step({});assert.equal(sim.finished,false);assert.equal(sim.gate,0);});
test('all campaign routes are finishable by all three handling profiles',()=>{for(const stage of STAGES)for(const car of CARS){const {sim}=drive(stage.id,car.id);assert.equal(sim.finished,true,stage.id+':'+car.id);assert.equal(sim.gate,sim.course.gates.length);assert.ok(sim.elapsed<150);}});
test('server replay accepts completed run and rejects altered time, skipped finish and extra inputs',()=>{
    const {sim,runs}=drive('fern');const payload={stage:'fern',car:'scout',version:RULES_VERSION,time:sim.elapsed,runs};const result=validateReplay(payload);assert.equal(result.time,sim.elapsed);assert.deepEqual(result.splits,sim.splits);
    assert.throws(()=>validateReplay({...payload,time:sim.elapsed-1}),/time/);assert.throws(()=>validateReplay({...payload,runs:[[60,1000,0,0,0,0,0]]}),/finish/);assert.throws(()=>validateReplay({...payload,runs:[...runs,[1,0,0,0,0,0,0]]}),/after the finish/);assert.throws(()=>validateReplay({...payload,runs:[[19000,0,0,0,0,0,0]]}),/Invalid input/);
});
test('daily replay enforces fixed car and rejects malformed analog values',()=>{const {sim,runs}=drive('daily-2026-10-07','comet');const payload={stage:'daily-2026-10-07',car:'comet',version:RULES_VERSION,time:sim.elapsed,runs};assert.equal(validateReplay(payload).time,sim.elapsed);assert.throws(()=>validateReplay({...payload,car:'lynx'}),/daily/);assert.throws(()=>validateReplay({...payload,runs:[[1,2000,0,0,0,0,0]]}),/Invalid input/);});
test('recovery penalties are reproduced by server verification',()=>{const {sim,runs}=drive('fern','scout',{recover:true});assert.equal(sim.penalty,5);assert.equal(validateReplay({stage:'fern',car:'scout',version:RULES_VERSION,time:sim.elapsed,runs}).time,sim.elapsed);});
test('input quick taps survive keyup, repeats do not rearm, blur clears driving',()=>{const h=new InputHandler();h.onKeyDown({code:'KeyP'});h.onKeyUp({code:'KeyP'});assert.equal(h.consume('pause'),true);h.onKeyDown({code:'KeyP',repeat:true});assert.equal(h.consume('pause'),false);h.onKeyDown({code:'KeyW'});assert.equal(h.getState().up,true);h.clear();assert.equal(h.getState().up,false);});
test('medals, per-car records and unlocks persist without replacing a better ghost',()=>{const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},p=new Progress(storage);const stage=getStage('fern'),r={time:60,frames:[[0,0,0,0,0],[60,0,0,10,0]],splits:[20,40,60]};assert.equal(p.unlocked('amber'),false);p.finish(stage,'scout',r);assert.equal(p.unlocked('amber'),true);assert.equal(p.points,2);p.finish(stage,'scout',{...r,time:80});assert.equal(p.best('fern','scout').time,60);assert.equal(p.best('fern','comet'),null);const restored=new Progress(storage);assert.equal(restored.points,2);assert.deepEqual(restored.best('fern','scout'),r);assert.equal(medalFor(56,stage.medals),3);});
test('unavailable and malformed storage do not prevent playing',()=>{const p=new Progress({getItem:()=>'{broken',setItem:()=>{throw Error('quota');}});assert.equal(p.available,false);assert.equal(p.unlocked('fern'),true);assert.doesNotThrow(()=>p.finish(getStage('fern'),'scout',{time:60,frames:[],splits:[]}));});
