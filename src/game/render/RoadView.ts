import Phaser from 'phaser';
import type { Hazard, Road } from '../core/road';
import { hazardProfile } from '../core/road';
import { FONT, GROUND_Y, PALETTE as P } from './palette';

/** Screen y of the far and near edges of the asphalt. */
const FAR = 530;
const NEAR = 616;

function drawPothole(g: Phaser.GameObjects.Graphics, h: Hazard, water: boolean) {
    const w = h.width;
    const cx = w / 2;
    const cy = GROUND_Y + 8;
    // broken rim
    g.fillStyle(0x6a6c72, 1);
    g.fillEllipse(cx, cy, w + 28, 40 + h.depth * 0.8);
    g.fillStyle(0x3a3b40, 1);
    g.fillEllipse(cx, cy + 1, w + 14, 30 + h.depth * 0.8);
    if (water) {
        g.fillStyle(P.mud, 1);
        g.fillEllipse(cx, cy + 2, w + 4, 24 + h.depth * 0.6);
        g.fillStyle(0xb8935a, 1);
        g.fillEllipse(cx - w * 0.12, cy - 1, w * 0.55, 5);
        g.fillStyle(0xe8d6a8, 0.8);
        g.fillRect(cx - w * 0.28, cy - 2, w * 0.2, 2);
        g.fillRect(cx + w * 0.1, cy + 4, w * 0.16, 2);
        // reflected sky glint
        g.fillStyle(0xbfe4f7, 0.55);
        g.fillEllipse(cx + w * 0.15, cy - 2, w * 0.3, 4);
    } else {
        g.fillStyle(0x17181b, 1);
        g.fillEllipse(cx, cy + 3, w, 22 + h.depth * 0.6);
        g.fillStyle(0x2a2b2f, 1);
        g.fillEllipse(cx, cy - 2, w - 18, 6);
    }
    // cracks radiating out
    g.lineStyle(2, 0x2a2b2f, 1);
    g.lineBetween(-6, cy - 2, -18, cy - 8);
    g.lineBetween(w + 6, cy + 2, w + 20, cy + 9);
    g.lineBetween(cx - 10, cy - 14, cx - 16, FAR + 6);
    // chunks of gravel
    g.fillStyle(0x7d7f86, 1);
    for (let i = 0; i < 6; i++) g.fillRect(((i * 37) % (w + 20)) - 8, cy - 16 + ((i * 13) % 10), 4, 3);
}

function drawSpeedBreaker(g: Phaser.GameObjects.Graphics, h: Hazard) {
    const w = h.width;
    // painted strip across the whole road
    const bw = w * 0.7;
    const x0 = (w - bw) / 2;
    g.fillStyle(0x8c8a84, 1);
    g.fillRect(x0, FAR + 2, bw, NEAR - FAR - 4);
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
        g.fillStyle(i % 2 ? 0x2b2b2b : P.yellow, 1);
        const sy = FAR + 2 + (i * (NEAR - FAR - 4)) / stripes;
        g.fillRect(x0 + 6, sy, bw - 12, (NEAR - FAR - 4) / stripes - 2);
    }
    // hump silhouette on the wheel line
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i <= 24; i++) {
        const x = (i / 24) * w;
        pts.push({ x, y: GROUND_Y - hazardProfile(h, h.x + x) });
    }
    pts.push({ x: w, y: GROUND_Y + 6 }, { x: 0, y: GROUND_Y + 6 });
    g.fillStyle(P.yellow, 1);
    g.fillPoints(pts, true);
    g.lineStyle(3, P.ink, 1);
    g.strokePoints(pts.slice(0, 25), false);
    g.fillStyle(0x2b2b2b, 1);
    for (let i = 1; i < 6; i += 2) {
        const x = (i / 6) * w;
        const y = GROUND_Y - hazardProfile(h, h.x + x);
        g.fillRect(x - w / 14, y + 2, w / 7, GROUND_Y + 4 - y);
    }
}

function drawUneven(g: Phaser.GameObjects.Graphics, h: Hazard) {
    const w = h.width;
    // patchy, broken asphalt
    const tones = [0x5b5d63, 0x3d3f44, 0x67696f, 0x45474c];
    for (let i = 0; i < 9; i++) {
        const px = (i / 9) * w;
        g.fillStyle(tones[i % tones.length], 1);
        g.fillTriangle(px, FAR + 10 + (i % 3) * 12, px + w / 6, FAR + 26 + (i % 2) * 20, px + w / 9, NEAR - 14 - (i % 3) * 10);
    }
    // bumps on the wheel line
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i <= 40; i++) {
        const x = (i / 40) * w;
        pts.push({ x, y: GROUND_Y - Math.max(0, hazardProfile(h, h.x + x)) - 1 });
    }
    pts.push({ x: w, y: GROUND_Y + 4 }, { x: 0, y: GROUND_Y + 4 });
    g.fillStyle(0x5f6167, 1);
    g.fillPoints(pts, true);
    g.lineStyle(2, 0x2a2b2f, 1);
    g.strokePoints(pts.slice(0, 41), false);
    // gravel
    g.fillStyle(0x9a9ca2, 1);
    for (let i = 0; i < 18; i++) g.fillRect((i * 53) % w, GROUND_Y - 4 + ((i * 7) % 14), 3, 3);
    g.lineStyle(2, 0x26272b, 1);
    for (let i = 0; i < 4; i++) {
        const x = ((i + 0.5) / 4) * w;
        g.lineBetween(x, FAR + 8, x + 14, FAR + 30);
        g.lineBetween(x + 14, FAR + 30, x + 4, FAR + 48);
    }
}

export function drawHazard(g: Phaser.GameObjects.Graphics, h: Hazard): void {
    g.clear();
    switch (h.type) {
        case 'pothole':
            return drawPothole(g, h, false);
        case 'waterlogged':
            return drawPothole(g, h, true);
        case 'speedBreaker':
            return drawSpeedBreaker(g, h);
        case 'uneven':
            return drawUneven(g, h);
    }
}

/** Road surface, hazards and the destination marker. */
export class RoadView {
    private surface: Phaser.GameObjects.TileSprite;
    private views = new Map<number, Phaser.GameObjects.Graphics>();
    private finish?: Phaser.GameObjects.Container;
    private finishX = Infinity;

    constructor(
        private scene: Phaser.Scene,
        private road: Road,
        private width: number,
    ) {
        this.surface = scene.add.tileSprite(0, 500, width, 220, 'road').setOrigin(0).setDepth(5);
    }

    setFinish(worldX: number): void {
        this.finishX = worldX;
        const s = this.scene;
        const c = s.add.container(0, 0).setDepth(4);
        const post = s.add.rectangle(0, 506, 8, 130, 0x56606b).setOrigin(0.5, 1);
        const board = s.add.rectangle(0, 376, 170, 64, 0x1f9d55).setStrokeStyle(4, P.ink);
        const label = s.add
            .text(0, 376, 'YOUR STOP\n📍 Destination', { fontFamily: FONT, fontSize: '19px', color: '#fff', align: 'center', fontStyle: '800' })
            .setOrigin(0.5)
            .setLineSpacing(-6);
        const flagLine = s.add.rectangle(-4, 560, 8, 90, 0xffffff).setOrigin(0.5, 1).setAlpha(0.9);
        const chk = s.add.graphics();
        for (let i = 0; i < 6; i++) {
            chk.fillStyle(i % 2 ? 0x111111 : 0xffffff, 1);
            chk.fillRect(-8, 530 + i * 14, 16, 14);
        }
        c.add([flagLine, chk, post, board, label]);
        this.finish = c;
    }

    update(camX: number): void {
        this.surface.tilePositionX = camX;
        const left = camX - 80;
        const right = camX + this.width + 80;
        for (const h of this.road.hazards) {
            const visible = h.x + h.width > left && h.x < right;
            let g = this.views.get(h.id);
            if (visible && !g) {
                g = this.scene.add.graphics().setDepth(6);
                drawHazard(g, h);
                this.views.set(h.id, g);
            } else if (!visible && g) {
                g.destroy();
                this.views.delete(h.id);
            }
            if (g) g.x = Math.round(h.x - camX);
            if (h.x > right) break;
        }
        if (this.finish) this.finish.x = this.finishX - camX;
    }
}
