import Phaser from 'phaser';
import type { RideSimulation } from '../core/simulation';
import { AUTO_TEX, TEX_SCALE } from './textures';
import { ART_WHEELBASE, AUTO_POINTS, DRIVER_HEAD_POS, DRIVER_HEAD_ORIGIN_Y, DRIVER_HEAD_SCALE, driverHeadKey } from './autoArt';
import type { DriverId } from '../config/drivers';
import { GROUND_Y, PALETTE as P } from './palette';

export type Mood = 'calm' | 'drinking' | 'nervous' | 'shock' | 'happy' | 'soaked' | 'cheer' | 'sob' | 'thirsty';

/** How the ride ended — drives the celebration / disappointment animation. */
export type EndPose = 'won' | 'spilledOut' | 'arrivedThirsty';

type V = { x: number; y: number };

// Passenger geometry in auto-local space (origin = axle midpoint, y down).
// Seated close behind the driver: real autos have very little leg room.
export const HIP: V = { x: -70, y: -84 };
export const SHOULDER: V = { x: -62, y: -120 };
export const HEAD: V = { x: -56, y: -144 };
const MOUTH_OFF: V = { x: 14, y: 5 };
const HAND_DOWN: V = { x: -34, y: -92 };
// Drinking like a real person: neck at the lips, base tipped up high over the
// passenger's own face (≈45° above level), so it never reaches the driver and
// tucks under the canopy edge instead of poking out of the cab.
const HAND_UP: V = { x: -24, y: -157 };
const HAND_CTRL: V = { x: -14, y: -120 };
/** Knee and ankle of the seated passenger. */
// Knees stop just short of the driver's seatback (x ≈ −31); shins drop
// straight to the floor and only the toes tuck under the driver's seat box.
const KNEE: V = { x: -35, y: -83 };
const ANKLE: V = { x: -36, y: -27 };
const DRINK_ANGLE = -2.35;
const UPPER_ARM = 29;
const FOREARM = 29;

// Bottle shape in bottle-local space (grip at origin, neck up = -y)
const BOTTLE_TIP: V = { x: 0, y: -26 };
const BOTTLE_INNER = { x0: -7, x1: 7, y0: -13, y1: 21 };

export { ART_WHEELBASE };

/** 3/4-view face outline around the head centre: skull circle ∪ jaw ellipse (facing right). */
const FACE: V[] = (() => {
    const inside = (x: number, y: number) => x * x + y * y <= 15.5 * 15.5 || ((x - 6) / 10.5) ** 2 + ((y - 8) / 8.2) ** 2 <= 1;
    const pts: V[] = [];
    for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        let d = 0;
        while (d < 30 && inside(Math.cos(a) * (d + 0.25), Math.sin(a) * (d + 0.25))) d += 0.25;
        pts.push({ x: Math.cos(a) * d, y: Math.sin(a) * d });
    }
    return pts;
})();

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
    /** Each wheel: a container that squashes (stays upright) holding a spinning tyre + its motion-blur twin. */
    private rearWheel: Phaser.GameObjects.Container;
    private frontWheel: Phaser.GameObjects.Container;
    private wheelParts: { tyre: Phaser.GameObjects.Image; blur: Phaser.GameObjects.Image }[] = [];
    /** Brake-light glow (in the auto container, over the tail lamp). */
    private fxG: Phaser.GameObjects.Graphics;
    private shadow: Phaser.GameObjects.Ellipse;
    private driverHead: Phaser.GameObjects.Image;
    /** Driver body + seat: above the passenger (their shins tuck behind it), sways with the ride. */
    private driverBody: Phaser.GameObjects.Image;
    /** Lime-and-chilli charm swinging under the canopy (a damped pendulum). */
    private charmG: Phaser.GameObjects.Graphics;
    private charm = { a: 0, v: 0 };
    /** Smoothed forward acceleration (px/s²) → body squat / nose-dive. */
    private accel = 0;
    private lastSpeed = 0;
    private lastPitch = 0;
    private pax: Phaser.GameObjects.Graphics;
    private arm: Phaser.GameObjects.Graphics;
    /** The canopy (its own layer so it can break open). */
    readonly roof: Phaser.GameObjects.Image;
    /**
     * Set when the passenger is launched: the seated passenger and drinking
     * arm stop drawing, and the EjectionController's flyer takes over.
     */
    ejected = false;

    /** Last computed positions (auto-local) — used by effects. */
    mouthLocal: V = { x: 0, y: 0 };
    tipLocal: V = { x: 0, y: 0 };
    handLocal: V = { x: 0, y: 0 };
    bottleAngle = 0;

    constructor(scene: Phaser.Scene, driver: DriverId = 'careful') {
        this.shadow = scene.add.ellipse(0, GROUND_Y + 6, 470, 18, 0x000000, 0.25).setDepth(7);
        const wheel = () => {
            const tyre = scene.add.image(0, 0, 'wheel');
            const blur = scene.add.image(0, 0, 'wheelBlur').setAlpha(0);
            this.wheelParts.push({ tyre, blur });
            return scene.add.container(0, 0, [tyre, blur]).setDepth(9);
        };
        this.rearWheel = wheel();
        this.frontWheel = wheel();
        this.fxG = scene.add.graphics();
        const ox = AUTO_TEX.ox / AUTO_TEX.w;
        const oy = AUTO_TEX.oy / AUTO_TEX.h;
        const back = scene.add.image(0, 0, 'autoBack').setOrigin(ox, oy).setScale(TEX_SCALE);
        this.roof = scene.add.image(0, 0, 'autoRoof').setOrigin(ox, oy).setScale(TEX_SCALE);
        this.driverHead = scene.add.image(DRIVER_HEAD_POS.x, DRIVER_HEAD_POS.y, driverHeadKey(driver)).setOrigin(0.5, DRIVER_HEAD_ORIGIN_Y).setScale(TEX_SCALE * DRIVER_HEAD_SCALE);
        this.driverBody = scene.add.image(0, 0, 'autoDriver').setOrigin(ox, oy).setScale(TEX_SCALE);
        this.charmG = scene.add.graphics();
        this.pax = scene.add.graphics();
        const front = scene.add.image(0, 0, 'autoFront').setOrigin(ox, oy).setScale(TEX_SCALE);
        this.arm = scene.add.graphics();
        this.container = scene.add
            // Back to front, as in real life: the passenger's arm and bottle are
            // inside the cab, so the near-side canopy edge (roof band) and the
            // near-side bodywork are drawn over them. Lift the bottle above the
            // doorway and the canopy edge hides it, instead of it floating outside.
            .container(0, 0, [back, this.pax, this.driverBody, this.driverHead, this.charmG, this.arm, this.roof, front, this.fxG])
            .setDepth(10);
    }

    /** Converts an auto-local point to screen space. */
    toScreen(p: V): V {
        const c = this.container;
        const r = rot({ x: p.x * c.scaleX, y: p.y * c.scaleY }, c.rotation);
        return { x: c.x + r.x, y: c.y + r.y };
    }

    /** Set when the ride ends; the passenger and driver react. */
    endPose: EndPose | null = null;
    private endT = 0;

    update(sim: RideSimulation, camX: number, pose: AutoPose, _dt = 0): void {
        if (this.endPose) {
            this.endT += _dt;
            pose = { ...pose, mood: this.endPose === 'won' ? 'cheer' : this.endPose === 'spilledOut' ? 'sob' : 'thirsty', blink: false };
        }
        const t = sim.t;
        const R = t.wheelRadiusPx;
        const ms = pose.motionScale;
        const S = t.wheelbasePx / ART_WHEELBASE;
        this.container.setScale(S);
        const rearSX = sim.rearX - camX;
        const frontSX = sim.frontX - camX;

        // wheels ride the actual road profile
        const rearRoad = sim.road.heightAt(sim.rearX);
        const frontRoad = sim.road.heightAt(sim.frontX);
        const spin = sim.distance / R;
        const s = sim.suspension;
        // Tyres squash when their corner of the body is pushed below its rest
        // height (landing out of a pothole), and bulge a little sideways.
        const squash = (corner: number, road: number) => Math.min(0.16, Math.max(0, road - corner) * 0.012) * ms;
        // spin blur fades in with speed (px/s): rim cut-outs read clearly up
        // to ~25 km/h, curved streaks take over by ~55 km/h
        const blur = Math.min(0.9, Math.max(0, (sim.speed - 700) / 850));
        const place = (w: Phaser.GameObjects.Container, x: number, road: number, corner: number) => {
            const q = squash(corner, road);
            // wheel texture is drawn at radius 25; show it at the physics radius
            const k = TEX_SCALE * ((R + 1) / 25);
            w.setScale(k * (1 + q * 0.5), k * (1 - q));
            w.setPosition(x, GROUND_Y - R - road + R * q);
        };
        place(this.rearWheel, rearSX, rearRoad, s.rear.pos);
        place(this.frontWheel, frontSX, frontRoad, s.front.pos);
        for (const p of this.wheelParts) {
            p.tyre.setRotation(spin).setAlpha(1 - blur * 0.75);
            // the real spin aliases at speed; the streaks turn at a readable rate
            p.blur.setRotation(spin * 0.08).setAlpha(blur);
        }

        // body follows the suspension springs, plus the diesel's shake: a
        // visible judder at idle (stopped at a signal), lighter while driving
        const engineOn = !sim.isOver && sim.time > 0;
        const idle = sim.speed < 40;
        const shake = engineOn ? (idle ? 1.1 : 0.35) * ms * Math.sin(sim.time * Math.PI * 2 * (idle ? 19 : 27)) : 0;
        const bodyH = s.height * ms + ((rearRoad + frontRoad) / 2) * (1 - ms) + shake;
        this.container.setPosition(pose.x, GROUND_Y - R - bodyH);
        this.drawBrakeLight(sim);
        // weight transfer: nose lifts as the auto pulls away, dips under braking
        const dt = Math.max(1 / 240, _dt);
        const rawAccel = (sim.speed - this.lastSpeed) / dt;
        this.lastSpeed = sim.speed;
        this.accel += (Math.max(-4000, Math.min(4000, rawAccel)) - this.accel) * Math.min(1, dt * 6);
        const squat = Math.max(-0.022, Math.min(0.035, -this.accel * 0.000016)) * ms;
        const rotation = -s.pitch * ms + squat;
        this.container.setRotation(rotation);
        this.updateCharm(dt, rotation);
        this.shadow.setPosition(pose.x - 6, GROUND_Y + 8).setScale(1 - Math.min(0.25, Math.abs(s.height) / 80), 1);

        // driver bobs with the torso spring, slightly delayed look
        const rig = sim.rig;
        this.driverHead.y = DRIVER_HEAD_POS.y - rig.torsoOffset * 0.8;
        // driver's body rides the same bumps (a touch less) and leans into braking
        this.driverBody.y = -rig.torsoOffset * 0.45;
        this.driverBody.x = rig.torsoX.pos * 0.25;
        this.driverHead.x = DRIVER_HEAD_POS.x + rig.torsoX.pos * 0.35;
        this.driverHead.rotation = Math.sin(sim.time * 1.7) * 0.03 - rig.headOffset * 0.004;
        // happy head-wobble when you finish; a sympathetic droop when you don't
        if (this.endPose === 'won') this.driverHead.rotation = Math.sin(this.endT * 14) * 0.16;
        else if (this.endPose) this.driverHead.rotation = 0.12;

        if (this.ejected) {
            // the driver stares up at the hole where his passenger used to be
            this.driverHead.rotation = -0.22 + Math.sin(sim.time * 20) * 0.03;
            this.pax.clear();
            this.arm.clear();
            return;
        }
        this.drawPassenger(sim, pose);
        this.drawArmAndBottle(sim);
    }

    /**
     * Lime-and-chilli charm hanging under the canopy: a damped pendulum that
     * hangs plumb in the world, so it swings back when the auto pulls away,
     * forward under braking, and wobbles as the body pitches over bumps.
     */
    private updateCharm(dt: number, bodyRot: number): void {
        const L = 24; // string + charm length (art units)
        const g = 981 / (L * 1.3); // gravity / length (1 art ≈ 1.3 px, 100 px = 1 m)
        const pitchRate = (bodyRot - this.lastPitch) / dt;
        this.lastPitch = bodyRot;
        const c = this.charm;
        const steps = Math.ceil(dt / (1 / 120));
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
            const acc = -g * Math.sin(c.a) - (this.accel / (L * 1.3)) * Math.cos(c.a) - 2.2 * c.v;
            c.v += acc * h;
            c.a += c.v * h;
        }
        // a jolt in pitch kicks it too
        c.v -= pitchRate * dt * 2.5;
        c.a = Math.max(-1.1, Math.min(1.1, c.a));
        // draw in auto-local space: world-plumb angle minus the body's rotation
        const a = c.a - bodyRot;
        const P0 = AUTO_POINTS.charm;
        const gx = this.charmG;
        gx.clear();
        const dir = { x: Math.sin(a), y: Math.cos(a) };
        const at = (d: number) => ({ x: P0.x + dir.x * d, y: P0.y + dir.y * d });
        const knot = at(9);
        gx.lineStyle(1.2, 0x2b2b2b, 1);
        gx.lineBetween(P0.x, P0.y, knot.x, knot.y);
        // lime
        const lime = at(12.5);
        gx.fillStyle(0xd8e34a, 1);
        gx.fillCircle(lime.x, lime.y, 3.6);
        gx.lineStyle(1, 0x5d6b14, 1);
        gx.strokeCircle(lime.x, lime.y, 3.6);
        // three green chillies fanning down, each trailing the swing a little
        const lag = Math.max(-0.5, Math.min(0.5, -c.v * 0.06));
        for (const [k, len] of [
            [-0.32, 11],
            [0, 12.5],
            [0.32, 11],
        ] as const) {
            const aa = a + k + lag;
            const base = at(15);
            const tip = { x: base.x + Math.sin(aa) * len, y: base.y + Math.cos(aa) * len };
            gx.lineStyle(2.6, 0x2f8a2a, 1);
            gx.lineBetween(base.x, base.y, tip.x, tip.y);
            gx.fillStyle(0x2f8a2a, 1);
            gx.fillCircle(tip.x, tip.y, 1.2);
        }
        // black bead at the top
        gx.fillStyle(0x1b1b1b, 1);
        gx.fillCircle(knot.x, knot.y, 1.8);
    }

    /** Tail lamp glows red while the driver is on the brakes. */
    private drawBrakeLight(sim: RideSimulation): void {
        const g = this.fxG;
        g.clear();
        const b = sim.brake;
        if (!b.active || b.phase === 'recover' || sim.isOver) return;
        g.fillStyle(0xff3b2f, 0.28);
        const L = AUTO_POINTS.tailLamp;
        g.fillCircle(L.x, L.y, 13);
        g.fillStyle(0xff5a4a, 0.55);
        g.fillCircle(L.x, L.y, 7.5);
        g.fillStyle(0xffd0c8, 1);
        g.fillRoundedRect(L.x - 2.5, L.y - 6, 5, 12, 1.5);
    }

    /** Auto-local positions of the seated passenger right now (for the launch). */
    seatedPose(sim: RideSimulation): { hip: V; head: V; hand: V; bottleAngle: number } {
        const rig = sim.rig;
        return {
            hip: { ...HIP },
            head: { x: HEAD.x + rig.headX.pos, y: HEAD.y - rig.headOffset },
            hand: { ...this.handLocal },
            bottleAngle: this.bottleAngle,
        };
    }

    private drawPassenger(sim: RideSimulation, pose: AutoPose): void {
        const g = this.pax;
        const rig = sim.rig;
        g.clear();
        const tDy = -rig.torsoOffset;
        const hDy = -rig.headOffset;
        // braking throws the torso/head forward (horizontal springs)
        const sh: V = { x: SHOULDER.x + rig.torsoX.pos, y: SHOULDER.y + tDy };
        const head: V = { x: HEAD.x + rig.headX.pos, y: HEAD.y + hDy };
        if (this.endPose === 'won') head.y -= Math.abs(Math.sin(this.endT * 9)) * 4;
        if (this.endPose === 'spilledOut') head.y += 3 + Math.sin(this.endT * 10) * 1;

        // ── legs: thigh along the bench, shin down to the footboard, rounded joints ──
        const hipJ: V = { x: HIP.x + 2, y: HIP.y + 2 };
        const limb = (pts: V[], w: number, col: number) => {
            for (let i = 0; i < pts.length - 1; i++) {
                g.lineStyle(w, col, 1);
                g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
            }
            g.fillStyle(col, 1);
            for (const p of pts) g.fillCircle(p.x, p.y, w / 2);
        };
        limb([hipJ, KNEE, ANKLE], 18, P.ink);
        limb([hipJ, KNEE, ANKLE], 13, P.pants);
        g.lineStyle(1.5, 0x2a2c33, 0.8);
        g.lineBetween(KNEE.x - 4, KNEE.y + 5, KNEE.x - 1, KNEE.y + 2);
        // shoe with a sole
        const A = ANKLE;
        const shoe = [
            { x: A.x - 6, y: A.y + 1 },
            { x: A.x + 3, y: A.y - 4 },
            { x: A.x + 12, y: A.y + 1 },
            { x: A.x + 17, y: A.y + 4 },
            { x: A.x + 17, y: A.y + 8 },
            { x: A.x - 7, y: A.y + 8 },
        ];
        g.fillStyle(0x3a2a20, 1);
        g.fillPoints(shoe, true);
        g.lineStyle(2.5, P.ink, 1);
        g.strokePoints(shoe, true);
        g.lineStyle(2, 0x6b5444, 1);
        g.lineBetween(A.x - 5, A.y + 6, A.x + 15, A.y + 6);

        // ── torso: shirt with shoulders, collar, buttons, pocket, belt ──
        const hp: V = { x: HIP.x, y: HIP.y - 4 };
        const shirt = [
            { x: hp.x - 13, y: hp.y + 6 },
            { x: sh.x - 14, y: sh.y + 5 },
            { x: sh.x - 9, y: sh.y - 4 },
            { x: sh.x + 7, y: sh.y - 5 },
            { x: sh.x + 13, y: sh.y + 4 },
            { x: hp.x + 15, y: hp.y + 6 },
        ];
        g.fillStyle(P.shirt, 1);
        g.fillPoints(shirt, true);
        // shaded back
        g.fillStyle(P.shirtShade, 1);
        g.fillPoints([shirt[0], shirt[1], shirt[2], { x: sh.x - 4, y: sh.y - 3 }, { x: hp.x - 7, y: hp.y + 6 }], true);
        // wet patches grow with spilled water — you can see why you lost it
        const wet = Math.min(8, Math.floor(sim.bottle.spilledMl / 12));
        g.fillStyle(0x1f3f8a, 0.55);
        for (let i = 0; i < wet; i++) {
            const wx = sh.x - 6 + ((i * 7) % 15);
            const wy = sh.y + 8 + ((i * 11) % (HIP.y - sh.y - 16));
            g.fillCircle(wx, wy, 3.5 + (i % 3));
        }
        // placket, buttons, pocket
        g.lineStyle(1.6, P.shirtShade, 1);
        g.lineBetween(sh.x + 6, sh.y - 2, hp.x + 8, hp.y + 4);
        g.fillStyle(0xeef3ff, 1);
        for (const k of [0.25, 0.55]) g.fillCircle(sh.x + 6 + (hp.x + 8 - sh.x - 6) * k, sh.y - 2 + (hp.y + 4 - sh.y + 2) * k, 1.2);
        g.lineStyle(1.4, P.shirtShade, 1);
        g.strokeRect(sh.x - 4, sh.y + 9, 8, 7);
        // belt
        g.lineStyle(4, 0x3b2a20, 1);
        g.lineBetween(hp.x - 12, hp.y + 5, hp.x + 14, hp.y + 5);
        g.lineStyle(3, P.ink, 1);
        g.strokePoints(shirt, true);

        // neck + collar
        g.fillStyle(P.skinShade, 1);
        g.fillRect(head.x - 5, sh.y - 12, 10, Math.max(6, head.y + 12 - (sh.y - 12)));
        g.fillStyle(P.shirt, 1);
        const collar = (dx: number) => [
            { x: head.x + dx * 7, y: sh.y - 7 },
            { x: head.x + dx * 1, y: sh.y + 2 },
            { x: head.x + dx * 9, y: sh.y + 1 },
        ];
        for (const dx of [-1, 1]) {
            g.fillPoints(collar(dx), true);
            g.lineStyle(1.8, P.ink, 1);
            g.strokePoints(collar(dx), true);
        }

        this.drawHead(g, head, pose, sim);
        this.mouthLocal = add(head, MOUTH_OFF);
    }

    /** 3/4-view head (matching the drivers), with mood-driven eyes, brows and mouth. */
    private drawHead(g: Phaser.GameObjects.Graphics, c: V, pose: AutoPose, sim: RideSimulation): void {
        const { x, y } = c;
        const mood = pose.mood;
        const face = FACE.map((p) => ({ x: x + p.x, y: y + p.y }));
        g.fillStyle(P.skin, 1);
        g.fillPoints(face, true);
        // jaw shadow
        g.fillStyle(P.skinShade, 0.35);
        g.fillEllipse(x - 2, y + 10, 18, 7);
        g.lineStyle(3, P.ink, 1);
        g.strokePoints(face, true);

        // side-parted hair with a fringe sweeping forward
        const hair = [
            [-16, 3], [-16.5, -6], [-11, -14], [-2, -17.5], [8, -15.5], [14, -10], [11.5, -7.5],
            [6, -10.5], [1, -9], [-5, -8], [-8, -3], [-9, 3], [-13, 6],
        ].map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
        g.fillStyle(P.hair, 1);
        g.fillPoints(hair, true);
        g.lineStyle(2, P.ink, 1);
        g.strokePoints(hair, true);
        g.lineStyle(1.6, 0x4a3a33, 1);
        g.lineBetween(x - 9, y - 12, x + 3, y - 15);

        // ear
        g.fillStyle(P.skin, 1);
        g.fillEllipse(x - 6, y + 2, 7, 10);
        g.lineStyle(2, P.ink, 1);
        g.strokeEllipse(x - 6, y + 2, 7, 10);
        g.lineStyle(1.5, P.skinShade, 1);
        g.beginPath();
        g.arc(x - 6, y + 2, 2.5, -1.2, 1.2);
        g.strokePath();

        // nose
        const nose = [
            { x: x + 13.5, y: y - 3 },
            { x: x + 19.5, y: y + 3 },
            { x: x + 15, y: y + 5 },
        ];
        g.fillStyle(P.skin, 1);
        g.fillPoints(nose, true);
        g.lineStyle(2, P.ink, 1);
        g.lineBetween(nose[0].x, nose[0].y, nose[1].x, nose[1].y);
        g.lineBetween(nose[1].x, nose[1].y, nose[2].x, nose[2].y);

        // eyes (near + far), by mood
        const E1: V = { x: x + 6, y: y - 2 };
        const E2: V = { x: x + 12.5, y: y - 2.2 };
        const open = (e: V, rx: number, ry: number, pr: number, look: V) => {
            g.fillStyle(0xffffff, 1);
            g.fillEllipse(e.x, e.y, rx * 2, ry * 2);
            g.lineStyle(1.5, P.ink, 1);
            g.strokeEllipse(e.x, e.y, rx * 2, ry * 2);
            g.fillStyle(P.ink, 1);
            g.fillCircle(e.x + look.x, e.y + look.y, pr);
        };
        const arc = (e: V, r: number, a0: number, a1: number, dy = 0) => {
            g.lineStyle(2.2, P.ink, 1);
            g.beginPath();
            g.arc(e.x, e.y + dy, r, a0, a1);
            g.strokePath();
        };
        if (mood === 'cheer' || mood === 'happy') {
            arc(E1, 3, Math.PI * 1.1, Math.PI * 1.9, 2);
            arc(E2, 2.3, Math.PI * 1.1, Math.PI * 1.9, 2);
        } else if (mood === 'sob' || mood === 'thirsty') {
            arc(E1, 3.2, Math.PI * 0.2, Math.PI * 0.8, -2);
            arc(E2, 2.4, Math.PI * 0.2, Math.PI * 0.8, -2);
        } else if (mood === 'drinking' || (pose.blink && mood === 'calm')) {
            arc(E1, 3, Math.PI * 0.15, Math.PI * 0.85, -1);
            arc(E2, 2.3, Math.PI * 0.15, Math.PI * 0.85, -1);
        } else if (mood === 'shock') {
            open(E1, 4, 4.4, 1.3, { x: 0.3, y: 0 });
            open(E2, 3, 3.8, 1.1, { x: 0.3, y: 0 });
        } else if (mood === 'nervous') {
            open(E1, 3.2, 3.5, 1.7, { x: 1.3, y: -0.6 });
            open(E2, 2.4, 3, 1.4, { x: 1, y: -0.6 });
        } else {
            open(E1, 3, 3.3, 1.7, { x: 0.8, y: 0.2 });
            open(E2, 2.3, 2.9, 1.4, { x: 0.6, y: 0.2 });
        }
        // glasses: both lenses, bridge, arm to the ear
        g.lineStyle(1.7, 0x34495e, 1);
        g.strokeCircle(E1.x, E1.y, 5.2);
        g.strokeEllipse(E2.x + 0.3, E2.y, 6.6, 8);
        g.lineBetween(E1.x + 5.2, E1.y - 0.5, E2.x - 3, E2.y - 0.5);
        g.lineBetween(E1.x - 5.2, E1.y - 0.5, x - 4, y - 1);
        g.fillStyle(0xffffff, 0.3);
        g.fillCircle(E1.x - 1.8, E1.y - 2, 1.4);

        // brows
        g.lineStyle(2.6, P.hair, 1);
        const brow = (l: number, r: number, far: number) => {
            g.lineBetween(E1.x - 4, y + l, E1.x + 3, y + r);
            g.lineBetween(E2.x - 2, y + far, E2.x + 2.5, y + far - 0.5);
        };
        if (mood === 'nervous') brow(-9.5, -12, -12);
        else if (mood === 'shock') brow(-13, -13.5, -13.5);
        else if (mood === 'soaked' || mood === 'sob' || mood === 'thirsty') brow(-9, -12.5, -12);
        else if (mood === 'cheer') brow(-12, -13, -12.5);
        else brow(-10, -10.5, -10.5);

        // mouth on the front of the face
        const mx = x + 12;
        const my = y + 8;
        g.lineStyle(2.2, P.ink, 1);
        if (mood === 'cheer') {
            g.fillStyle(0x6b1f1f, 1);
            g.slice(mx - 1, my - 2, 6, 0, Math.PI, false);
            g.fillPath();
            g.fillStyle(0xff7f7f, 1);
            g.fillCircle(mx - 1, my + 2, 2);
        } else if (mood === 'sob') {
            g.fillStyle(0x6b1f1f, 1);
            g.fillEllipse(mx - 1, my + 3, 7, 5 + Math.abs(Math.sin(this.endT * 12)) * 2);
        } else if (mood === 'thirsty') {
            g.fillStyle(0x6b1f1f, 1);
            g.fillEllipse(mx, my + 1, 6, 6);
            g.fillStyle(0xff7f7f, 1);
            g.fillEllipse(mx + 2, my + 5 + Math.sin(this.endT * 6), 4, 6);
        } else if (mood === 'drinking') {
            g.fillStyle(P.skin, 1);
            g.fillCircle(x + 8, y + 7, 5);
            g.lineStyle(1.5, P.skinShade, 1);
            g.strokeCircle(x + 8, y + 7, 5);
        } else if (mood === 'shock') {
            g.fillStyle(0x6b1f1f, 1);
            g.fillEllipse(mx, my + 1, 6, 8);
        } else if (mood === 'happy') {
            g.beginPath();
            g.arc(mx - 1, my - 2, 4.5, Math.PI * 0.15, Math.PI * 0.85);
            g.strokePath();
        } else if (mood === 'soaked') {
            g.beginPath();
            g.arc(mx - 1, my + 4, 4, Math.PI * 1.15, Math.PI * 1.85);
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
            g.lineBetween(mx - 3, my, mx + 2.5, my - 1);
        }
        if (mood === 'cheer' || mood === 'happy') {
            g.fillStyle(0xff8a80, 0.55);
            g.fillCircle(x + 5, y + 5, 3.5);
        }

        // sweat / tears / drips
        if (mood === 'nervous' || mood === 'thirsty') {
            g.fillStyle(P.water, 1);
            g.fillCircle(x - 9, y - 12, 2.6);
            g.fillTriangle(x - 11.5, y - 13, x - 6.5, y - 13, x - 9, y - 18);
        }
        if (mood === 'sob') {
            g.fillStyle(P.water, 0.95);
            for (let i = 0; i < 4; i++) {
                const k = (this.endT * 1.6 + i * 0.25) % 1;
                g.fillCircle(E1.x - 2 + k * 4, E1.y + 4 + k * 22, 2.2 - k);
            }
        }
        if (mood === 'soaked' || sim.bottle.spilledMl > 40) {
            g.fillStyle(P.water, 0.9);
            const t = sim.time * 3;
            for (let i = 0; i < 3; i++) {
                const k = (t + i * 0.33) % 1;
                g.fillCircle(x - 6 + i * 8, y + 12 + k * 14, 2);
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
        const sh: V = { x: SHOULDER.x + 2 + rig.torsoX.pos, y: SHOULDER.y + 2 + tDy };

        // hand follows a curved path lap → lips, plus its own spring offset
        const u = 1 - p;
        const hand: V = {
            x: u * u * HAND_DOWN.x + 2 * u * p * HAND_CTRL.x + p * p * HAND_UP.x + rig.handX.pos,
            y: u * u * HAND_DOWN.y + 2 * u * p * HAND_CTRL.y + p * p * HAND_UP.y + aDy,
        };
        let angle = DRINK_ANGLE * ease(Math.min(1, sim.arm.progress * 1.15));
        if (this.endPose) {
            const k = ease(Math.min(1, this.endT / 0.4));
            const lerp = (a: number, b: number) => a + (b - a) * k;
            let target: V;
            let ang: number;
            if (this.endPose === 'won') {
                // shake the empty bottle upside down in triumph
                target = { x: -20 + Math.sin(this.endT * 18) * 3, y: -144 };
                ang = Math.PI - 0.1 + Math.sin(this.endT * 18) * 0.28;
            } else if (this.endPose === 'spilledOut') {
                target = { x: HAND_DOWN.x - 4, y: HAND_DOWN.y + 6 };
                ang = 0.7;
            } else {
                // holding the bottle up, staring at what's left
                target = { x: -28, y: -122 };
                ang = -0.35 + Math.sin(this.endT * 3) * 0.05;
            }
            hand.x = lerp(hand.x, target.x);
            hand.y = lerp(hand.y, target.y);
            angle = lerp(angle, ang);
        }
        this.bottleAngle = angle;
        this.handLocal = hand;
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
        // gripping hand on top of the bottle, with knuckles and a thumb
        g.fillStyle(P.skin, 1);
        g.fillCircle(hand.x, hand.y, 6.5);
        g.lineStyle(2.5, P.ink, 1);
        g.strokeCircle(hand.x, hand.y, 6.5);
        g.lineStyle(1.2, P.skinShade, 1);
        for (const k of [-2.5, 0.5, 3.5]) {
            const a1 = add(hand, rot({ x: 4, y: k - 1 }, angle));
            const a2 = add(hand, rot({ x: 6, y: k - 1 }, angle));
            g.lineBetween(a1.x, a1.y, a2.x, a2.y);
        }
        const th = add(hand, rot({ x: -3, y: -6 }, angle));
        g.fillStyle(P.skin, 1);
        g.fillEllipse(th.x, th.y, 6, 4.5);
        g.lineStyle(1.8, P.ink, 1);
        g.strokeEllipse(th.x, th.y, 6, 4.5);

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
        if (this.endPose) this.drawEndFx(g);
    }

    /** Sparkles for a win; a little personal rain cloud when it all went wrong. */
    private drawEndFx(g: Phaser.GameObjects.Graphics): void {
        const t = this.endT;
        const head = { x: HEAD.x, y: HEAD.y };
        if (this.endPose === 'won') {
            // last drop falling out of the upside-down bottle
            const k = (t * 1.5) % 1;
            g.fillStyle(P.water, 1 - k);
            g.fillCircle(this.tipLocal.x, this.tipLocal.y + k * 30, 2.5);
            // twinkling sparkles around the head
            for (let i = 0; i < 5; i++) {
                const a = t * 2 + (i / 5) * Math.PI * 2;
                const r = 30 + Math.sin(t * 5 + i) * 4;
                const sx = head.x + Math.cos(a) * r;
                const sy = head.y - 6 + Math.sin(a) * r * 0.6;
                const sz = 3 + Math.abs(Math.sin(t * 6 + i)) * 3;
                g.fillStyle(i % 2 ? 0xffd23f : 0xffffff, 1);
                g.fillTriangle(sx - sz, sy, sx + sz, sy, sx, sy - sz * 1.8);
                g.fillTriangle(sx - sz, sy, sx + sz, sy, sx, sy + sz * 1.8);
            }
        } else if (this.endPose === 'spilledOut') {
            // a tiny grey cloud raining on the passenger
            const cx = head.x + 2;
            const cy = head.y - 44 + Math.sin(t * 2) * 2;
            g.fillStyle(0x8a94a0, 1);
            for (const [dx, dy, r] of [[-12, 2, 9], [0, -4, 11], [12, 2, 9], [0, 5, 9]]) g.fillCircle(cx + dx, cy + dy, r);
            g.lineStyle(2, P.water, 0.9);
            for (let i = 0; i < 5; i++) {
                const k = (t * 2.5 + i * 0.2) % 1;
                const x = cx - 14 + i * 7;
                g.lineBetween(x, cy + 12 + k * 22, x - 1.5, cy + 18 + k * 22);
            }
        } else {
            // "thirsty" — a wavy heat line above the head
            g.lineStyle(2, 0xffb020, 0.8);
            for (let j = 0; j < 3; j++) {
                g.beginPath();
                for (let i = 0; i <= 8; i++) {
                    const x = head.x - 14 + j * 14 + Math.sin(t * 6 + i + j) * 2;
                    const y = head.y - 26 - i * 2.5;
                    if (i === 0) g.moveTo(x, y);
                    else g.lineTo(x, y);
                }
                g.strokePath();
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
