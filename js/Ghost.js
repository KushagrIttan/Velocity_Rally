import * as THREE from 'three';
export class Ghost {
    constructor(scene,color=0xe4c36d) {
        const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.28,depthWrite:false});
        this.group=new THREE.Group();
        const body=new THREE.Mesh(new THREE.BoxGeometry(1.9,.65,4.3),mat);body.position.y=.65;this.group.add(body);
        const roof=new THREE.Mesh(new THREE.BoxGeometry(1.5,.55,1.9),mat);roof.position.set(0,1.2,-.3);this.group.add(roof);
        const edge=new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry),new THREE.LineBasicMaterial({color,transparent:true,opacity:.65}));edge.position.copy(body.position);this.group.add(edge);
        scene.add(this.group);this.frames=[];this.group.visible=false;this.index=0;
    }
    load(frames=[]) {this.frames=frames;this.index=0;}
    update(time,enabled) {
        const f=this.frames;this.group.visible=!!enabled&&f.length>1&&time<=f.at(-1)[0];if(!this.group.visible)return;
        while(this.index<f.length-2&&f[this.index+1][0]<time)this.index++;
        if(time<f[this.index][0])this.index=0;
        const a=f[this.index],b=f[Math.min(this.index+1,f.length-1)];let t=Math.max(0,Math.min(1,(time-a[0])/(b[0]-a[0]||1)));
        if(Math.hypot(b[1]-a[1],b[3]-a[3])>15)t=0;
        this.group.position.set(a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t);
        this.group.rotation.y=a[4]+(b[4]-a[4])*t;
    }
}
export function appendInput(runs,input) {
    const packed=[Math.round(input.throttle*1000),Math.round(input.brake*1000),Math.round(input.steer*1000),Math.round(input.handbrake*1000),input.reverse?1:0,input.reset?1:0];
    const last=runs.at(-1);
    if(last&&last.slice(1).every((v,i)=>v===packed[i]))last[0]++;
    else runs.push([1,...packed]);
}
export function unpackInput(run){return {throttle:run[1]/1000,brake:run[2]/1000,steer:run[3]/1000,handbrake:run[4]/1000,reverse:!!run[5],reset:!!run[6]};}
