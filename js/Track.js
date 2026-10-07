// Track.js — textured ribbon road, dirt shoulders, barriers, gantry, forest, mountains
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Course } from './Course.js';
import { seededRandom } from './Stages.js';
import { asphaltTexture, grassTexture, dirtTexture, bannerTexture, cloudTexture,
    leafClusterTexture, checkerTexture, photoSwap } from './Textures.js';

export class Track {
    constructor(scene, stageId = 'fern') {
        this.root = new THREE.Group();
        scene.add(this.root);
        this.scene = this.root;
        this.course = new Course(stageId);
        this.random = seededRandom(this.course.definition.seed);
        Object.assign(this, {points:this.course.points, samples:this.course.samples, curve:this.course.curve, totalLength:this.course.totalLength, bounds:this.course.bounds});
        this.buildMesh();
        this.startPoint = this.points[0].clone();
        this.endPoint = this.points.at(-1).clone();
        this._buildLandmarks();
    }

    dispose() {
        const materials=new Set(),textures=new Set(),geometries=new Set();
        this.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of (Array.isArray(o.material)?o.material:[o.material]))materials.add(m);});
        for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}
        for(const t of textures)t.dispose();for(const g of geometries)g.dispose();
        this.root.removeFromParent();
    }

    _ribbon(width, yOff, mat, vScale, start=0, end=1) {
        const positions = [], uvs = [], indices = [];
        const pt = new THREE.Vector3(), tan = new THREE.Vector3();
        let dist = 0;
        const prev = new THREE.Vector3();
        let first = true;
        const N = Math.max(2, Math.ceil((end-start)*this.totalLength/3));
        for (let i = 0; i <= N; i++) {
            const t = start + i / N * (end-start);
            this.curve.getPointAt(t, pt);
            this.curve.getTangentAt(t, tan);
            if (!first) dist += pt.distanceTo(prev);
            first = false;
            prev.copy(pt);
            let px = -tan.z, pz = tan.x;
            const len = Math.hypot(px, pz) || 1;
            px /= len; pz /= len;
            const hw = width / 2;
            positions.push(pt.x + px * hw, pt.y + yOff, pt.z + pz * hw);
            positions.push(pt.x - px * hw, pt.y + yOff, pt.z - pz * hw);
            uvs.push(0, dist / vScale, 1, dist / vScale);
            if (i < N) {
                const a = i * 2;
                indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(indices);
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, mat);
        mesh.receiveShadow = true;
        return mesh;
    }

    buildMesh() {
        const width = CONFIG.TRACK_WIDTH;

        // Dirt shoulders under the asphalt
        const dirtTex = dirtTexture();
        dirtTex.repeat.set(1, 1);
        this.scene.add(this._ribbon(width + 3, -0.08,
            new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1, side: THREE.DoubleSide }), 6));

        // Visible surface zones use exactly the same boundaries as grip and audio.
        for (const zone of this.course.zones) {
            const tarmac=zone.surface==='tarmac';
            const texture=tarmac?asphaltTexture():dirtTexture();
            const color=zone.surface==='mud'?0x665044:zone.surface==='gravel'?0xc9b88e:0xffffff;
            this.scene.add(this._ribbon(width, 0, new THREE.MeshStandardMaterial({map:texture,color,roughness:1,side:THREE.DoubleSide}), tarmac?8:4,zone.start/this.totalLength,zone.end/this.totalLength));
        }

        // Ground — displaced mesh hugging the track elevation, photo grass over procedural
        const { minX, maxX, minZ, maxZ, minY } = this.bounds;
        const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
        const grassTex = grassTexture();
        grassTex.repeat.set(300, 300);
        this.groundMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
        photoSwap(this.groundMat, 'assets/grass.jpg', 300, 300);
        const gg = new THREE.PlaneGeometry(2600, 2600, 100, 100);
        gg.rotateX(-Math.PI / 2);
        const gpos = gg.attributes.position;
        const GX = 101; // grid resolution (segments + 1)
        const pinD2 = 100; // vertices within 10 m of the road stay pinned
        const pinned = new Uint8Array(gpos.count);
        for (let i = 0; i < gpos.count; i++) {
            const wx = gpos.getX(i) + cx, wz = gpos.getZ(i) + cz;
            let bd = Infinity, by = minY;
            for (let k = 0; k < this.samples.length; k += 2) {
                const s = this.samples[k];
                const dx = wx - s.x, dz = wz - s.z;
                const d = dx * dx + dz * dz;
                if (d < bd) { bd = d; by = s.y; }
            }
            gpos.setY(i, by - 1.2);
            pinned[i] = bd < pinD2 ? 1 : 0;
        }
        // Blur unpinned vertices — kills stretched cliff triangles where the
        // track folds back on itself, while the road corridor stays exact
        for (let pass = 0; pass < 3; pass++) {
            const src = Float32Array.from(gpos.array);
            for (let iy = 0; iy < GX; iy++) {
                for (let ix = 0; ix < GX; ix++) {
                    const i = iy * GX + ix;
                    if (pinned[i]) continue;
                    let sum = 0, n = 0;
                    if (ix > 0) { sum += src[(i - 1) * 3 + 1]; n++; }
                    if (ix < GX - 1) { sum += src[(i + 1) * 3 + 1]; n++; }
                    if (iy > 0) { sum += src[(i - GX) * 3 + 1]; n++; }
                    if (iy < GX - 1) { sum += src[(i + GX) * 3 + 1]; n++; }
                    if (n) gpos.array[i * 3 + 1] = sum / n;
                }
            }
            gpos.needsUpdate = true;
        }
        gg.computeVertexNormals();
        const ground = new THREE.Mesh(gg, this.groundMat);
        ground.position.set(cx, 0, cz);
        ground.receiveShadow = true;
        this.scene.add(ground);

        this._buildBarriers(width);
        this._buildGantry();
        this._buildCheckpointGates();
        this._buildForest();
        this._buildMountains();
        this._buildClouds(minY);
    }

    _buildBarriers(width) {
        // Low red/white fence with gaps — more visual than solid wall
        const step = 6;
        const count = Math.floor(this.totalLength / step) * 2;
        const postGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6);
        const railGeom = new THREE.BoxGeometry(0.04, 0.3, 2.0);
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
        const instPosts = new THREE.InstancedMesh(postGeom, mat, count);
        const instRails = new THREE.InstancedMesh(railGeom, mat, count);
        const dummy = new THREE.Object3D();
        const cTerra = new THREE.Color(0xb4552d), cCream = new THREE.Color(0xf3e6cf);
        let k = 0, rk = 0;
        for (let d = 0; d < this.totalLength && k < count - 1; d += step) {
            const u = Math.min(d / this.totalLength, 1);
            const pt = this.curve.getPointAt(u);
            const tan = this.curve.getTangentAt(u);
            let px = -tan.z, pz = tan.x;
            const len = Math.hypot(px, pz) || 1;
            px /= len; pz /= len;
            for (const s of [1, -1]) {
                // Post
                dummy.position.set(pt.x + px * s * (width / 2 + 0.8), pt.y + 0.25, pt.z + pz * s * (width / 2 + 0.8));
                dummy.rotation.set(0, Math.atan2(tan.x, tan.z), 0);
                dummy.updateMatrix();
                instPosts.setMatrixAt(k, dummy.matrix);
                instPosts.setColorAt(k, (Math.floor(d / step) % 2) ? cCream : cTerra); // alternate cream/terracotta
                k++;
                // Rail (horizontal between posts)
                if (rk < count) {
                    dummy.position.set(pt.x + px * s * (width / 2 + 0.8), pt.y + 0.5, pt.z + pz * s * (width / 2 + 0.8));
                    dummy.rotation.set(0, Math.atan2(tan.x, tan.z), Math.PI / 2);
                    dummy.updateMatrix();
                    instRails.setMatrixAt(rk, dummy.matrix);
                    instRails.setColorAt(rk, (Math.floor(d / step) % 2) ? cCream : cTerra);
                    rk++;
                }
            }
        }
        instPosts.count = k;
        instPosts.instanceMatrix.needsUpdate = true;
        if (instPosts.instanceColor) instPosts.instanceColor.needsUpdate = true;
        instRails.count = rk;
        instRails.instanceMatrix.needsUpdate = true;
        if (instRails.instanceColor) instRails.instanceColor.needsUpdate = true;
        instPosts.castShadow = true;
        instRails.castShadow = true;
        this.scene.add(instPosts);
        this.scene.add(instRails);
    }

    _buildGantry() {
        const width = CONFIG.TRACK_WIDTH;
        const p0 = this.samples[1];
        const yaw = Math.atan2(p0.tx, p0.tz);
        const g = new THREE.Group();
        g.position.set(p0.x, p0.y, p0.z);
        g.rotation.y = yaw;
        const postMat = new THREE.MeshStandardMaterial({ color: 0x134e4b, roughness: 0.4, metalness: 0.8 });
        for (const s of [1, -1]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), postMat);
            post.position.set(s * (width / 2 + 1.5), 3.5, 0);
            post.castShadow = true;
            g.add(post);
        }
        const banner = new THREE.Mesh(
            new THREE.BoxGeometry(width + 4, 1.6, 0.3),
            new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.5 })
        );
        banner.position.y = 6.2;
        banner.castShadow = true;
        g.add(banner);
        const faceMat = new THREE.MeshBasicMaterial({ map: bannerTexture('VELOCITY RALLY', this.course.definition.name.toUpperCase()) });
        for (const s of [1, -1]) {
            const face = new THREE.Mesh(new THREE.PlaneGeometry(width + 3.8, 1.5), faceMat);
            face.position.set(0, 6.2, s * 0.16);
            if (s < 0) face.rotation.y = Math.PI;
            g.add(face);
        }
        this.scene.add(g);
    }

    // Big flagged gates at every checkpoint — poles + numbered banner + waving flags
    _buildCheckpointGates() {
        const width = CONFIG.TRACK_WIDTH;
        this.flags = [];
        const postMat = new THREE.MeshStandardMaterial({ color: 0xb4552d, roughness: 0.5, metalness: 0.4 });
        const flagTex = checkerTexture();
        let n = 0;
        for (const d of this.course.gates) {
            n++;
            const s = this.getSampleAt(d);
            const g = new THREE.Group();
            g.position.set(s.x, s.y, s.z);
            g.rotation.y = Math.atan2(s.tx, s.tz);
            for (const side of [1, -1]) {
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7.5, 8), postMat);
                post.position.set(side * (width / 2 + 1.6), 3.75, 0);
                post.castShadow = true;
                g.add(post);
                const flag = new THREE.Mesh(
                    new THREE.PlaneGeometry(1.3, 0.85),
                    new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 })
                );
                flag.position.set(side * (width / 2 + 1.6) + 0.68, 7.0, 0);
                flag.userData = { base: 0, phase: this.random() * Math.PI * 2 };
                g.add(flag);
                this.flags.push(flag);
            }
            const beam = new THREE.Mesh(
                new THREE.BoxGeometry(width + 4.4, 1.3, 0.25),
                new THREE.MeshStandardMaterial({
                    map: bannerTexture(d === this.course.gates.at(-1) ? 'FINISH' : 'SECTOR ' + n, Math.round(d) + ' m — ' + this.course.definition.name.toUpperCase()),
                    roughness: 0.6
                })
            );
            beam.position.y = 6.1;
            beam.castShadow = true;
            g.add(beam);
            this.scene.add(g);
        }
    }

    _buildForest() {
        // Dense tall forest in zones: dark pines at start/finish,
        // autumn broadleaf + boulders through the middle km
        const PINE = 650, LEAF = 280, ROCK = 65;
        const trunkGeom = new THREE.CylinderGeometry(0.3, 0.45, 3.5, 6);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0xb08a62, roughness: 1 });
        photoSwap(trunkMat, 'assets/bark.jpg', 1, 2);
        const leafDetail = leafClusterTexture();
        leafDetail.repeat.set(3, 3);
        const pineGeom = new THREE.ConeGeometry(2.3, 8.5, 7);
        const pineMat = new THREE.MeshStandardMaterial({ map: leafDetail, roughness: 1 });
        const leafGeom = new THREE.IcosahedronGeometry(2.8, 0);
        const leafMat = new THREE.MeshStandardMaterial({ map: leafDetail, roughness: 1, flatShading: true });
        const rockGeom = new THREE.DodecahedronGeometry(1.4, 0);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x77777d, roughness: 1, flatShading: true });

        const pines = new THREE.InstancedMesh(pineGeom, pineMat, PINE);
        const leaves = new THREE.InstancedMesh(leafGeom, leafMat, LEAF);
        const trunks = new THREE.InstancedMesh(trunkGeom, trunkMat, PINE + LEAF);
        const rocks = new THREE.InstancedMesh(rockGeom, rockMat, ROCK);

        const pineGreens = [0x143f16, 0x1d5220, 0x27652a, 0x0f3512].map(h => new THREE.Color(h));
        const leafTones = [0x9a5a1a, 0xb87a20, 0x5a7a1e, 0x7a3a10, 0xc09a30].map(h => new THREE.Color(h));
        const dummy = new THREE.Object3D();
        const pt = new THREE.Vector3(), tan = new THREE.Vector3();
        const place = (out, dist) => {
            const t = dist / this.totalLength;
            this.curve.getPointAt(THREE.MathUtils.clamp(t, 0, 1), pt);
            this.curve.getTangentAt(THREE.MathUtils.clamp(t, 0, 1), tan);
            let px = -tan.z, pz = tan.x;
            const len = Math.hypot(px, pz) || 1;
            px /= len; pz /= len;
            const side = this.random() > 0.5 ? 1 : -1;
            const off = side * (7 + this.random() * 20);
            out.set(pt.x + px * off, pt.y, pt.z + pz * off);
        };
        const v = new THREE.Vector3();
        let pi = 0, li = 0, ti = 0;
        const total = PINE + LEAF;
        for (let i = 0; i < total; i++) {
            const dist = this.random() * this.totalLength;
            const midZone = dist > this.totalLength*.3 && dist < this.totalLength*.75;
            place(v, dist);
            const s = 0.9 + this.random() * 0.9; // tall canopy
            // trunk
            dummy.position.set(v.x, v.y + 1.7 * s, v.z);
            dummy.scale.set(s, s, s);
            dummy.rotation.set(0, this.random() * Math.PI, 0);
            dummy.updateMatrix();
            trunks.setMatrixAt(ti++, dummy.matrix);
            if (midZone && li < LEAF) {
                dummy.position.set(v.x, v.y + (3.5 + 2.4) * s, v.z);
                dummy.updateMatrix();
                leaves.setMatrixAt(li, dummy.matrix);
                leaves.setColorAt(li, leafTones[(this.random() * leafTones.length) | 0]);
                li++;
            } else if (pi < PINE) {
                dummy.position.set(v.x, v.y + (3.5 + 3.6) * s, v.z);
                dummy.updateMatrix();
                pines.setMatrixAt(pi, dummy.matrix);
                pines.setColorAt(pi, pineGreens[(this.random() * pineGreens.length) | 0]);
                pi++;
            } else if (li < LEAF) {
                dummy.position.set(v.x, v.y + (3.5 + 2.4) * s, v.z);
                dummy.updateMatrix();
                leaves.setMatrixAt(li, dummy.matrix);
                leaves.setColorAt(li, leafTones[(this.random() * leafTones.length) | 0]);
                li++;
            }
        }
        pines.count = pi; leaves.count = li; trunks.count = ti;
        for (const m of [pines, leaves, trunks]) {
            m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
        pines.castShadow = true;
        leaves.castShadow = true;
        this.scene.add(pines);
        this.scene.add(leaves);
        this.scene.add(trunks);

        // Boulders scattered through the middle km
        for (let i = 0; i < ROCK; i++) {
            const dist = this.totalLength*(.3+this.random()*.5);
            place(v, dist);
            const s = 0.5 + this.random() * 1.6;
            dummy.position.set(v.x, v.y + 0.2 * s, v.z);
            dummy.scale.set(s, s * 0.7, s);
            dummy.rotation.set(this.random(), this.random() * Math.PI, this.random());
            dummy.updateMatrix();
            rocks.setMatrixAt(i, dummy.matrix);
        }
        rocks.instanceMatrix.needsUpdate = true;
        rocks.castShadow = true;
        this.scene.add(rocks);
    }

    _buildMountains() {
        // Distant hazy ridgelines — broad, low, half-lost in fog so they
        // tease through the treeline instead of looming like pyramids
        const mat = new THREE.MeshStandardMaterial({ color: 0x4c5c62, roughness: 1, flatShading: true });
        const snowMat = new THREE.MeshStandardMaterial({ color: 0xc7d2da, roughness: 1, flatShading: true });
        const { minX, maxX, minZ, maxZ, minY } = this.bounds;
        for (let i = 0; i < 12; i++) {
            const h = 90 + this.random() * 110;
            const r = 150 + this.random() * 130;
            const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mat);
            const a = (i / 12) * Math.PI * 2 + this.random() * 0.3;
            const d = 1150 + this.random() * 250;
            m.position.set(
                (minX + maxX) / 2 + Math.cos(a) * d,
                minY + h / 2 - 45,
                (minZ + maxZ) / 2 + Math.sin(a) * d
            );
            m.rotation.y = this.random() * Math.PI;
            this.scene.add(m);
            const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.26, h * 0.26, 7), snowMat);
            cap.position.set(m.position.x, m.position.y + h * 0.37, m.position.z);
            cap.rotation.y = m.rotation.y;
            this.scene.add(cap);
        }
    }

    _buildClouds(minY) {
        const tex = cloudTexture();
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false });
        this.clouds = [];
        for (let i = 0; i < 10; i++) {
            const sp = new THREE.Sprite(mat);
            sp.position.set((this.random() - 0.5) * 1800, minY + 180 + this.random() * 120, (this.random() - 0.5) * 1800);
            const s = 150 + this.random() * 150;
            sp.scale.set(s, s * 0.45, 1);
            this.scene.add(sp);
            this.clouds.push(sp);
        }
    }

    _buildLandmarks() {
        // Corner chevrons and surface boards provide braking references.
        for (const corner of this.course.corners) {
            const s=this.getSampleAt(Math.max(0,corner.dist-25));
            const group=new THREE.Group();group.position.set(s.x,s.y,s.z);group.rotation.y=Math.atan2(s.tx,s.tz);
            const side=corner.dir==='LEFT'?1:-1;
            const post=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,2.5,6),new THREE.MeshStandardMaterial({color:0xddd3b8}));post.position.set(side*5.4,1.25,0);group.add(post);
            const sign=new THREE.Mesh(new THREE.PlaneGeometry(2,1),new THREE.MeshBasicMaterial({map:bannerTexture(corner.dir==='LEFT'?'<<<':'>>>','BRAKE · '+corner.sev),side:THREE.DoubleSide}));sign.position.set(side*5.4,2.2,0);sign.rotation.y=Math.PI;group.add(sign);this.scene.add(group);
        }
        for(const zone of this.course.zones.slice(1)) {
            const s=this.getSampleAt(zone.start-12);
            const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.5,1.2),new THREE.MeshBasicMaterial({map:bannerTexture(zone.surface.toUpperCase(),'SURFACE CHANGE'),side:THREE.DoubleSide}));
            sign.position.set(s.x+s.tz*6,s.y+2,s.z-s.tx*6);sign.rotation.y=Math.atan2(s.tx,s.tz)+Math.PI;this.scene.add(sign);
        }
        // Distinct spectator shelters mark the middle of each route.
        const s=this.getSampleAt(this.totalLength*.5);
        const roof=new THREE.Mesh(new THREE.ConeGeometry(6,3,4),new THREE.MeshStandardMaterial({color:0xc96f4a}));
        roof.position.set(s.x+s.tz*16,s.y+5,s.z-s.tx*16);roof.rotation.y=Math.PI/4;roof.castShadow=true;this.scene.add(roof);
        for(const x of [-3,3])for(const z of [-3,3]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,4,6),new THREE.MeshStandardMaterial({color:0xe4cda1}));post.position.set(roof.position.x+x,s.y+2,roof.position.z+z);this.scene.add(post);}
    }
    getClosestPoint(pos) {const s=this.course.project(pos.x,pos.z);return new THREE.Vector3(s.x,s.y,s.z);}
    getSurfaceAt(pos) {const name=this.course.surfaceAt(this.course.project(pos.x,pos.z).dist);return CONFIG.SURFACES[name.toUpperCase()];}
    getFrameAt(pos) {return this.course.project(pos.x,pos.z);}
    getSampleAt(dist) {return this.course.getSampleAt(dist);}
    getCornerAhead(pos) {return this.course.cornerAhead(this.course.project(pos.x,pos.z).dist,20);}
}
