// Gamepad.js — standard-layout controller: left stick steer, RT/LT pedals,
// A handbrake, X camera, B lights, Y/Back reset, Start pause. Hot-plug safe.
export class GamepadManager {
    constructor(onChange) {
        this.onChange = onChange || null;
        this.padIndex = null;
        this.prev = {};
        this._gp = null;
        this.lastRumble = 0;
        window.addEventListener('gamepadconnected', e => {
            this.padIndex = e.gamepad.index;
            if (this.onChange) this.onChange('CONTROLLER · ' + e.gamepad.id.slice(0, 30));
        });
        window.addEventListener('gamepaddisconnected', e => {
            if (this.padIndex === e.gamepad.index) this.padIndex = null;
            this._gp = null;
            if (this.onChange) this.onChange(null);
        });
    }

    _btn(gp, i) {
        const b = gp.buttons[i];
        return b ? (b.value || (b.pressed ? 1 : 0)) : 0;
    }

    _edge(name, down) {
        const was = !!this.prev[name];
        this.prev[name] = down;
        return down && !was;
    }

    poll() {
        const out = {
            connected: false, throttle: 0, brake: 0, steer: 0, handbrake: 0,
            wantPause: false, wantReset: false, wantCamera: false, wantLights: false,
            reverse: false
        };
        let gp = null;
        try {
            const gps = navigator.getGamepads ? navigator.getGamepads() : [];
            if (this.padIndex !== null) gp = gps[this.padIndex] || null;
            if (!gp) {
                for (const g of gps) {
                    if (g && g.connected) { gp = g; this.padIndex = g.index; break; }
                }
            }
        } catch (e) { return out; }
        if (!gp) {this.prev={};this._gp=null;return out;}
        out.connected = true;

        const dz = v => Math.abs(v) < 0.12 ? 0 : v;
        // Negated: chase cam looks down +z, so raw stick-left reads as screen-right
        out.steer = dz(gp.axes[0] || 0);
        const dpad = (this._btn(gp, 15) ? 1 : 0) - (this._btn(gp, 14) ? 1 : 0);
        if (dpad !== 0) out.steer = dpad; // D-pad overrides stick

        out.throttle = this._btn(gp, 7);   // RT (analog)
        out.brake = this._btn(gp, 6);      // LT (analog)
        out.handbrake = this._btn(gp, 0);  // A
        out.reverse = this._btn(gp, 4) > 0.3; // LB: deliberate reverse

        out.wantPause = this._edge('pause', this._btn(gp, 9) > 0.3);
        out.wantReset = this._edge('reset', this._btn(gp, 3) > 0.3 || this._btn(gp, 8) > 0.3);
        out.wantCamera = this._edge('cam', this._btn(gp, 2) > 0.3);
        out.wantLights = this._edge('lights', this._btn(gp, 1) > 0.3);

        this._gp = gp;
        return out;
    }

    rumble(mag, dur = 0.2) {
        const gp = this._gp;
        if (!gp || !gp.vibrationActuator) return;
        const now = performance.now();
        if (now - this.lastRumble < 90) return;
        this.lastRumble = now;
        try {
            gp.vibrationActuator.playEffect('dual-rumble', {
                duration: Math.min(Math.max(dur, 0.05), 1) * 1000,
                strongMagnitude: Math.min(Math.max(mag, 0), 1),
                weakMagnitude: Math.min(Math.max(mag, 0), 1) * 0.6
            });
        } catch (e) { /* actuator unsupported */ }
    }
}
