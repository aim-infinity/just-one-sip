import Phaser from 'phaser';

interface Puff {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    grow: number;
    life: number;
    max: number;
    shade: number;
    alpha: number;
}

/**
 * Diesel exhaust: soft grey puffs that rise, swell and fade, streaming back
 * from the tailpipe as the auto moves. One Graphics object, capped pool.
 */
export class SmokeFx {
    private readonly g: Phaser.GameObjects.Graphics;
    private puffs: Puff[] = [];
    private readonly max: number;
    private t = 0;

    constructor(scene: Phaser.Scene, private readonly reduced: boolean) {
        this.g = scene.add.graphics().setDepth(9.5);
        this.max = reduced ? 14 : 40;
    }

    /** Emit one puff at the tailpipe (screen x/y). `dark` = a rev or hard pull-away. */
    puff(x: number, y: number, speed: number, dark = false): void {
        if (this.puffs.length >= this.max) this.puffs.shift();
        const life = dark ? 1.1 : 0.85 + Math.random() * 0.3;
        this.puffs.push({
            x,
            y,
            // the auto drives right, so smoke trails left relative to it
            vx: -30 - speed * 0.35 + (Math.random() - 0.5) * 20,
            vy: -18 - Math.random() * 14,
            r: dark ? 6.5 : 3.2,
            grow: dark ? 20 : 11,
            life,
            max: life,
            shade: dark ? 0x4a4a4a : 0x8a8a8a,
            alpha: dark ? 0.62 : 0.28,
        });
    }

    /**
     * Steady exhaust from the running engine: thicker at idle, thinner while cruising.
     * `on` false (engine off / ride over) emits nothing.
     */
    update(dt: number, tail: { x: number; y: number }, speed: number, on: boolean): void {
        if (on) {
            this.t -= dt;
            if (this.t <= 0) {
                const idle = speed < 40;
                this.t = (idle ? 0.14 : 0.22) * (this.reduced ? 2 : 1);
                this.puff(tail.x, tail.y, speed);
            }
        }
        const g = this.g;
        g.clear();
        for (let i = this.puffs.length - 1; i >= 0; i--) {
            const p = this.puffs[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.puffs.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 1 - dt * 1.5;
            p.r += p.grow * dt;
            const k = p.life / p.max;
            g.fillStyle(p.shade, p.alpha * k);
            g.fillCircle(p.x, p.y, p.r);
        }
    }

    /** Several dark puffs at once (ride start, green light). */
    burst(x: number, y: number, speed: number): void {
        const n = this.reduced ? 3 : 7;
        for (let i = 0; i < n; i++) this.puff(x - i * 3, y - i, speed, true);
    }
}
