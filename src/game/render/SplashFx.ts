import Phaser from 'phaser';
import { PALETTE as P } from './palette';

interface Drop {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    max: number;
    r: number;
    color: number;
}

/**
 * Lightweight pooled droplet particles drawn with one Graphics object.
 * Capped so even a disastrous pothole stays cheap on low-end phones.
 */
export class SplashFx {
    private g: Phaser.GameObjects.Graphics;
    private drops: Drop[] = [];
    private readonly max: number;
    floorY = 600;

    constructor(scene: Phaser.Scene, reduced: boolean) {
        this.g = scene.add.graphics().setDepth(12);
        this.max = reduced ? 40 : 110;
    }

    burst(x: number, y: number, count: number, opts: { up?: number; spread?: number; color?: number; dir?: number } = {}): void {
        const up = opts.up ?? 260;
        const spread = opts.spread ?? 200;
        const dir = opts.dir ?? 0;
        for (let i = 0; i < count; i++) {
            if (this.drops.length >= this.max) this.drops.shift();
            const life = 0.5 + Math.random() * 0.5;
            this.drops.push({
                x: x + (Math.random() - 0.5) * 8,
                y: y + (Math.random() - 0.5) * 8,
                vx: dir * 80 + (Math.random() - 0.5) * spread,
                vy: -up * (0.4 + Math.random() * 0.8),
                life,
                max: life,
                r: 1.8 + Math.random() * 3,
                color: opts.color ?? (Math.random() < 0.7 ? P.water : 0xd8f1ff),
            });
        }
    }

    update(dt: number, scrollPx: number): void {
        const g = this.g;
        g.clear();
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            d.life -= dt;
            d.vy += 1300 * dt;
            d.x += d.vx * dt - scrollPx * 0.4;
            d.y += d.vy * dt;
            if (d.y > this.floorY) {
                d.y = this.floorY;
                d.vy *= -0.2;
                d.vx *= 0.5;
                d.x -= scrollPx * 0.6;
            }
            if (d.life <= 0) {
                this.drops.splice(i, 1);
                continue;
            }
            g.fillStyle(d.color, Math.min(1, (d.life / d.max) * 1.6));
            g.fillCircle(d.x, d.y, d.r);
        }
    }
}
