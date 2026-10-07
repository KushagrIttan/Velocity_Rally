// Vehicle.js — detailed procedural rally car (PBR, headlights, brake glow, livery)
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { numberRoundel } from './Textures.js';

export class Vehicle {
    constructor(scene) {
        this.scene = scene;

        // State
        this.position = new THREE.Vector3(0, 2, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        this.angularVelocity = 0;

        this.speed = 0; // km/h
        this.gear = 1;
        this.rpm = 1000;
        this.steering = 0;
        this.steerTarget = 0;
        this.throttle = 0;
        this.brake = 0;
        this.handbrake = 0;
        this.slip = 0; // lateral slip speed (m/s) — drives smoke + skid audio

        this.damage = 0;
        this.surface = CONFIG.SURFACES.TARMAC;
        this.headlightsOn = true;

        this.initModel();
    }

    _box(w, h, d, mat, x, y, z) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        this.group.add(m);
        return m;
    }

    initModel() {
        this.group = new THREE.Group();

        const paint = this.paint = new THREE.MeshStandardMaterial({ color: 0x3bafa1, roughness: 0.4, metalness: 0.2 });
        const darkTrim = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.7, metalness: 0.2 });
        const glass = new THREE.MeshStandardMaterial({ color: 0x0e1a24, roughness: 0.05, metalness: 0.9 });
        const white = new THREE.MeshStandardMaterial({ color: 0xf3e6cf, roughness: 0.4, metalness: 0.3 });
        const terra = new THREE.MeshStandardMaterial({ color: 0xc96f4a, roughness: 0.45, metalness: 0.4 });

        // Chassis + bumpers + skirts + splitter
        this._box(1.9, 0.55, 4.4, paint, 0, 0.62, 0);
        this._box(1.95, 0.4, 0.5, darkTrim, 0, 0.45, 2.1);   // front bumper
        this._box(1.95, 0.4, 0.5, darkTrim, 0, 0.45, -2.1);  // rear bumper
        this._box(2.0, 0.12, 0.6, darkTrim, 0, 0.22, 2.3);   // splitter
        this._box(0.12, 0.3, 4.0, darkTrim, 1.0, 0.35, 0);   // skirts
        this._box(0.12, 0.3, 4.0, darkTrim, -1.0, 0.35, 0);

        // Cabin + roof scoop + hood vents + mirrors
        const cabin = this._box(1.6, 0.55, 2.0, glass, 0, 1.15, -0.4);
        cabin.castShadow = true;
        this._box(1.64, 0.1, 2.04, paint, 0, 1.46, -0.4);    // roof panel over glass
        this._box(0.4, 0.12, 0.5, darkTrim, 0, 1.58, 0.4);    // roof scoop
        this._box(0.5, 0.04, 0.7, darkTrim, 0.4, 0.92, 1.3); // hood vents
        this._box(0.5, 0.04, 0.7, darkTrim, -0.4, 0.92, 1.3);
        this._box(0.22, 0.12, 0.1, paint, 1.05, 1.05, 0.3);  // mirrors
        this._box(0.22, 0.12, 0.1, paint, -1.05, 1.05, 0.3);

        // Livery: hood/roof stripes + door number roundels
        this._box(0.5, 0.02, 4.42, white, 0, 0.905, 0);
        const roundelTex = numberRoundel(7);
        const roundelMat = new THREE.MeshBasicMaterial({ map: roundelTex, transparent: true });
        for (const s of [1, -1]) {
            const r = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), roundelMat);
            r.position.set(s * 0.96, 0.62, -0.2);
            r.rotation.y = s * Math.PI / 2;
            this.group.add(r);
        }

        // Rear wing: blade + mounts + endplates
        this._box(1.8, 0.07, 0.5, darkTrim, 0, 1.55, -2.0);
        this._box(0.08, 0.55, 0.3, darkTrim, 0.6, 1.25, -2.0);
        this._box(0.08, 0.55, 0.3, darkTrim, -0.6, 1.25, -2.0);
        this._box(0.06, 0.4, 0.55, terra, 0.92, 1.5, -2.0);
        this._box(0.06, 0.4, 0.55, terra, -0.92, 1.5, -2.0);

        // Headlights: housings + emissive lenses + real spot beams
        this.lampMat = new THREE.MeshStandardMaterial({
            color: 0xfff8d8, emissive: 0xfff2c0, emissiveIntensity: 3, roughness: 0.2
        });
        for (const s of [1, -1]) {
            this._box(0.45, 0.22, 0.1, darkTrim, s * 0.6, 0.72, 2.32);
            const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.16), this.lampMat);
            lens.position.set(s * 0.6, 0.72, 2.38);
            this.group.add(lens);
        }
        this.beams = [];
        for (const s of [1, -1]) {
            const spot = new THREE.SpotLight(0xfff2cc, 150, 170, 0.55, 0.5, 1.1);
            spot.position.set(s * 0.6, 0.8, 2.2);
            const tgt = new THREE.Object3D();
            tgt.position.set(s * 2.5, -0.5, 40);
            this.group.add(tgt);
            spot.target = tgt;
            this.group.add(spot);
            this.beams.push(spot);
        }

        // Taillight bar — glows harder under braking
        this.tailMat = new THREE.MeshStandardMaterial({
            color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 1.2, roughness: 0.3
        });
        const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 0.06), this.tailMat);
        tail.position.set(0, 0.78, -2.36);
        this.group.add(tail);

        // Wheels: tire + rim + hub, front pair on steer pivots
        this.wheelSpinners = [];
        this.frontPivots = [];
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xc8c8ce, roughness: 0.25, metalness: 0.9 });
        const tireGeom = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 20);
        tireGeom.rotateZ(Math.PI / 2);
        const rimGeom = new THREE.CylinderGeometry(0.23, 0.23, 0.34, 12);
        rimGeom.rotateZ(Math.PI / 2);
        const mkWheel = (x, z, front) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.42, z);
            const tire = new THREE.Mesh(tireGeom, tireMat);
            tire.castShadow = true;
            const rim = new THREE.Mesh(rimGeom, rimMat);
            const spin = new THREE.Group();
            spin.add(tire); spin.add(rim);
            pivot.add(spin);
            this.group.add(pivot);
            this.wheelSpinners.push(spin);
            if (front) this.frontPivots.push(pivot);
        };
        mkWheel(0.95, 1.45, true); mkWheel(-0.95, 1.45, true);
        mkWheel(0.95, -1.45, false); mkWheel(-0.95, -1.45, false);

        // Mudflaps + exhaust
        for (const [x, z] of [[0.95, -1.9], [-0.95, -1.9], [0.95, 1.0], [-0.95, 1.0]]) {
            this._box(0.3, 0.35, 0.04, darkTrim, x, 0.3, z);
        }
        const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 0.2, metalness: 1 });
        const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.35, 12), exhaustMat);
        exhaust.rotation.x = Math.PI / 2;
        exhaust.position.set(0.55, 0.3, -2.4);
        this.group.add(exhaust);

        this.scene.add(this.group);
    }

    toggleHeadlights() {
        this.headlightsOn = !this.headlightsOn;
        for (const b of this.beams) b.visible = this.headlightsOn;
        this.lampMat.emissiveIntensity = this.headlightsOn ? 3 : 0.15;
        return this.headlightsOn;
    }

    sync(sim, alpha=1) {
        this.position.set(sim.x,sim.y,sim.z);this.rotation.y=sim.yaw;
        this.velocity.set(sim.vx,0,sim.vz);this.speed=sim.speed*3.6;this.slip=sim.slip;this.damage=sim.damage;this.pedal=sim.pedal;
        this.gear=sim.vx*Math.sin(sim.yaw)+sim.vz*Math.cos(sim.yaw)<-.1?'R':Math.min(5,Math.max(1,Math.floor(this.speed/32)+1));
        this.rpm=1000+(this.speed%32)*145;this.surface=CONFIG.SURFACES[sim.surface.toUpperCase()];
        const p=sim.previous;
        this.group.position.set(p.x+(sim.x-p.x)*alpha,p.y+(sim.y-p.y)*alpha,p.z+(sim.z-p.z)*alpha);
        this.group.rotation.set(-sim.pedal*.025, p.yaw+(sim.yaw-p.yaw)*alpha, -sim.steering*Math.min(sim.speed/25,1)*.045);
        for(const pivot of this.frontPivots)pivot.rotation.y=sim.steering*.4;
        for(const spinner of this.wheelSpinners)spinner.rotation.x=sim.distanceDriven/.42;
        this.tailMat.emissiveIntensity=sim.braking?5:1.2;
    }
    setLivery(color) {this.paint.color.setHex(color);}

    // Rear-wheel world positions (dust spawn points)
    rearWheelPos(out) {
        const off = new THREE.Vector3(0, 0.1, -1.45).applyQuaternion(this.group.quaternion);
        return out.copy(this.position).add(off);
    }
}
