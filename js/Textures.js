// Textures.js — procedural canvas textures (zero external assets, all PBR-ready)
import * as THREE from 'three';

function makeCanvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function noiseOver(ctx, w, h, count, lo, hi, size = 1.5, alpha = 1) {
    for (let i = 0; i < count; i++) {
        const g = lo + Math.random() * (hi - lo);
        ctx.fillStyle = `rgba(${g | 0},${g | 0},${(g + 4) | 0},${alpha})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
    }
}

// Road: canvas X = across road (u), canvas Y = along road (v). Matches ribbon UVs.
export function asphaltTexture() {
    return makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#333336';
        ctx.fillRect(0, 0, w, h);
        noiseOver(ctx, w, h, 2600, 38, 78);
        // tire-polish dark bands where wheels run
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(w * 0.20, 0, w * 0.13, h);
        ctx.fillRect(w * 0.67, 0, w * 0.13, h);
        // worn center
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(w * 0.42, 0, w * 0.16, h);
        // edge lines
        ctx.fillStyle = '#e6e6e6';
        ctx.fillRect(2, 0, 4, h);
        ctx.fillRect(w - 6, 0, 4, h);
        // center dashes
        ctx.fillStyle = '#d8b93a';
        for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 2, y, 4, 32);
    });
}

export function grassTexture() {
    return makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#2e6b2c';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 2200; i++) {
            const g = Math.random();
            ctx.fillStyle = g < 0.5 ? 'rgba(20,70,20,0.5)' : (g < 0.8 ? 'rgba(70,130,60,0.45)' : 'rgba(120,150,80,0.35)');
            const s = 1 + Math.random() * 3;
            ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
        }
    });
}

export function dirtTexture() {
    return makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#5d4a33';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i++) {
            const g = 60 + Math.random() * 60;
            ctx.fillStyle = `rgba(${g | 0},${(g * 0.82) | 0},${(g * 0.6) | 0},0.7)`;
            const s = 1 + Math.random() * 3;
            ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
        }
        // ruts
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(w * 0.25, 0, w * 0.1, h);
        ctx.fillRect(w * 0.65, 0, w * 0.1, h);
    });
}

export function bannerTexture(text, sub) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 128;
    const ctx = c.getContext('2d');
    // Bohemian banner: deep teal field, cream type, clay end motifs
    ctx.fillStyle = '#134e4b';
    ctx.fillRect(0, 0, 1024, 128);
    for (let x = 0; x < 1024; x += 32) {
        ctx.fillStyle = (x / 32) % 2 ? '#c96f4a' : '#f3e6cf';
        ctx.beginPath();
        ctx.arc(x + 16, 10, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 16, 118, 7, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(1024, 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 104); ctx.lineTo(1024, 104); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f3e6cf';
    ctx.font = 'italic 700 58px Georgia, serif';
    ctx.fillText(text, 512, 68);
    ctx.fillStyle = '#d9a441';
    ctx.font = 'italic 28px Georgia, serif';
    ctx.fillText(sub, 512, 98);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}

export function numberRoundel(num) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f4f4f4';
    ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#111'; ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = '900 64px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(num), 64, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export function cloudTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// Neutral luminance-detail texture — instance colors provide the hue
// (white/gray leaf blobs multiply cleanly with pine greens and autumn tones)
export function leafClusterTexture() {
    return makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#c4c4c4';
        ctx.fillRect(0, 0, w, h);
        const tones = ['#ffffff', '#e8e8e8', '#9a9a9a', '#6a6a6a', '#484848'];
        for (let i = 0; i < 950; i++) {
            ctx.fillStyle = tones[(Math.random() * tones.length) | 0];
            ctx.globalAlpha = 0.45 + Math.random() * 0.55;
            ctx.beginPath();
            ctx.ellipse(Math.random() * w, Math.random() * h,
                2 + Math.random() * 5, 1 + Math.random() * 3,
                Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    });
}

export function checkerTexture(cells = 8, size = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const step = size / cells;
    for (let y = 0; y < cells; y++) {
        for (let x = 0; x < cells; x++) {
            ctx.fillStyle = (x + y) % 2 ? '#111111' : '#f2f2f2';
            ctx.fillRect(x * step, y * step, step, step);
        }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// Swap a procedural placeholder map for a photo once it loads.
// Keeps the procedural look forever if the download fails.
const _photoLoader = new THREE.TextureLoader();
export function photoSwap(mat, url, rx = 1, ry = 1) {
    try {
        _photoLoader.load(url, t => {
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(rx, ry);
            t.anisotropy = 8;
            t.colorSpace = THREE.SRGBColorSpace;
            const old = mat.map;
            mat.map = t;
            mat.needsUpdate = true;
            if (old && old.isCanvasTexture) old.dispose();
        }, undefined, () => { /* offline — procedural map stays */ });
    } catch (e) { /* texture API unavailable */ }
}
