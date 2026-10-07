// AudioEngine.js — layered flat-four: twin osc + sub + exhaust noise, skid,
// surface rolling rattle, wind, anti-lag pops, shift thunk, chimes, fanfare
export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.prevThr = 0;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
            return;
        }
        const ctx = this.ctx;
        this.master = ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(ctx.destination);

        // Shared noise buffer
        const len = ctx.sampleRate;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
        const noiseSrc = () => {
            const s = ctx.createBufferSource();
            s.buffer = buf;
            s.loop = true;
            s.start();
            return s;
        };

        // --- Engine stack ---
        this.engGain = ctx.createGain();
        this.engGain.gain.value = 0;
        this.engFilter = ctx.createBiquadFilter();
        this.engFilter.type = 'lowpass';
        this.engFilter.frequency.value = 900;
        this.osc1 = ctx.createOscillator(); // saw body
        this.osc1.type = 'sawtooth';
        this.osc1.frequency.value = 90;
        this.osc2 = ctx.createOscillator(); // square growl
        this.osc2.type = 'square';
        this.osc2.frequency.value = 45;
        const og2 = ctx.createGain();
        og2.gain.value = 0.35;
        this.sub = ctx.createOscillator(); // sub thump
        this.sub.type = 'sine';
        this.sub.frequency.value = 45;
        const ogSub = ctx.createGain();
        ogSub.gain.value = 0.6;
        // exhaust breath
        this.exhSrc = noiseSrc();
        this.exhFilter = ctx.createBiquadFilter();
        this.exhFilter.type = 'lowpass';
        this.exhFilter.frequency.value = 420;
        this.exhGain = ctx.createGain();
        this.exhGain.gain.value = 0;
        this.osc1.connect(this.engFilter);
        this.osc2.connect(og2); og2.connect(this.engFilter);
        this.sub.connect(ogSub); ogSub.connect(this.engFilter);
        this.exhSrc.connect(this.exhFilter);
        this.exhFilter.connect(this.exhGain);
        this.exhGain.connect(this.master);
        this.engFilter.connect(this.engGain);
        this.engGain.connect(this.master);
        this.osc1.start(); this.osc2.start(); this.sub.start();

        // --- Skid (bandpassed noise) ---
        this.skidSrc = noiseSrc();
        this.skidFilter = ctx.createBiquadFilter();
        this.skidFilter.type = 'bandpass';
        this.skidFilter.frequency.value = 900;
        this.skidFilter.Q.value = 1.2;
        this.skidGain = ctx.createGain();
        this.skidGain.gain.value = 0;
        this.skidSrc.connect(this.skidFilter);
        this.skidFilter.connect(this.skidGain);
        this.skidGain.connect(this.master);

        // --- Rolling rattle: low thump + gravel texture ---
        this.rollSrc = noiseSrc();
        this.rollLow = ctx.createBiquadFilter();
        this.rollLow.type = 'lowpass';
        this.rollLow.frequency.value = 240;
        this.rollGain = ctx.createGain();
        this.rollGain.gain.value = 0;
        this.rollSrc.connect(this.rollLow);
        this.rollLow.connect(this.rollGain);
        this.rollGain.connect(this.master);

        this.rattleSrc = noiseSrc();
        this.rattleFilter = ctx.createBiquadFilter();
        this.rattleFilter.type = 'bandpass';
        this.rattleFilter.frequency.value = 2300;
        this.rattleFilter.Q.value = 0.8;
        this.rattleGain = ctx.createGain();
        this.rattleGain.gain.value = 0;
        this.rattleSrc.connect(this.rattleFilter);
        this.rattleFilter.connect(this.rattleGain);
        this.rattleGain.connect(this.master);

        // --- Wind ---
        this.windSrc = noiseSrc();
        this.windFilter = ctx.createBiquadFilter();
        this.windFilter.type = 'lowpass';
        this.windFilter.frequency.value = 700;
        this.windGain = ctx.createGain();
        this.windGain.gain.value = 0;
        this.windSrc.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.master);

        this.initialized = true;
        this.setVolume(this.volume??.7);
        this.resume();
    }

    setVolume(value) {
        this.volume=Math.max(0,Math.min(1,value));
        if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.volume*.5,this.ctx.currentTime,.05);
    }
    setMuted(muted) {this.muted=muted;this.setVolume(this.volume??.7);}
    resume() {if(this.ctx?.state==='suspended')this.ctx.resume().catch(()=>{});}
    update(rpm, throttle, slip = 0, speedKmh = 0, surface = 'tarmac', offroad = false) {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;
        const f = 55 + rpm * 0.042;
        this.osc1.frequency.setTargetAtTime(f, t, 0.05);
        this.osc2.frequency.setTargetAtTime(f * 0.5 + 3, t, 0.05);
        this.sub.frequency.setTargetAtTime(f * 0.5, t, 0.05);
        this.engFilter.frequency.setTargetAtTime(500 + rpm * 0.35 + throttle * 700, t, 0.1);
        this.engGain.gain.setTargetAtTime(0.09 + throttle * 0.11 + Math.min(rpm / 6000, 1) * 0.05, t, 0.1);
        this.exhGain.gain.setTargetAtTime(0.02 + throttle * 0.09, t, 0.1);

        const skid = Math.min(Math.max((slip - 2.5) / 6, 0), 1) * Math.min(speedKmh / 60, 1);
        this.skidGain.gain.setTargetAtTime(skid * 0.22, t, 0.08);

        const rollBase = Math.min(speedKmh / 120, 1);
        const surfMult = surface === 'gravel' ? 1 : (surface === 'mud' ? 0.8 : 0.2);
        const offMult = offroad ? 1.6 : 1;
        this.rollGain.gain.setTargetAtTime(rollBase * 0.16 * surfMult * offMult, t, 0.15);
        this.rattleGain.gain.setTargetAtTime(
            rollBase * (surface === 'gravel' || offroad ? 0.16 : 0.02), t, 0.15);
        this.windGain.gain.setTargetAtTime(Math.pow(Math.min(speedKmh / 240, 1), 2) * 0.28, t, 0.2);

        // Anti-lag: lift off at high revs → exhaust crackle
        if (this.prevThr > 0.5 && throttle < 0.2 && rpm > 3800) {
            const n = 3 + ((Math.random() * 3) | 0);
            for (let i = 0; i < n; i++) this._pop(t + 0.03 + i * (0.05 + Math.random() * 0.05));
        }
        this.prevThr = throttle;
    }

    _pop(when) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(320 + Math.random() * 120, when);
        o.frequency.exponentialRampToValueAtTime(70, when + 0.07);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.22, when);
        g.gain.exponentialRampToValueAtTime(0.01, when + 0.08);
        o.connect(g); g.connect(this.master);
        o.start(when); o.stop(when + 0.1);
    }

    shift() {
        if (!this.initialized) return;
        const ctx = this.ctx, t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(160, t);
        o.frequency.exponentialRampToValueAtTime(90, t + 0.06);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.07);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + 0.09);
    }

    impact(strength = 1) {
        if (!this.initialized) return;
        const ctx = this.ctx, t = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.4 * strength, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 420;
        src.connect(f); f.connect(g); g.connect(this.master);
        src.start(t, Math.random());
        src.stop(t + 0.3);
        // low thump
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(75, t);
        o.frequency.exponentialRampToValueAtTime(30, t + 0.2);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.5 * strength, t);
        og.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
        o.connect(og); og.connect(this.master);
        o.start(t); o.stop(t + 0.25);
    }

    beep(freq = 440, dur = 0.15) {
        if (!this.initialized) return;
        const ctx = this.ctx, t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + dur);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + dur + 0.02);
    }

    checkpoint() {
        if (!this.initialized) return;
        this.beep(660, 0.12);
        setTimeout(() => this.beep(990, 0.18), 110);
    }

    fanfare() {
        if (!this.initialized) return;
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.22), i * 130));
    }

    playSfx(type) {
        if (type === 'impact') this.impact(1);
    }
}
