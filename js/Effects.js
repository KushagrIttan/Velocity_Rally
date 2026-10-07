// Effects.js — pooled GPU point particles (dust + drift smoke), zero per-frame alloc
import * as THREE from 'three';

export class DustSystem {
    constructor(scene, max = 1600) {
        this.max = max;
        this.head = 0;
        this.pos = new Float32Array(max * 3);
        this.col = new Float32Array(max * 3);
        this.vel = new Float32Array(max * 3);
        this.life = new Float32Array(max);
        this.span = new Float32Array(max);
        for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -200;

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geom.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
        const mat = new THREE.PointsMaterial({
            size: 1.3, vertexColors: true, transparent: true,
            opacity: 0.34, depthWrite: false, sizeAttenuation: true
        });
        this.points = new THREE.Points(geom, mat);
        this.points.frustumCulled = false;
        this.geom = geom;
        scene.add(this.points);
        this._c = new THREE.Color();
    }

    clear() {this.life.fill(0);this.head=0;for(let i=0;i<this.max;i++)this.pos[i*3+1]=-200;this.geom.attributes.position.needsUpdate=true;}

    spawn(x, y, z, vx, vy, vz, life, hex) {
        const i = this.head;
        this.head = (this.head + 1) % this.max;
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
        this.life[i] = life; this.span[i] = life;
        this._c.setHex(hex);
        this.col[i * 3] = this._c.r; this.col[i * 3 + 1] = this._c.g; this.col[i * 3 + 2] = this._c.b;
    }

    // Dust kicked up behind a moving car. surface: 'tarmac' | 'gravel' | 'mud'
    kickUp(x, y, z, speedKmh, surface, slip) {
        const dustColor = surface === 'mud' ? 0x6b4e2e : (surface === 'gravel' ? 0xb9a684 : 0x9a9a9a);
        // Halved output: at most ~1 particle per frame even at speed
        const n = speedKmh > 90 ? 1 : (Math.random() < (speedKmh > 45 ? 0.5 : 0.15) ? 1 : 0);
        for (let k = 0; k < n; k++) {
            const life = 0.5 + Math.random() * 0.6;
            this.spawn(
                x + (Math.random() - 0.5) * 1.6, y + Math.random() * 0.4, z + (Math.random() - 0.5) * 1.6,
                (Math.random() - 0.5) * 3, 1 + Math.random() * 2.2, (Math.random() - 0.5) * 3,
                life, dustColor
            );
        }
        if (slip > 6) { // hard drifting only — pale tire smoke
            this.spawn(
                x, y + 0.3, z,
                (Math.random() - 0.5) * 2, 1.2 + Math.random(), (Math.random() - 0.5) * 2,
                0.4 + Math.random() * 0.4, 0xd8d8d8
            );
        }
    }

    update(dt) {
        const drag = Math.exp(-1.8 * dt);
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) continue;
            this.life[i] -= dt;
            if (this.life[i] <= 0) {
                this.pos[i * 3 + 1] = -200;
                continue;
            }
            this.vel[i * 3] *= drag;
            this.vel[i * 3 + 2] *= drag;
            this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag + 0.5 * dt; // billow upward
            this.pos[i * 3] += this.vel[i * 3] * dt;
            this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
            this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        }
        this.geom.attributes.position.needsUpdate = true;
        this.geom.attributes.color.needsUpdate = true;
    }
}
