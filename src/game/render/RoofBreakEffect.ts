import Phaser from 'phaser';
import type { AutoView } from './AutoView';
import { AUTO_TEX, ROOF } from './autoArt';
import { PALETTE as P } from './palette';
import { TEX_SCALE } from './textures';

type V = { x: number; y: number };

interface Frag {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rot: number;
    vrot: number;
    w: number;
    h: number;
    color: number;
    life: number;
}

/** Canopy top edge (art space): slopes from y −192 at x −134 down to −183 at x 112. */
const roofTopAt = (x: number) => ROOF.top + (Math.max(-134, x) + 134) * (9 / 246);

const easeOutBack = (t: number) => {
    const c = 1.9;
    const u = t - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
};

/**
 * The auto's canopy giving way under the passenger's head, in auto-local
 * (art) space inside the AutoView container:
 *  1. `setStretch()` — the canvas bulges upward over the head and cracks
 *  2. `break()` — the roof image is cropped open (a real gap, not a cover-up),
 *     two torn flaps spring upward and fragments scatter
 * `destroy()` restores the roof (scene restarts rebuild it anyway).
 */
export class RoofBreakEffect {
    private readonly g: Phaser.GameObjects.Graphics;
    private rearRoof?: Phaser.GameObjects.Image;
    private frags: Frag[] = [];
    private bulge = 0;
    private crack = 0;
    private brokenT = -1;

    constructor(
        private scene: Phaser.Scene,
        private auto: AutoView,
        /** The hole, centred over the passenger's head (art space x). */
        readonly gapX0 = -118,
        readonly gapX1 = -54,
    ) {
        this.g = scene.add.graphics();
        const c = auto.container;
        c.addAt(this.g, c.getIndex(auto.roof) + 1);
    }

    get broken(): boolean {
        return this.brokenT >= 0;
    }

    /** Where the head pops out (art space, top of the canopy). */
    get holeTop(): V {
        const x = (this.gapX0 + this.gapX1) / 2;
        return { x, y: roofTopAt(x) };
    }

    /** Bulge height (px) and crack progress (0..1) while the head pushes up. */
    setStretch(bulgePx: number, crack: number): void {
        this.bulge = bulgePx;
        this.crack = crack;
    }

    break(reduced: boolean): void {
        if (this.broken) return;
        this.brokenT = 0;
        this.bulge = 0;
        const k = 1 / TEX_SCALE; // texture px per art px
        const { w, h, ox, oy } = AUTO_TEX;
        const roof = this.auto.roof;
        // keep the front of the canopy on the original image...
        roof.setCrop((ox + this.gapX1) * k, 0, (w - ox - this.gapX1) * k, h * k);
        // ...and the rear part (with the pillar) on a cropped twin
        this.rearRoof = this.scene.add
            .image(0, 0, 'autoRoof')
            .setOrigin(ox / w, oy / h)
            .setScale(TEX_SCALE)
            .setCrop(0, 0, (ox + this.gapX0) * k, h * k);
        const c = this.auto.container;
        c.addAt(this.rearRoof, c.getIndex(roof));

        const n = reduced ? 7 : 14;
        for (let i = 0; i < n; i++) {
            const x = this.gapX0 + Math.random() * (this.gapX1 - this.gapX0);
            const side = x < (this.gapX0 + this.gapX1) / 2 ? -1 : 1;
            this.frags.push({
                x,
                y: roofTopAt(x) + Math.random() * (ROOF.bottom - ROOF.top),
                vx: side * (90 + Math.random() * 260),
                vy: -(380 + Math.random() * 520),
                rot: Math.random() * Math.PI,
                vrot: (Math.random() - 0.5) * 22,
                w: 5 + Math.random() * 9,
                h: 4 + Math.random() * 6,
                color: Math.random() < 0.75 ? ROOF.fill : ROOF.highlight,
                life: 1.6,
            });
        }
    }

    update(dt: number): void {
        const g = this.g;
        g.clear();
        if (!this.broken) {
            if (this.bulge > 0.5) this.drawBulge(g);
        } else {
            this.brokenT += dt;
            this.drawTornEdges(g);
        }
        for (let i = this.frags.length - 1; i >= 0; i--) {
            const f = this.frags[i];
            f.life -= dt;
            if (f.life <= 0) {
                this.frags.splice(i, 1);
                continue;
            }
            f.vy += 1500 * dt;
            f.x += f.vx * dt;
            f.y += f.vy * dt;
            f.rot += f.vrot * dt;
            const c = Math.cos(f.rot);
            const s = Math.sin(f.rot);
            const pts = [
                [-f.w, -f.h],
                [f.w, -f.h * 0.6],
                [f.w * 0.7, f.h],
                [-f.w * 0.8, f.h * 0.8],
            ].map(([x, y]) => ({ x: f.x + x * c - y * s, y: f.y + x * s + y * c }));
            g.fillStyle(f.color, Math.min(1, f.life * 2));
            g.fillPoints(pts, true);
            g.lineStyle(2, P.ink, Math.min(1, f.life * 2));
            g.strokePoints(pts, true);
        }
    }

    /** The canopy stretched into a dome by the head underneath, with spreading cracks. */
    private drawBulge(g: Phaser.GameObjects.Graphics): void {
        const x0 = this.gapX0 - 14;
        const x1 = this.gapX1 + 14;
        const pts: V[] = [];
        const n = 18;
        for (let i = 0; i <= n; i++) {
            const u = i / n;
            const x = x0 + (x1 - x0) * u;
            pts.push({ x, y: roofTopAt(x) + 1 - this.bulge * Math.sin(Math.PI * u) ** 0.8 });
        }
        g.fillStyle(ROOF.fill, 1);
        g.fillPoints([...pts, { x: x1, y: roofTopAt(x1) + 6 }, { x: x0, y: roofTopAt(x0) + 6 }], true);
        g.lineStyle(3.5, P.ink, 1);
        g.strokePoints(pts, false);
        // a stretched-fabric highlight
        g.lineStyle(2.5, ROOF.highlight, 0.9);
        g.strokePoints(pts.slice(4, 12).map((p) => ({ x: p.x, y: p.y + 5 })), false);
        if (this.crack > 0) {
            const cx = (x0 + x1) / 2;
            const top = roofTopAt(cx) - this.bulge;
            g.lineStyle(2.5, 0xf2e6cf, 1);
            const len = this.crack;
            for (const dir of [-1, 1]) {
                const zig: V[] = [{ x: cx, y: top + 3 }];
                for (let i = 1; i <= 4; i++) zig.push({ x: cx + dir * i * 7 * len, y: top + 3 + i * 4 * len + (i % 2 ? -3 : 3) * len });
                g.strokePoints(zig, false);
            }
        }
    }

    /** Jagged cut faces plus two flaps that spring upward on the hinge. */
    private drawTornEdges(g: Phaser.GameObjects.Graphics): void {
        const T = ROOF.bottom - ROOF.top;
        const open = easeOutBack(Math.min(1, this.brokenT / 0.28));
        const flap = (hx: number, dirX: number, angle: number) => {
            const hy = roofTopAt(hx);
            const L = 22;
            // rotate so the free end swings up: rear flap (dirX +1) turns
            // counter-clockwise, front flap (dirX −1) clockwise (screen y down)
            const a = angle * open * -dirX;
            const rotV = (v: V) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
            const u = rotV({ x: dirX * L, y: 0 });
            const d = rotV({ x: 0, y: T * 0.75 });
            const mid = rotV({ x: dirX * L * 0.6, y: T * 0.4 });
            const p0 = { x: hx, y: hy };
            const pts = [p0, { x: hx + u.x, y: hy + u.y }, { x: hx + mid.x + d.x * 0.2, y: hy + mid.y + d.y * 0.2 }, { x: hx + u.x * 0.8 + d.x, y: hy + u.y * 0.8 + d.y }, { x: hx + d.x, y: hy + d.y }];
            g.fillStyle(ROOF.fill, 1);
            g.fillPoints(pts, true);
            g.lineStyle(3, P.ink, 1);
            g.strokePoints(pts, true);
            // frayed canvas threads on the free edge
            g.lineStyle(1.5, ROOF.highlight, 1);
            g.lineBetween(hx + u.x, hy + u.y, hx + u.x * 1.2 + 3, hy + u.y * 1.2 - 2);
        };
        flap(this.gapX0, 1, 1.9);
        flap(this.gapX1, -1, 1.9);
        // zig-zag teeth on both cut faces
        g.fillStyle(ROOF.fill, 1);
        g.lineStyle(2, P.ink, 1);
        for (const [x, dir] of [
            [this.gapX0, 1],
            [this.gapX1, -1],
        ] as const) {
            const top = roofTopAt(x);
            for (let i = 0; i < 3; i++) {
                const y0 = top + (i * T) / 3;
                const tri = [
                    { x, y: y0 },
                    { x: x + dir * 7, y: y0 + T / 6 },
                    { x, y: y0 + T / 3 },
                ];
                g.fillPoints(tri, true);
                g.strokePoints(tri, false);
            }
        }
    }

    destroy(): void {
        this.auto.roof.setCrop();
        this.rearRoof?.destroy();
        this.g.destroy();
        this.frags = [];
    }
}
