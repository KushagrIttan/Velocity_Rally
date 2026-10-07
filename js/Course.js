import * as THREE from 'three';
import { getStage } from './Stages.js';

export class Course {
    constructor(id) {
        this.definition = getStage(id);
        this.points = [];
        this.zones = [];
        this.corners = [];
        let x=0,z=0,yaw=0,distance=0;
        const height = d => Math.sin(d / 120) * 2.2 + Math.sin(d / 270) * 3.5;
        this.points.push(new THREE.Vector3(x,height(0),z));
        for (const [length, angle, surface] of this.definition.blocks) {
            this.zones.push({ start: distance, end: distance+length, surface });
            if (Math.abs(angle)>15) this.corners.push({ id:this.corners.length, dist:distance+length*0.12, dir:angle<0?'LEFT':'RIGHT', sev:Math.abs(angle)>95?2:Math.abs(angle)>65?3:Math.abs(angle)>45?4:5, hairpin:false });
            const n=Math.ceil(length/8), step=length/n;
            for (let i=0;i<n;i++) {
                // Smooth corner entry/exit: normalized sinusoidal curvature.
                yaw += angle*Math.PI/180 * Math.sin(Math.PI*(i+.5)/n) / (1/Math.sin(Math.PI/(2*n)));
                x += Math.sin(yaw)*step; z += Math.cos(yaw)*step; distance += step;
                this.points.push(new THREE.Vector3(x,height(distance),z));
            }
        }
        this.curve = new THREE.CatmullRomCurve3(this.points);
        const n=Math.ceil(distance/2);
        this.samples=[];
        let total=0,previous=null;
        for(let i=0;i<=n;i++) {
            const p=this.curve.getPointAt(i/n),t=this.curve.getTangentAt(i/n);
            if(previous)total+=p.distanceTo(previous);
            const norm=Math.hypot(t.x,t.z)||1;
            this.samples.push({x:p.x,y:p.y,z:p.z,tx:t.x/norm,tz:t.z/norm,dist:total}); previous=p;
        }
        this.totalLength=total;
        const ratio=total/distance;
        for(const zone of this.zones){zone.start*=ratio;zone.end*=ratio;}
        for(const corner of this.corners)corner.dist*=ratio;
        this.gates=[];
        for(let d=250;d<total-80;d+=250)this.gates.push(d);
        this.gates.push(total-5);
        this.bounds={minX:Math.min(...this.points.map(p=>p.x)),maxX:Math.max(...this.points.map(p=>p.x)),minZ:Math.min(...this.points.map(p=>p.z)),maxZ:Math.max(...this.points.map(p=>p.z)),minY:Math.min(...this.points.map(p=>p.y))};
    }
    getSampleAt(distance) {
        const d=Math.max(0,Math.min(this.totalLength,distance));
        const index=Math.min(this.samples.length-2,Math.floor(d/this.totalLength*(this.samples.length-1)));
        const a=this.samples[index],b=this.samples[index+1];
        const t=Math.max(0,Math.min(1,(d-a.dist)/(b.dist-a.dist)));
        const tx=a.tx+(b.tx-a.tx)*t,tz=a.tz+(b.tz-a.tz)*t,n=Math.hypot(tx,tz)||1;
        return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,tx:tx/n,tz:tz/n,dist:d,index};
    }
    project(x,z,hint=null) {
        let best=null,minimum=Infinity;
        const lo=hint===null?0:Math.max(0,hint-12),hi=hint===null?this.samples.length-1:Math.min(this.samples.length-1,hint+24);
        for(let i=lo;i<hi;i++) {
            const a=this.samples[i],b=this.samples[i+1],dx=b.x-a.x,dz=b.z-a.z;
            const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
            const px=a.x+dx*t,pz=a.z+dz*t,dist2=(x-px)**2+(z-pz)**2;
            if(dist2<minimum){minimum=dist2;const norm=Math.hypot(dx,dz)||1;best={x:px,y:a.y+(b.y-a.y)*t,z:pz,tx:dx/norm,tz:dz/norm,dist:a.dist+(b.dist-a.dist)*t,index:i,lateral:(x-px)*dz/norm-(z-pz)*dx/norm,gap:Math.sqrt(dist2)};}
        }
        return best;
    }
    surfaceAt(distance) { return (this.zones.find(z=>distance<=z.end)||this.zones.at(-1)).surface; }
    cornerAhead(distance,speed) { const lead=Math.max(55,Math.min(155,speed*4)); const c=this.corners.find(c=>c.dist>distance-12&&c.dist-distance<lead); return c?{...c,dist:Math.max(0,c.dist-distance)}:null; }
}
