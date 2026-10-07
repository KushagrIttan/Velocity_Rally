// HUD.js — gauges, live minimap, countdown, co-driver corner callouts
export class HUD {
    constructor() {
        this.speedEl = document.getElementById('ui-speed');
        this.gearEl = document.getElementById('ui-gear');
        this.timerEl = document.getElementById('ui-timer');
        this.paceNoteEl = document.getElementById('pace-note');
        this.countEl = document.getElementById('countdown');
        this.msgEl = document.getElementById('flash-msg');
        this.map = document.getElementById('minimap');
        this.mapCtx = this.map ? this.map.getContext('2d') : null;
        this.padEl = document.getElementById('pad-status');
        this.needleEl = document.getElementById('ui-needle');
        this.msgTimer = null;
        this.countEl.hidden=true;this.msgEl.hidden=true;this.paceNoteEl.hidden=true;
    }

    update(speed, gear, elapsedMs) {
        const v = Math.floor(speed);
        this.speedEl.textContent = v;
        this.gearEl.textContent = gear;
        this.timerEl.textContent = HUD.fmt(elapsedMs);
        if (this.needleEl) {
            // Sweep -120°..+120° across 0..240 km/h
            const a = -120 + Math.min(Math.max(v, 0), 240) / 240 * 240;
            this.needleEl.style.transform = `rotate(${a}deg)`;
        }
    }

    static fmt(elapsedMs) {
        const centis=Math.max(0,Math.floor(elapsedMs/10+1e-7));
        const m=String(Math.floor(centis/6000)).padStart(2,'0');
        const sec=String(Math.floor(centis/100)%60).padStart(2,'0');
        const fraction=String(centis%100).padStart(2,'0');
        return `${m}:${sec}.${fraction}`;
    }

    getTimeString() {
        return this.timerEl.textContent;
    }

    setCountdown(text) {
        if (!this.countEl) return;
        if (text === null) {
            this.countEl.hidden=true;
            this.countEl.style.opacity = 0;
            return;
        }
        this.countEl.hidden=false;
        this.countEl.textContent = text;
        this.countEl.style.opacity = 1;
    }

    flashMessage(text) {
        if (!this.msgEl) return;
        this.msgEl.hidden=false;
        this.msgEl.textContent = text;
        this.msgEl.style.opacity = 1;
        clearTimeout(this.msgTimer);
        this.msgTimer = setTimeout(() => { this.msgEl.hidden=true;this.msgEl.style.opacity = 0; }, 1400);
    }

    setPadStatus(text) {
        if (!this.padEl) return;
        if (text === null) {
            this.padEl.style.opacity = 0;
            return;
        }
        this.padEl.textContent = text;
        this.padEl.style.opacity = 1;
    }

    // corner: { dir: 'LEFT'|'RIGHT', sev: 1..6, dist, hairpin } | null
    showCorner(corner) {
        if (!corner) {
            this.paceNoteEl.hidden=true;
            this.paceNoteEl.style.opacity = 0;
            return;
        }
        this.paceNoteEl.hidden=false;
        const arrow = corner.dir === 'LEFT' ? '<' : '>';
        const label = corner.hairpin ? 'HAIRPIN' : String(corner.sev);
        this.paceNoteEl.textContent = `${arrow} ${corner.dir} ${label} — ${Math.round(corner.dist)}m`;
        this.paceNoteEl.style.opacity = 1;
    }

    drawMinimap(track, carPos, heading) {
        if (!this.mapCtx || !track.bounds) return;
        const ctx = this.mapCtx;
        const W = this.map.width, H = this.map.height;
        const { minX, maxX, minZ, maxZ } = track.bounds;
        const pad = 12;
        const sx = (W - pad * 2) / Math.max(maxX - minX, 1);
        const sz = (H - pad * 2) / Math.max(maxZ - minZ, 1);
        const sc = Math.min(sx, sz);
        const ox = (W - (maxX - minX) * sc) / 2;
        const oz = (H - (maxZ - minZ) * sc) / 2;
        const X = x => ox + (x - minX) * sc;
        const Z = z => oz + (z - minZ) * sc;

        ctx.clearRect(0, 0, W, H);
        // track ribbon
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const pts = track.points;
        for (let i = 0; i < pts.length; i += 2) {
            const x = X(pts[i].x), z = Z(pts[i].z);
            if (i === 0) ctx.moveTo(x, z);
            else ctx.lineTo(x, z);
        }
        ctx.stroke();
        // start marker
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(X(pts[0].x), Z(pts[0].z), 4, 0, Math.PI * 2);
        ctx.fill();
        // car arrow
        const cx = X(carPos.x), cz = Z(carPos.z);
        ctx.save();
        ctx.translate(cx, cz);
        ctx.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) * 0 + headingToMap(heading));
        ctx.fillStyle = '#ff3344';
        ctx.beginPath();
        ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5);
        ctx.closePath(); ctx.fill();
        ctx.restore();

        function headingToMap(h) {
            // world: heading 0 = +z. map: +z is down (+y canvas). Arrow drawn pointing up (-y).
            return Math.PI - h;
        }
    }
}
