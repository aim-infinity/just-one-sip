import Phaser from 'phaser';
import type { RideSimulation } from '../core/simulation';
import { AUTO_TEX } from './textures';
import { GROUND_Y, PALETTE as P } from './palette';

export type Mood = 'calm' | 'drinking' | 'nervous' | 'shock' | 'happy' | 'soaked';

type V = { x: number; y: number };

// Passenger geometry in auto-local space (origin = axle midpoint, y down).
const HIP: V = { x: -100, y: -90 };
const SHOULDER: V = { x: -92, y: -126 };
const HEAD: V = { x: -86, y: -150 };
const MOUTH_OFF: V = { x: 14, y: 5 };
const HAND_DOWN: V = { x: -64, y: -98 };
const HAND_UP: V = { x: -46, y: -150 };
const HAND_CTRL: V = { x: -30, y: -114 };
const DRINK_ANGLE = -1.75;
const UPPER_ARM = 29;
const FOREARM = 29;

// Bottle shape in bottle-local space (grip at origin, neck up = -y)
const BOTTLE_TIP: V = { x: 0, y: -26 };
const BOTTLE_INNER = { x0: -7, x1: 7, y0: -13, y1: 21 };

/** The auto art is authored for a 190 px wheelbase; it is scaled to TUNING.wheelbasePx. */
export const ART_WHEELBASE = 190;

const rot = (v: V, a: number): V => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y });
const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

/** Clip a convex polygon against the half-plane dot(p, n) >= d. */
function clip(poly: V[], n: V, d: number): V[] {
    const out: V[] = [];
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const da = a.x * n.x + a.y * n.y - d;
        const db = b.x * n.x + b.y * n.y - d;
        if (da >= 0) out.push(a);
        if (da >= 0 !== db >= 0) {
            const t = da / (da - db);
            out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
    }
    return out;
}

function area(poly: V[]): number {
    let s = 0;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
}

/**
 * Water polygon inside a tilted bottle: finds the level (perpendicular to
 * world gravity) that encloses `fill` of the bottle's area. Bottle-local.
 */
export function waterPolygon(angle: number, fill: number): V[] {
    const b = BOTTLE_INNER;
    const rect: V[] = [
        { x: b.x0, y: b.y0 },
        { x: b.x1, y: b.y0 },
        { x: b.x1, y: b.y1 },
        { x: b.x0, y: b.y1 },
    ];
    if (fill <= 0.001) return [];
    if (fill >= 0.999) return rect;
    const g: V = { x: Math.sin(angle), y: Math.cos(angle) }; // world-down in bottle space
    const proj = rect.map((p) => p.x * g.x + p.y * g.y);
    let lo = Math.min(...proj);
    let hi = Math.max(...proj);
    const total = area(rect);
    for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (area(clip(rect, g, mid)) / total > fill) lo = mid;
        else hi = mid;
    }
    return clip(rect, g, (lo + hi) / 2);
}

export interface AutoPose {
    /** Screen-space x of the axle midpoint. */
    x: number;
    mood: Mood;
    /** Visual scale for body motion (reduced motion → smaller). */
    motionScale: number;
    blink: boolean;
}

/** Draws the auto, driver, passenger, drinking arm and bottle from sim state. */
export class AutoView {
    readonly container: Phaser.GameObjects.Container;
    private rearWheel: Phaser.GameObjects.Image;
    private frontWheel: Phaser.GameObjects.Image;
    private shadow: Phaser.GameObjects.Ellipse;
    private driverHead: Phaser.GameObjects.Image;
    private pax: Phaser.GameObjects.Graphics;
    private arm: Phaser.GameObjects.Graphics;

    /** Last computed positions (auto-local) — used by effects. */
    mouthLocal: V = { x: 0, y: 0 };
    tipLocal: V = { x: 0, y: 0 };
    bottleAngle = 0;

    constructor(scene: Phaser.Scene) {
        this.shadow = scene.add.ellipse(0, GROUND_Y + 6, 330, 18, 0x000000, 0.25).setDepth(7);
        this.rearWheel = scene.add.image(0, 0, 'wheel').setDepth(9);
        this.frontWheel = scene.add.image(0, 0, 'wheel').setDepth(9);
        const ox = AUTO_TEX.ox / AUTO_TEX.w;
        const oy = AUTO_TEX.oy / AUTO_TEX.h;
        const back = scene.add.image(0, 0, 'autoBack').setOrigin(ox, oy);
        this.driverHead = scene.add.image(82, -152, 'driverHead');
        this.pax = scene.add.graphics();
        const front = scene.add.image(0, 0, 'autoFront').setOrigin(ox, oy);
        this.arm = scene.add.graphics();
        this.container = scene.add.container(0, 0, [back, this.driverHead, this.pax, front, this.arm]).setDepth(10);
    }

    /** Converts an auto-local point to screen space. */
    toScreen(p: V): V {
        const c = this.container;
        const r = rot({ x: p.x * c.scaleX, y: p.y * c.scaleY }, c.rotation);
        return { x: c.x + r.x, y: c.y + r.y };
    }

    update(sim: RideSimulation, camX: number, pose: AutoPose): void {
        const t = sim.t;
        const R = t.wheelRadiusPx;
        const ms = pose.motionScale;
        const S = t.wheelbasePx / ART_WHEELBASE;
        this.container.setScale(S);
        this.rearWheel.setScale(S);
        this.frontWheel.setScale(S);
        const rearSX = sim.rearX - camX;
        const frontSX = sim.frontX - camX;

        // wheels ride the actual road profile
        const rearRoad = sim.road.heightAt(sim.rearX);
        const frontRoad = sim.road.heightAt(sim.frontX);
        const spin = sim.distance / R;
        this.rearWheel.setPosition(rearSX, GROUND_Y - R - rearRoad).setRotation(spin);
        this.frontWheel.setPosition(frontSX, GROUND_Y - R - frontRoad).setRotation(spin);

        // body follows the suspension springs
        const s = sim.suspension;
        const bodyH = s.height * ms + ((rearRoad + frontRoad) / 2) * (1 - ms);
        this.container.setPosition(pose.x, GROUND_Y - R - bodyH);
        this.container.setRotation(-s.pitch * ms);
        this.shadow.setPosition(pose.x - 6, GROUND_Y + 8).setScale(S * (1 - Math.min(0.25, Math.abs(s.height) / 80)), S);

        // driver bobs with the torso spring, slightly delayed look
        const rig = sim.rig;
        this.driverHead.y = -152 - rig.torsoOffset * 0.8;
        this.driverHead.rotation = Math.sin(sim.time * 1.7) * 0.03 - rig.headOffset * 0.004;

        this.drawPassenger(sim, pose);
        this.drawArmAndBottle(sim);
    }

    private drawPassenger(sim: RideSimulation, pose: AutoPose): void {
        const g = this.pax;
        const rig = sim.rig;
        g.clear();
        const tDy = -rig.torsoOffset;
        const hDy = -rig.headOffset;
        const sh: V = { x: SHOULDER.x, y: SHOULDER.y + tDy };
        const head: V = { x: HEAD.x, y: HEAD.y + hDy };

        // legs (thigh visible above the body panel)
        g.lineStyle(17, P.ink, 1);
        g.lineBetween(HIP.x, HIP.y + 2, -50, -90);
        g.lineStyle(13, P.pants, 1);
        g.lineBetween(HIP.x, HIP.y + 2, -50, -90);
        g.lineBetween(-50, -90, -46, -40);
        // torso
        g.lineStyle(34, P.ink, 1);
        g.lineBetween(HIP.x, HIP.y - 6, sh.x, sh.y + 6);
        g.lineStyle(28, P.shirt, 1);
        g.lineBetween(HIP.x, HIP.y - 6, sh.x, sh.y + 6);
        g.fillStyle(P.shirtShade, 1);
        g.fillRect(sh.x - 2, sh.y + 4, 3, HIP.y - sh.y - 14);
        // wet patches grow with spilled water — you can see why you lost it
        const wet = Math.min(8, Math.floor(sim.bottle.spilledMl / 12));
        g.fillStyle(0x1f3f8a, 0.55);
        for (let i = 0; i < wet; i++) {
            const wx = sh.x - 8 + ((i * 7) % 17);
            const wy = sh.y + 10 + ((i * 11) % (HIP.y - sh.y - 18));
            g.fillCircle(wx, wy, 4 + (i % 3));
        }
        // neck
        g.fillStyle(P.skinShade, 1);
        g.fillRect(head.x - 5, sh.y - 12, 10, Math.max(6, head.y + 12 - (sh.y - 12)));

        this.drawHead(g, head, pose, sim);
        this.mouthLocal = add(head, MOUTH_OFF);
    }

    private drawHead(g: Phaser.GameObjects.Graphics, c: V, pose: AutoPose, sim: RideSimulation): void {
        const { x, y } = c;
        const mood = pose.mood;
        // face
        g.fillStyle(P.skin, 1);
        g.fillCircle(x, y, 16);
        g.lineStyle(3, P.ink, 1);
        g.strokeCircle(x, y, 16);
        // hair
        g.fillStyle(P.hair, 1);
        g.slice(x - 1, y - 2, 16.5, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(345), false);
        g.fillPath();
        g.fillRect(x - 17, y - 6, 10, 11);
        // ear
        g.fillStyle(P.skinShade, 1);
        g.fillCircle(x - 3, y + 2, 4);
        // nose
        g.fillStyle(P.skin, 1);
        g.fillCircle(x + 15.5, y + 1, 3.5);
        g.lineStyle(2, P.ink, 1);
        g.beginPath();
        g.arc(x + 15.5, y + 1, 3.5, -1.2, 1.4);
        g.strokePath();

        const ex = x + 8.5;
        const ey = y - 2;
        // eyes
        g.lineStyle(2.2, P.ink, 1);
        if (mood === 'drinking' || mood === 'happy' || (pose.blink && mood === 'calm')) {
            g.beginPath();
            if (mood === 'happy') g.arc(ex, ey + 2, 3.5, Math.PI * 1.1, Math.PI * 1.9);
            else g.arc(ex, ey - 1, 3.5, Math.PI * 0.15, Math.PI * 0.85);
            g.strokePath();
        } else if (mood === 'shock' || mood === 'nervous') {
            const r = mood === 'shock' ? 5.8 : 4.6;
            g.fillStyle(0xffffff, 1);
            g.fillCircle(ex, ey, r);
            g.strokeCircle(ex, ey, r);
            g.fillStyle(P.ink, 1);
            g.fillCircle(ex + (mood === 'nervous' ? 2 : 0.5), ey, mood === 'shock' ? 1.6 : 2);
        } else {
            g.fillStyle(P.ink, 1);
            g.fillCircle(ex + 1, ey, 2.3);
        }
        // glasses
        g.lineStyle(1.8, 0x34495e, 1);
        g.strokeCircle(ex, ey, 7);
        g.lineBetween(ex + 7, ey - 1, x + 15, y - 4);
        g.lineBetween(ex - 7, ey - 1, x - 2, y - 2);

        // brows
        g.lineStyle(2.5, P.hair, 1);
        if (mood === 'nervous') g.lineBetween(ex - 5, ey - 9, ex + 5, ey - 12);
        else if (mood === 'shock') g.lineBetween(ex - 5, ey - 13, ex + 5, ey - 13);
        else if (mood === 'soaked') g.lineBetween(ex - 5, ey - 11, ex + 5, ey - 8);
        else g.lineBetween(ex - 5, ey - 10, ex + 5, ey - 10);

        // mouth
        const mx = x + 12;
        const my = y + 8;
        g.lineStyle(2.2, P.ink, 1);
        if (mood === 'drinking') {
            g.fillStyle(P.skin, 1);
            g.fillCircle(x + 8, y + 7, 5.5); // puffed cheek
            g.lineStyle(1.5, P.skinShade, 1);
            g.strokeCircle(x + 8, y + 7, 5.5);
        } else if (mood === 'shock') {
            g.fillStyle(0x6b1f1f, 1);
            g.fillEllipse(mx, my + 1, 6, 8);
        } else if (mood === 'happy') {
            g.beginPath();
            g.arc(mx - 1, my - 2, 5, Math.PI * 0.15, Math.PI * 0.85);
            g.strokePath();
            g.fillStyle(0xff8a80, 0.6);
            g.fillCircle(x + 4, y + 5, 3.5);
        } else if (mood === 'soaked') {
            g.beginPath();
            g.arc(mx - 1, my + 4, 4.5, Math.PI * 1.15, Math.PI * 1.85);
            g.strokePath();
        } else if (mood === 'nervous') {
            g.beginPath();
            g.moveTo(mx - 5, my);
            g.lineTo(mx - 2.5, my - 1.5);
            g.lineTo(mx, my);
            g.lineTo(mx + 2.5, my - 1.5);
            g.lineTo(mx + 4, my);
            g.strokePath();
        } else {
            g.lineBetween(mx - 3, my, mx + 3, my - 1);
        }

        // sweat / drips
        if (mood === 'nervous') {
            g.fillStyle(P.water, 1);
            g.fillCircle(x - 6, y - 14, 3);
            g.fillTriangle(x - 9, y - 15, x - 3, y - 15, x - 6, y - 21);
        }
        if (mood === 'soaked' || sim.bottle.spilledMl > 40) {
            g.fillStyle(P.water, 0.9);
            const t = sim.time * 3;
            for (let i = 0; i < 3; i++) {
                const k = (t + i * 0.33) % 1;
                g.fillCircle(x - 8 + i * 9, y + 10 + k * 14, 2);
            }
        }
    }

    private drawArmAndBottle(sim: RideSimulation): void {
        const g = this.arm;
        g.clear();
        const rig = sim.rig;
        const p = ease(sim.arm.progress);
        const tDy = -rig.torsoOffset;
        const aDy = -rig.handOffset;
        const sh: V = { x: SHOULDER.x + 2, y: SHOULDER.y + 2 + tDy };

        // hand follows a curved path lap → lips, plus its own spring offset
        const u = 1 - p;
        const hand: V = {
            x: u * u * HAND_DOWN.x + 2 * u * p * HAND_CTRL.x + p * p * HAND_UP.x,
            y: u * u * HAND_DOWN.y + 2 * u * p * HAND_CTRL.y + p * p * HAND_UP.y + aDy,
        };
        const angle = DRINK_ANGLE * ease(Math.min(1, sim.arm.progress * 1.15));
        this.bottleAngle = angle;
        this.tipLocal = add(hand, rot(BOTTLE_TIP, angle));

        // two-bone IK, elbow bends downward
        const dx = hand.x - sh.x;
        const dy = hand.y - sh.y;
        const d = Math.min(Math.hypot(dx, dy), UPPER_ARM + FOREARM - 0.5);
        const a = (UPPER_ARM * UPPER_ARM - FOREARM * FOREARM + d * d) / (2 * d);
        const h = Math.sqrt(Math.max(0, UPPER_ARM * UPPER_ARM - a * a));
        const nx = dx / (Math.hypot(dx, dy) || 1);
        const ny = dy / (Math.hypot(dx, dy) || 1);
        let px = -ny;
        let py = nx;
        if (py < 0) {
            px = -px;
            py = -py;
        }
        const elbow: V = { x: sh.x + nx * a + px * h, y: sh.y + ny * a + py * h };

        this.drawBottle(g, hand, angle, sim.bottle.fill, sim);

        // upper arm (sleeve) and forearm (skin)
        g.lineStyle(14, P.ink, 1);
        g.lineBetween(sh.x, sh.y, elbow.x, elbow.y);
        g.lineStyle(10, P.shirt, 1);
        g.lineBetween(sh.x, sh.y, elbow.x, elbow.y);
        g.lineStyle(11, P.ink, 1);
        g.lineBetween(elbow.x, elbow.y, hand.x, hand.y);
        g.lineStyle(7.5, P.skin, 1);
        g.lineBetween(elbow.x, elbow.y, hand.x, hand.y);
        g.fillStyle(P.shirt, 1);
        g.fillCircle(elbow.x, elbow.y, 5);
        // gripping hand on top of the bottle
        g.fillStyle(P.skin, 1);
        g.fillCircle(hand.x, hand.y, 6.5);
        g.lineStyle(2.5, P.ink, 1);
        g.strokeCircle(hand.x, hand.y, 6.5);

        // the drinking stream — only visible when water is going in
        if (sim.arm.atLips && !sim.bottle.isEmpty) {
            const m = this.mouthLocal;
            const tip = this.tipLocal;
            if (sim.alignment > 0.5) {
                g.lineStyle(3, P.water, 0.9);
                g.lineBetween(tip.x, tip.y, m.x, m.y);
            } else {
                // missing the mouth: water runs down the chin
                g.lineStyle(3, P.water, 0.9);
                g.lineBetween(tip.x, tip.y, tip.x - 3, tip.y + 16);
            }
        }
    }

    private drawBottle(g: Phaser.GameObjects.Graphics, hand: V, angle: number, fill: number, sim: RideSimulation): void {
        const T = (p: V) => add(hand, rot(p, angle));
        const outlinePts: V[] = [
            { x: -8, y: 22 },
            { x: -8, y: -12 },
            { x: -4, y: -19 },
            { x: -4, y: -26 },
            { x: 4, y: -26 },
            { x: 4, y: -19 },
            { x: 8, y: -12 },
            { x: 8, y: 22 },
        ].map(T);
        g.fillStyle(0xe6f6ff, 0.55);
        g.fillPoints(outlinePts, true);
        const water = waterPolygon(angle, fill).map(T);
        if (water.length >= 3) {
            g.fillStyle(P.waterDeep, 0.85);
            g.fillPoints(water, true);
        }
        // label band
        const label = [
            { x: -8, y: 1 },
            { x: 8, y: 1 },
            { x: 8, y: 10 },
            { x: -8, y: 10 },
        ].map(T);
        g.fillStyle(sim.bottle.spilledMl > 0 ? 0x2f6fd8 : 0x2f6fd8, 1);
        g.fillPoints(label, true);
        g.lineStyle(2.5, P.ink, 1);
        g.strokePoints(outlinePts, true);
        // rim
        const r0 = T({ x: -4.5, y: -26 });
        const r1 = T({ x: 4.5, y: -26 });
        g.lineStyle(3.5, 0xffffff, 1);
        g.lineBetween(r0.x, r0.y, r1.x, r1.y);
    }
}
