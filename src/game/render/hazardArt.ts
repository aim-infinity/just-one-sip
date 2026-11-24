import Phaser from 'phaser';
import type { RideSimulation } from '../core/simulation';
import { hazardProfile, type Hazard } from '../core/road';
import { FONT, GROUND_Y, PALETTE as P } from './palette';
import { TEX_SCALE } from './textures';
import type { WeatherProfile } from '../config/weather';

/**
 * Visuals for every hazard type, in a clear side-view "cross-section" style:
 * you can read the shape of the danger (bowl, hump, patch, water) at a glance.
 * Each view is a container positioned at the hazard's leading edge (local x = 0).
 */
export interface Light {
    x: number;
    y: number;
    r: number;
}

export interface HazardView {
    root: Phaser.GameObjects.Container;
    update?: (sim: RideSimulation, time: number) => void;
    /** Light sources (hazard-local) that punch through the night darkness. */
    lights?: () => Light[];
}

const FAR = 530;
const NEAR = 616;
const G = GROUND_Y;

/** Points along the wheel line following the hazard's actual road profile. */
function profilePts(h: Hazard, k: number, n = 28): Phaser.Types.Math.Vector2Like[] {
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i <= n; i++) {
        const x = (i / n) * h.width;
        pts.push({ x, y: G - hazardProfile(h, h.x + x) * k });
    }
    return pts;
}

function bowl(g: Phaser.GameObjects.Graphics, h: Hazard, fill: number, deep: number) {
    const w = h.width;
    // faint footprint on the road surface so it sits in the lane
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(w / 2, G + 14, w + 10, 22);
    // the bowl itself: a cross-section cut into the road
    const pts = profilePts(h, deep);
    g.fillStyle(fill, 1);
    g.fillPoints([{ x: -4, y: G }, ...pts, { x: w + 4, y: G }], true);
    g.lineStyle(3, P.ink, 1);
    g.strokePoints(pts, false);
    // broken lip chunks
    g.fillStyle(0x6e7178, 1);
    g.fillTriangle(-10, G, -2, G, -6, G - 4);
    g.fillTriangle(w + 2, G, w + 12, G, w + 6, G - 5);
}

function drawPothole(g: Phaser.GameObjects.Graphics, h: Hazard) {
    const w = h.width;
    // a clearly dark hole in the lane (top-down) so it reads from far away
    g.fillStyle(0x55575d, 1);
    g.fillEllipse(w / 2, G + 12, w + 26, 34);
    g.fillStyle(0x1a1b1e, 1);
    g.fillEllipse(w / 2, G + 13, w + 8, 24);
    bowl(g, h, 0x1f2023, 2.3);
    // pale inner rim line (like wet asphalt catching light)
    const inner: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 4; i <= 24; i++) {
        const x = (i / 28) * w;
        inner.push({ x, y: G - hazardProfile(h, h.x + x) * 2.3 - 6 });
    }
    g.lineStyle(3, 0x8fa9bd, 0.9);
    g.strokePoints(inner, false);
    // cracks running away from the hole
    g.lineStyle(2, 0x2a2b2f, 1);
    g.lineBetween(-6, G + 4, -22, G + 14);
    g.lineBetween(w + 6, G + 2, w + 24, G + 12);
    g.lineBetween(w * 0.4, G + 12, w * 0.3, FAR + 6);
}

function drawWaterlogged(g: Phaser.GameObjects.Graphics, h: Hazard, root: Phaser.GameObjects.Container): (t: number) => void {
    const w = h.width;
    // A water patch hides its depth: draw every one the same, whatever the real depth.
    const fake = { ...h, depth: 16 };
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(w / 2, G + 14, w + 16, 26);
    const pts = profilePts(fake, 1.5);
    g.fillStyle(0x4d7fa8, 1);
    g.fillPoints([{ x: -6, y: G }, ...pts, { x: w + 6, y: G }], true);
    g.fillStyle(0x3a6a92, 1);
    g.fillEllipse(w / 2, G + 14, w * 0.6, 10);
    g.lineStyle(3, P.ink, 1);
    g.strokePoints(pts, false);
    // muddy splash marks on the road around it
    g.fillStyle(0x7a6a50, 0.5);
    for (let i = 0; i < 5; i++) g.fillCircle(-12 + ((i * 47) % (w + 24)), FAR + 8 + ((i * 13) % 30), 4 + (i % 3));
    // animated surface
    const surf = g.scene.add.graphics();
    root.add(surf);
    return (t: number) => {
        surf.clear();
        const pts2: Phaser.Types.Math.Vector2Like[] = [];
        for (let i = 0; i <= 20; i++) {
            const x = -6 + (i / 20) * (w + 12);
            pts2.push({ x, y: G - 1 + Math.sin(t * 4 + i * 0.9) * 1.4 });
        }
        surf.lineStyle(5, 0xbfe6f5, 1);
        surf.strokePoints(pts2, false);
        surf.lineStyle(2, 0xffffff, 0.8);
        surf.lineBetween(w * 0.2 + Math.sin(t) * 4, G + 6, w * 0.45 + Math.sin(t) * 4, G + 6);
    };
}

function drawSpeedBreaker(g: Phaser.GameObjects.Graphics, h: Hazard) {
    const w = h.width;
    // painted band across the whole road (top-down hint)
    const bw = w * 0.62;
    const x0 = (w - bw) / 2;
    for (let i = 0; i < 6; i++) {
        g.fillStyle(i % 2 ? 0x2b2b2b : P.yellow, 0.85);
        const sy = FAR + 2 + (i * (NEAR - FAR - 4)) / 6;
        g.fillRect(x0, sy, bw, (NEAR - FAR - 4) / 6);
    }
    // the hump in cross-section with diagonal yellow stripes
    const pts = profilePts(h, 1.25);
    g.fillStyle(0x4a4c52, 1);
    g.fillPoints([...pts, { x: w, y: G + 4 }, { x: 0, y: G + 4 }], true);
    for (let i = 1; i < 6; i++) {
        const x = (i / 6) * w;
        const top = G - hazardProfile(h, h.x + x) * 1.25;
        if (G - top < 4) continue;
        g.fillStyle(P.yellow, 1);
        g.fillPoints(
            [
                { x: x - 4, y: G + 2 },
                { x: x + 2, y: G + 2 },
                { x: x + 6, y: top + 3 },
                { x: x, y: top + 3 },
            ],
            true,
        );
    }
    g.lineStyle(3, P.ink, 1);
    g.strokePoints(pts, false);
}

function drawRepairPatch(g: Phaser.GameObjects.Graphics, h: Hazard) {
    const w = h.width;
    // lighter patched tarmac on the road surface
    g.fillStyle(0x6b6e75, 1);
    g.fillRect(4, FAR + 6, w - 8, NEAR - FAR - 12);
    g.lineStyle(2, 0x3a3c41, 1);
    g.strokeRect(4, FAR + 6, w - 8, NEAR - FAR - 12);
    // raised tan mounds where the patch was dumped, with dark gaps
    const mounds = Math.max(2, Math.round(w / 70));
    for (let i = 0; i < mounds; i++) {
        const cx = ((i + 0.5) / mounds) * w;
        const hw = 18 + (i % 2) * 6;
        const ht = 9 + (i % 3) * 3;
        g.fillStyle(0x9b8762, 1);
        g.fillTriangle(cx - hw, G + 2, cx + hw, G + 2, cx + (i % 2 ? 4 : -4), G - ht);
        g.lineStyle(2.5, P.ink, 1);
        g.strokeTriangle(cx - hw, G + 2, cx + hw, G + 2, cx + (i % 2 ? 4 : -4), G - ht);
        g.fillStyle(0x2a2420, 1);
        g.fillTriangle(cx - 5, G - 1, cx + 5, G - 1, cx, G - ht * 0.55);
    }
    g.fillStyle(0xa9abb1, 1);
    for (let i = 0; i < 12; i++) g.fillRect((i * 37) % w, G + 4 + ((i * 7) % 12), 3, 3);
}

function drawManhole(g: Phaser.GameObjects.Graphics, h: Hazard) {
    const w = h.width;
    const cx = w / 2;
    // iron lid seen on the road surface
    g.fillStyle(0x3b3f45, 1);
    g.fillEllipse(cx, G + 12, w + 14, 30);
    g.lineStyle(3, 0x1f2226, 1);
    g.strokeEllipse(cx, G + 12, w + 14, 30);
    g.lineStyle(1.5, 0x6b7078, 1);
    for (let i = -2; i <= 2; i++) g.lineBetween(cx + i * 9 - 6, G + 2, cx + i * 9 + 6, G + 22);
    g.strokeEllipse(cx, G + 12, w - 6, 20);
    // sunken lip on the wheel line
    const pts = profilePts(h, 1.4);
    g.fillStyle(0x23262b, 1);
    g.fillPoints([{ x: 0, y: G }, ...pts, { x: w, y: G }], true);
    g.lineStyle(2.5, P.ink, 1);
    g.strokePoints(pts, false);
}

function drawRumbleStrip(g: Phaser.GameObjects.Graphics, h: Hazard) {
    const w = h.width;
    const n = 7;
    for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) / n) * w;
        // painted raised bar across the road
        g.fillStyle(i % 2 ? 0xffffff : P.yellow, 0.95);
        g.fillPoints(
            [
                { x: x - 5, y: FAR + 4 },
                { x: x + 3, y: FAR + 4 },
                { x: x + 7, y: NEAR - 4 },
                { x: x - 1, y: NEAR - 4 },
            ],
            true,
        );
        // little bump on the wheel line
        g.fillStyle(i % 2 ? 0xffffff : P.yellow, 1);
        g.fillEllipse(x, G, 12, 9);
        g.lineStyle(2, P.ink, 1);
        g.strokeEllipse(x, G, 12, 9);
    }
}

function drawGravel(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, h: Hazard, root: Phaser.GameObjects.Container) {
    const w = h.width;
    // loose dirt over the road
    g.fillStyle(0x9b8466, 1);
    g.fillRect(0, FAR + 2, w, NEAR - FAR - 4);
    g.fillStyle(0x86704f, 1);
    for (let i = 0; i < 30; i++) g.fillEllipse((i * 53 + h.id * 17) % w, FAR + 10 + ((i * 19) % 70), 10, 5);
    g.fillStyle(0xbdb6a8, 1);
    for (let i = 0; i < 40; i++) g.fillCircle((i * 31 + h.id * 7) % w, FAR + 6 + ((i * 23) % 78), 2 + (i % 3));
    // lumpy surface on the wheel line
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i <= 40; i++) {
        const x = (i / 40) * w;
        pts.push({ x, y: G - Math.abs(hazardProfile(h, h.x + x)) * 1.4 - 1 });
    }
    g.fillStyle(0x9b8466, 1);
    g.fillPoints([...pts, { x: w, y: G + 4 }, { x: 0, y: G + 4 }], true);
    g.lineStyle(2, 0x5a4a35, 1);
    g.strokePoints(pts, false);
    // metro barricades along the far footpath + cones
    for (let bx = 20; bx < w - 20; bx += 140) {
        g.fillStyle(0x56606b, 1);
        g.fillRect(bx, FAR - 30, 4, 30);
        g.fillRect(bx + 76, FAR - 30, 4, 30);
        for (let s = 0; s < 6; s++) {
            g.fillStyle(s % 2 ? 0x2b2b2b : P.yellow, 1);
            g.fillPoints(
                [
                    { x: bx + s * 14, y: FAR - 44 },
                    { x: bx + s * 14 + 14, y: FAR - 44 },
                    { x: bx + s * 14 + 6, y: FAR - 28 },
                    { x: bx + s * 14 - 8, y: FAR - 28 },
                ],
                true,
            );
        }
        g.lineStyle(2, P.ink, 1);
        g.strokeRect(bx - 4, FAR - 44, 88, 16);
    }
    for (const cx of [-14, w + 14]) {
        g.fillStyle(0xff7a1a, 1);
        g.fillTriangle(cx - 10, G + 2, cx + 10, G + 2, cx, G - 30);
        g.fillStyle(0xffffff, 1);
        g.fillRect(cx - 5, G - 16, 10, 5);
        g.lineStyle(2, P.ink, 1);
        g.strokeTriangle(cx - 10, G + 2, cx + 10, G + 2, cx, G - 30);
    }
    const board = scene.add.graphics();
    board.fillStyle(0x56606b, 1);
    board.fillRect(-46, FAR - 120, 5, 120);
    board.fillStyle(P.yellow, 1);
    board.fillRoundedRect(-96, FAR - 158, 104, 46, 6);
    board.lineStyle(3, P.ink, 1);
    board.strokeRoundedRect(-96, FAR - 158, 104, 46, 6);
    const txt = scene.add
        .text(-44, FAR - 135, 'METRO WORK\nGO SLOW', { fontFamily: FONT, fontSize: '15px', color: '#2b1d14', fontStyle: '800', align: 'center' })
        .setOrigin(0.5)
        .setLineSpacing(-4);
    root.add([board, txt]);
}

function drawSignal(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, h: Hazard, root: Phaser.GameObjects.Container): HazardView['update'] {
    const stop = h.width + 34;
    // zebra crossing + stop line
    for (let i = 0; i < 6; i++) {
        g.fillStyle(0xf4f1e6, 0.9);
        g.fillRect(stop + 20 + i * 20, FAR + 6, 11, NEAR - FAR - 12);
    }
    g.fillStyle(0xffffff, 1);
    g.fillRect(stop, FAR + 4, 7, NEAR - FAR - 8);
    // pole on the far footpath
    const px = stop + 160;
    g.fillStyle(0x56606b, 1);
    g.fillRect(px - 3, FAR - 200, 6, 200);
    g.fillRect(px - 3, FAR - 200, 46, 6);
    g.fillStyle(0x1b1b1b, 1);
    g.fillRoundedRect(px + 30, FAR - 214, 30, 78, 8);
    g.lineStyle(3, P.ink, 1);
    g.strokeRoundedRect(px + 30, FAR - 214, 30, 78, 8);
    const lamps = scene.add.graphics();
    root.add(lamps);
    return (sim: RideSimulation) => {
        let lit: 'red' | 'amber' | 'green' = 'red';
        const b = sim.brake;
        if (b.hazard?.id === h.id) {
            if (b.phase === 'recover') lit = 'green';
            else if (b.phase === 'hold' && b.holdLeft < 0.6) lit = 'amber';
        } else if (sim.frontX > h.x) lit = 'green';
        lamps.clear();
        const colors = { red: 0xff3b30, amber: 0xffb020, green: 0x2fd158 };
        (['red', 'amber', 'green'] as const).forEach((c, i) => {
            const on = c === lit;
            lamps.fillStyle(on ? colors[c] : 0x3a3a3a, 1);
            lamps.fillCircle(px + 45, FAR - 200 + i * 24, 9);
            if (on) {
                lamps.fillStyle(colors[c], 0.25);
                lamps.fillCircle(px + 45, FAR - 200 + i * 24, 16);
            }
        });
    };
}

function drawCutIn(scene: Phaser.Scene, h: Hazard, root: Phaser.GameObjects.Container): HazardView['update'] {
    // A scooter waits in the next lane, then swerves in front of the auto and zooms off.
    // Drawn at a believable size next to the auto (the raw texture reads as a toy).
    const S = 1.75;
    const sc = scene.add.image(h.width - 40, NEAR + 18, 'scooter').setOrigin(0.5, 1).setScale(TEX_SCALE * S);
    const lines = scene.add.graphics();
    root.add([lines, sc]);
    return (sim: RideSimulation, time: number) => {
        const d = h.x + h.width - sim.frontX;
        const k = Math.min(1, Math.max(0, (h.width + 60 - d) / (h.width * 0.9)));
        const e = k * k * (3 - 2 * k);
        sc.x = h.width - 40 + e * 260;
        sc.y = NEAR + 18 - e * (NEAR - G + 14) + Math.sin(time * 30) * (k > 0 && k < 1 ? 1 : 0);
        sc.setRotation(k > 0 && k < 0.7 ? -0.12 : 0);
        lines.clear();
        if (k > 0.05 && k < 1) {
            lines.lineStyle(3, 0xffffff, 0.7);
            for (let i = 0; i < 3; i++) lines.lineBetween(sc.x - (70 + i * 14) * S, sc.y - (20 + i * 14) * S, sc.x - (110 + i * 14) * S, sc.y - (20 + i * 14) * S);
        }
    };
}

/** Rain: a muddy puddle sheen sits over potholes, so you see *something* but not its shape. */
function drawPuddleCover(scene: Phaser.Scene, h: Hazard, root: Phaser.GameObjects.Container): (t: number) => void {
    const w = h.width;
    const g = scene.add.graphics();
    root.add(g);
    return (t: number) => {
        g.clear();
        g.fillStyle(0x7c8a99, 0.62);
        g.fillEllipse(w / 2, G + 4, w + 34, 30);
        g.lineStyle(2, 0xdbe9f5, 0.8);
        const r = (t * 1.2) % 1;
        g.strokeEllipse(w / 2 + Math.sin(t) * 6, G + 4, 20 + r * (w * 0.6), 6 + r * 12);
        g.lineStyle(2, 0xffffff, 0.5);
        g.lineBetween(w * 0.2, G - 2, w * 0.45, G - 2);
    };
}

function drawCow(scene: Phaser.Scene, h: Hazard, root: Phaser.GameObjects.Container): HazardView['update'] {
    // The cow stands in the lane, then ambles to the far side as the auto crawls up.
    const cow = scene.add.image(h.width, NEAR - 8, 'zebu').setOrigin(0.5, 1).setScale(TEX_SCALE * 0.95);
    root.add(cow);
    return (sim: RideSimulation, time: number) => {
        const d = h.x + h.width - sim.frontX;
        const k = Math.min(1, Math.max(0, (h.width - d) / (h.width * 0.75)));
        const e = k * k * (3 - 2 * k);
        cow.y = NEAR - 8 - e * (NEAR - FAR + 14) + (k > 0 && k < 1 ? Math.sin(time * 14) * 1.5 : 0);
        cow.setScale(TEX_SCALE * (0.95 - e * 0.18));
        cow.x = h.width + 30 + e * 40;
    };
}

/**
 * The massive pothole: a crater several times the size of a normal one, with
 * smashed slabs, exposed rebar, a striped barricade on the far side and a
 * blinking warning lamp, so it never reads as "just another pothole".
 */
function drawMassivePothole(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, h: Hazard, root: Phaser.GameObjects.Container): (t: number) => void {
    const w = h.width;
    // top-down: a huge dark crater eating most of the lane, with a broken grey rim
    g.fillStyle(0x6a6c72, 1);
    g.fillEllipse(w / 2, G + 16, w + 70, 50);
    g.fillStyle(0x0d0e10, 1);
    g.fillEllipse(w / 2, G + 17, w + 34, 38);
    // cross-section: deep, steep and dark
    bowl(g, h, 0x0b0c0e, 2.4);
    // muddy water glinting at the bottom
    const bottom = G + h.depth * 2.4;
    g.fillStyle(0x3b3a34, 1);
    g.fillEllipse(w / 2, bottom - 7, w * 0.55, 10);
    g.lineStyle(2, 0x8fa9bd, 0.8);
    g.lineBetween(w * 0.34, bottom - 9, w * 0.5, bottom - 9);
    // smashed asphalt slabs tipped up on both lips
    g.fillStyle(0x5a5c62, 1);
    g.lineStyle(3, P.ink, 1);
    const slab = (pts: number[][]) => {
        const v = pts.map(([x, y]) => ({ x, y }));
        g.fillPoints(v, true);
        g.strokePoints(v, true);
    };
    slab([[-26, G], [-4, G], [-8, G - 14], [-22, G - 9]]);
    slab([[-40, G + 2], [-28, G + 2], [-32, G - 6]]);
    slab([[w + 4, G], [w + 30, G], [w + 22, G - 12], [w + 8, G - 16]]);
    slab([[w + 32, G + 2], [w + 46, G + 2], [w + 40, G - 7]]);
    // bent rebar sticking out of the far wall
    g.lineStyle(3, 0xb5562e, 1);
    g.lineBetween(w - 6, G + 10, w - 20, G - 8);
    g.lineBetween(w - 20, G - 8, w - 30, G - 4);
    g.lineBetween(10, G + 14, 22, G - 4);
    // long cracks radiating across the road
    g.lineStyle(2.5, 0x2a2b2f, 1);
    g.lineBetween(-30, G + 6, -64, G + 22);
    g.lineBetween(-64, G + 22, -80, G + 18);
    g.lineBetween(w + 40, G + 4, w + 74, G + 18);
    g.lineBetween(w * 0.3, G + 14, w * 0.18, FAR + 4);
    g.lineBetween(w * 0.7, G + 14, w * 0.85, FAR + 2);

    // striped barricade on the far side of the road (the auto passes in front)
    const bx = w / 2 - 50;
    const by = FAR - 46;
    g.fillStyle(0x3a3a3a, 1);
    g.fillRect(bx + 8, by + 14, 6, 40);
    g.fillRect(bx + 86, by + 14, 6, 40);
    g.fillStyle(0xffffff, 1);
    g.fillRect(bx, by, 100, 18);
    g.fillStyle(P.red, 1);
    for (let i = 0; i < 5; i++) g.fillTriangle(bx + i * 20, by + 18, bx + i * 20 + 10, by, bx + i * 20 + 20, by + 18);
    g.lineStyle(3, P.ink, 1);
    g.strokeRect(bx, by, 100, 18);
    // warning sign on the approach: big yellow triangle with "!"
    const sx = -70;
    const sy = FAR - 72;
    g.fillStyle(0x6b6b6b, 1);
    g.fillRect(sx - 3, sy + 20, 6, 70);
    g.fillStyle(P.yellow, 1);
    g.fillTriangle(sx - 30, sy + 26, sx + 30, sy + 26, sx, sy - 26);
    g.lineStyle(4, P.ink, 1);
    g.strokeTriangle(sx - 30, sy + 26, sx + 30, sy + 26, sx, sy - 26);
    const bang = scene.add.text(sx, sy + 6, '!', { fontFamily: FONT, fontSize: '34px', color: P.inkCss, fontStyle: '800' }).setOrigin(0.5);
    root.add(bang);
    // blinking amber lamp on the barricade
    const lamp = scene.add.graphics();
    root.add(lamp);
    return (t: number) => {
        const on = Math.sin(t * 9) > 0;
        lamp.clear();
        lamp.fillStyle(on ? 0xffb020 : 0x7a5a20, 1);
        lamp.fillCircle(bx + 50, by - 8, 7);
        lamp.lineStyle(2.5, P.ink, 1);
        lamp.strokeCircle(bx + 50, by - 8, 7);
        if (on) {
            lamp.fillStyle(0xffd27a, 0.35);
            lamp.fillCircle(bx + 50, by - 8, 16);
        }
        bang.setScale(1 + (on ? 0.08 : 0));
    };
}

export function createHazardView(scene: Phaser.Scene, h: Hazard, weather?: WeatherProfile): HazardView {
    const g = scene.add.graphics();
    const root = scene.add.container(0, 0, [g]);
    let update: HazardView['update'];
    let lights: HazardView['lights'];
    switch (h.type) {
        case 'pothole':
            drawPothole(g, h);
            break;
        case 'massivePothole': {
            const anim = drawMassivePothole(scene, g, h, root);
            update = (_s, t) => anim(t);
            lights = () => [{ x: h.width / 2, y: FAR - 54, r: 60 }];
            break;
        }
        case 'waterlogged': {
            const anim = drawWaterlogged(g, h, root);
            update = (_s, t) => anim(t);
            break;
        }
        case 'speedBreaker':
            drawSpeedBreaker(g, h);
            break;
        case 'uneven':
            drawRepairPatch(g, h);
            break;
        case 'manhole':
            drawManhole(g, h);
            break;
        case 'rumbleStrip':
            drawRumbleStrip(g, h);
            break;
        case 'gravel':
            drawGravel(scene, g, h, root);
            break;
        case 'signal':
            update = drawSignal(scene, g, h, root);
            lights = () => [{ x: h.width + 34 + 160 + 45, y: FAR - 176, r: 70 }];
            break;
        case 'cutIn':
            update = drawCutIn(scene, h, root);
            break;
        case 'cow':
            update = drawCow(scene, h, root);
            break;
        default: {
            const never: never = h.type;
            void never;
        }
    }
    // rain hides pothole shapes under puddles
    if (weather?.puddles && (h.type === 'pothole' || h.type === 'manhole')) {
        const cover = drawPuddleCover(scene, h, root);
        const prev = update;
        update = (sim, t) => {
            prev?.(sim, t);
            cover(t);
        };
    }
    // reflective paint catches the headlight at night
    if (h.type === 'speedBreaker' || h.type === 'rumbleStrip') lights = () => [{ x: h.width / 2, y: G + 10, r: 46 }];
    return { root, update, lights };
}
