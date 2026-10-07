import { Course } from '../js/Course.js';
import { RallySimulation } from '../js/Simulation.js';
import { appendInput, unpackInput } from '../js/Ghost.js';
export function drive(stage,car='scout',{recover=false}={}) {
    const course=new Course(stage),sim=new RallySimulation(course,car),runs=[];
    for(let i=0;i<18000&&!sim.finished;i++) {
        const f=sim.frame,target=course.getSampleAt(f.dist+Math.max(8,sim.speed*.65));
        let angle=Math.atan2(target.x-sim.x,target.z-sim.z)-sim.yaw;angle=Math.atan2(Math.sin(angle),Math.cos(angle));
        const curve=course.getSampleAt(f.dist+35);let bend=Math.atan2(curve.tx,curve.tz)-Math.atan2(f.tx,f.tz);bend=Math.abs(Math.atan2(Math.sin(bend),Math.cos(bend)));
        const desired=bend>.45?14:bend>.2?20:26;
        const input={throttle:sim.speed<desired?1:.3,brake:sim.speed>desired+2?.6:0,steer:Math.max(-1,Math.min(1,angle*3.8)),handbrake:0,reverse:false,reset:recover&&i===1500};
        appendInput(runs,input);sim.step(unpackInput(runs.at(-1)));
    }
    return {course,sim,runs};
}
