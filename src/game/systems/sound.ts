import { settings } from './settings';

/**
 * All sound is synthesised with the Web Audio API — no audio files.
 * The AudioContext is only created/resumed from a user gesture (`unlock()`),
 * which satisfies iOS/Android autoplay rules.
 */
class SoundEngine {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private noise: AudioBuffer | null = null;
    private engine: { stop: () => void; setLoad: (v: number) => void } | null = null;

    get ready(): boolean {
        return !!this.ctx && this.ctx.state === 'running';
    }

    /** Call from inside a pointer/touch/key handler. */
    unlock(): void {
        try {
            if (!this.ctx) {
                const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                if (!AC) return;
                this.ctx = new AC();
                this.master = this.ctx.createGain();
                this.master.gain.value = settings.muted ? 0 : 0.8;
                this.master.connect(this.ctx.destination);
                const len = this.ctx.sampleRate * 1.5;
                this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
                const d = this.noise.getChannelData(0);
                for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            }
            if (this.ctx.state === 'suspended') void this.ctx.resume();
        } catch {
            this.ctx = null;
        }
    }

    suspend(): void {
        if (this.ctx?.state === 'running') void this.ctx.suspend();
    }

    resume(): void {
        if (this.ctx?.state === 'suspended') void this.ctx.resume();
    }

    applyMute(): void {
        if (this.master && this.ctx) this.master.gain.setTargetAtTime(settings.muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
    }

    private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }

    private osc(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0) {
        const c = this.ctx;
        if (!c || !this.master || settings.muted) return;
        const t = c.currentTime + delay;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
        this.env(g, t, peak, 0.008, dur);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    private noiseBurst(freq: number, q: number, dur: number, peak: number, type: BiquadFilterType = 'bandpass', delay = 0) {
        const c = this.ctx;
        if (!c || !this.master || !this.noise || settings.muted) return;
        const t = c.currentTime + delay;
        const s = c.createBufferSource();
        s.buffer = this.noise;
        const f = c.createBiquadFilter();
        f.type = type;
        f.frequency.setValueAtTime(freq, t);
        f.Q.value = q;
        const g = c.createGain();
        this.env(g, t, peak, 0.005, dur);
        s.connect(f).connect(g).connect(this.master);
        s.start(t, Math.random() * 0.5);
        s.stop(t + dur + 0.05);
    }

    /** Putt-putt two-stroke engine + road rumble loop. */
    startEngine(): void {
        const c = this.ctx;
        if (!c || !this.master || !this.noise || this.engine) return;
        const out = c.createGain();
        out.gain.value = 0.0001;
        out.gain.setTargetAtTime(1, c.currentTime, 0.3);
        out.connect(this.master);

        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 380;
        const am = c.createGain();
        am.gain.value = 0.06;
        const o1 = c.createOscillator();
        o1.type = 'sawtooth';
        o1.frequency.value = 52;
        const o2 = c.createOscillator();
        o2.type = 'square';
        o2.frequency.value = 104;
        const o2g = c.createGain();
        o2g.gain.value = 0.4;
        const lfo = c.createOscillator();
        lfo.frequency.value = 11;
        const lfoGain = c.createGain();
        lfoGain.gain.value = 0.045;
        lfo.connect(lfoGain).connect(am.gain);
        o1.connect(lp);
        o2.connect(o2g).connect(lp);
        lp.connect(am).connect(out);

        const rumble = c.createBufferSource();
        rumble.buffer = this.noise;
        rumble.loop = true;
        const rlp = c.createBiquadFilter();
        rlp.type = 'lowpass';
        rlp.frequency.value = 160;
        const rg = c.createGain();
        rg.gain.value = 0.12;
        rumble.connect(rlp).connect(rg).connect(out);

        const nodes = [o1, o2, lfo, rumble];
        nodes.forEach((n) => n.start());
        this.engine = {
            stop: () => {
                out.gain.setTargetAtTime(0.0001, c.currentTime, 0.15);
                nodes.forEach((n) => n.stop(c.currentTime + 0.6));
            },
            setLoad: (v: number) => {
                o1.frequency.setTargetAtTime(52 + v * 14, c.currentTime, 0.05);
                rg.gain.setTargetAtTime(0.12 + v * 0.3, c.currentTime, 0.03);
            },
        };
    }

    stopEngine(): void {
        this.engine?.stop();
        this.engine = null;
    }

    engineLoad(v: number): void {
        this.engine?.setLoad(Math.min(1, v));
    }

    bump(severity: number): void {
        const s = Math.min(1.6, severity);
        this.osc('sine', 110, 38, 0.18 + s * 0.08, 0.25 + s * 0.35);
        this.noiseBurst(220, 0.8, 0.12, 0.12 + s * 0.2, 'lowpass');
        if (s > 0.9) this.noiseBurst(900, 3, 0.08, 0.08, 'bandpass', 0.02); // rattle
    }

    splash(ml: number): void {
        const s = Math.min(1, ml / 15);
        this.noiseBurst(1800 + Math.random() * 800, 1.2, 0.18 + s * 0.2, 0.12 + s * 0.3);
        this.noiseBurst(4200, 2, 0.1, 0.05 + s * 0.1, 'highpass', 0.03);
    }

    gulp(): void {
        const f = 260 + Math.random() * 60;
        this.osc('sine', f, f * 0.55, 0.11, 0.35);
        this.noiseBurst(500, 4, 0.06, 0.06);
    }

    sipSuccess(): void {
        this.osc('triangle', 880, 880, 0.12, 0.18);
        this.osc('triangle', 1320, 1320, 0.18, 0.15, 0.08);
    }

    horn(): void {
        // classic squeeze-bulb "pom pom"
        this.osc('square', 420, 380, 0.14, 0.12);
        this.osc('square', 420, 380, 0.16, 0.12, 0.2);
    }

    victory(): void {
        [523, 659, 784, 1047].forEach((f, i) => this.osc('triangle', f, f, 0.22, 0.25, i * 0.11));
        this.osc('triangle', 1319, 1319, 0.5, 0.2, 0.46);
    }

    failure(): void {
        [392, 370, 349, 311].forEach((f, i) => this.osc('sawtooth', f, f * 0.97, i === 3 ? 0.7 : 0.25, 0.12, i * 0.28));
    }

    click(): void {
        this.osc('triangle', 660, 520, 0.06, 0.15);
    }
}

export const sound = new SoundEngine();
