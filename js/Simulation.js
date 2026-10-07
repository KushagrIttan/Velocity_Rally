import { CARS, STEP } from './Stages.js';
export const GRIP = {tarmac:1,gravel:0.76,mud:0.55};
export const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
export function normalizeInput(input={}) {
    return {throttle:clamp(Number(input.throttle)||0,0,1),brake:clamp(Number(input.brake)||0,0,1),steer:clamp(Number(input.steer)||0,-1,1),handbrake:clamp(Number(input.handbrake)||0,0,1),reverse:!!input.reverse,reset:!!input.reset};
}
export class RallySimulation {
    constructor(course,carId) {
        this.course=course;this.car=CARS.find(c=>c.id===carId);
        if(!this.car)throw new Error('Unknown car');
        this.x=0;this.z=0;this.y=0;this.yaw=0;this.vx=0;this.vz=0;this.pedal=0;this.steering=0;this.speed=0;this.slip=0;this.damage=0;this.ticks=0;this.penalty=0;this.gate=0;this.splits=[];this.distanceDriven=0;this.finished=false;this.impact=0;this.surface='tarmac';this.lastResetTick=-999;
        this.reset(false);this.previous={x:this.x,y:this.y,z:this.z,yaw:this.yaw};
    }
    get elapsed() { return this.ticks*STEP+this.penalty; }
    reset(penalize=true) {
        const distance=this.gate===0?0:this.course.gates[this.gate-1]+1;
        const s=this.course.getSampleAt(distance);
        this.x=s.x;this.y=s.y+.15;this.z=s.z;this.yaw=Math.atan2(s.tx,s.tz);this.vx=0;this.vz=0;this.speed=0;this.slip=0;this.pedal=0;this.steering=0;this.frame=this.course.project(this.x,this.z,s.index);this.surface=this.course.surfaceAt(this.frame.dist);
        if(penalize)this.penalty+=5;
        this.previous={x:this.x,y:this.y,z:this.z,yaw:this.yaw};
    }
    step(raw) {
        if(this.finished)return;
        const input=normalizeInput(raw),dt=STEP;
        this.previous={x:this.x,y:this.y,z:this.z,yaw:this.yaw};this.impact=0;
        if(input.reset&&this.ticks-this.lastResetTick>30){this.lastResetTick=this.ticks;this.reset();}
        this.ticks++;this.braking=input.brake>0||input.handbrake>0;
        const oldX=this.x,oldZ=this.z,oldDist=this.frame.dist;
        this.surface=this.course.surfaceAt(oldDist);
        const shoulder=Math.abs(this.frame.lateral)>3.9;
        const grip=GRIP[this.surface]*this.car.grip*(shoulder?0.75:1);
        this.pedal+=(input.throttle-this.pedal)*(1-Math.exp(-7*dt));
        this.steering+=(input.steer-this.steering)*(1-Math.exp(-10*dt));
        let fx=Math.sin(this.yaw),fz=Math.cos(this.yaw),forward=this.vx*fx+this.vz*fz;
        const reverse=input.reverse&&this.speed<9;
        const drive=(reverse?-4.2:this.pedal*this.car.power*Math.max(0,1-Math.max(0,forward)/this.car.maxSpeed))*(1-this.damage*.25);
        this.vx+=fx*drive*dt;this.vz+=fz*drive*dt;
        let magnitude=Math.hypot(this.vx,this.vz);
        // Brake opposes actual motion and never pushes through zero.
        const decel=input.brake*18+input.handbrake*7+0.32+0.0028*magnitude*magnitude+(shoulder?1.7:0);
        const keep=magnitude>0?Math.max(0,magnitude-decel*dt)/magnitude:0;
        this.vx*=keep;this.vz*=keep;
        forward=this.vx*fx+this.vz*fz;
        const yawRate=this.steering*this.car.turn*Math.tanh(forward/8)/(1+Math.abs(forward)/55)*(1+input.handbrake*.75);
        this.yaw+=yawRate*dt;
        fx=Math.sin(this.yaw);fz=Math.cos(this.yaw);
        forward=this.vx*fx+this.vz*fz;
        let lateral=this.vx*fz-this.vz*fx;
        // Grip is strongest when coasting/braking; throttle loosens the rear.
        lateral*=Math.exp(-(2.4+grip*5.5)*(1-input.handbrake*.80)*(1-this.pedal*(this.car.id==='lynx'?.28:.08))*dt);
        this.vx=fx*forward+fz*lateral;this.vz=fz*forward-fx*lateral;
        if(reverse){const v=Math.hypot(this.vx,this.vz);if(v>7){this.vx*=7/v;this.vz*=7/v;}}
        this.slip=Math.abs(lateral);
        this.x+=this.vx*dt;this.z+=this.vz*dt;
        let frame=this.course.project(this.x,this.z,this.frame.index);
        const limit=4.65;
        if(Math.abs(frame.lateral)>limit){
            const side=Math.sign(frame.lateral),excess=Math.abs(frame.lateral)-limit,rx=frame.tz,rz=-frame.tx;
            this.x-=rx*excess*side;this.z-=rz*excess*side;
            const out=this.vx*rx+this.vz*rz;
            if(out*side>0){this.vx-=rx*out*1.15;this.vz-=rz*out*1.15;if(Math.abs(out)>2){this.impact=Math.abs(out);this.damage=clamp(this.damage+Math.abs(out)*.002,0,1);}}
            frame=this.course.project(this.x,this.z,frame.index);
        }
        this.frame=frame;this.y=frame.y+.15;this.speed=Math.hypot(this.vx,this.vz);
        this.distanceDriven+=Math.hypot(this.x-oldX,this.z-oldZ);
        const target=this.course.gates[this.gate];
        if(target!==undefined&&oldDist<target&&frame.dist>=target&&Math.abs(frame.lateral)<4.7){this.splits.push(this.elapsed);this.gate++;}
        if(this.gate===this.course.gates.length)this.finished=true;
    }
    snapshot() {return [this.elapsed,this.x,this.y,this.z,this.yaw];}
}
export class FixedClock {
    constructor(){this.accumulator=0;this.dropped=false;}
    advance(seconds,step) {
        // Very long stalls pause a competitive run instead of dropping race time.
        if(seconds>.25){this.accumulator=0;this.dropped=true;return false;}
        this.accumulator+=Math.max(0,seconds);
        while(this.accumulator+1e-10>=STEP){step();this.accumulator-=STEP;}
        return true;
    }
    get alpha(){return clamp(this.accumulator/STEP,0,1);}
    reset(){this.accumulator=0;this.dropped=false;}
}
